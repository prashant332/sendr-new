import { NextRequest, NextResponse } from "next/server";
import * as grpc from "@grpc/grpc-js";
import * as protobuf from "protobufjs";
import { WELL_KNOWN_PROTOS } from "@/lib/grpc/wellKnownProtos";

interface GrpcProxyRequest {
  target: string; // "localhost:50051"
  service: string; // "greeter.Greeter"
  method: string; // "SayHello"
  protoDefinition: string; // Raw .proto file content
  additionalProtos?: Record<string, string>; // Import dependencies { path: content }
  message: Record<string, unknown>; // JSON representation of request message
  metadata?: Record<string, string>; // gRPC metadata (headers)
  options?: {
    useTls?: boolean;
    insecure?: boolean; // Skip certificate verification
    timeout?: number; // Request timeout in ms
  };
}

interface GrpcProxyResponse {
  data: unknown; // JSON representation of response message
  metadata: Record<string, string>; // Response metadata
  trailers: Record<string, string>; // gRPC trailers
  status: {
    code: number; // gRPC status code (0-16)
    details: string; // Status message
  };
  time: number; // Duration in ms
  size: number; // Response size in bytes
}

// gRPC status code names for display
const STATUS_CODE_NAMES: Record<number, string> = {
  0: "OK",
  1: "CANCELLED",
  2: "UNKNOWN",
  3: "INVALID_ARGUMENT",
  4: "DEADLINE_EXCEEDED",
  5: "NOT_FOUND",
  6: "ALREADY_EXISTS",
  7: "PERMISSION_DENIED",
  8: "RESOURCE_EXHAUSTED",
  9: "FAILED_PRECONDITION",
  10: "ABORTED",
  11: "OUT_OF_RANGE",
  12: "UNIMPLEMENTED",
  13: "INTERNAL",
  14: "UNAVAILABLE",
  15: "DATA_LOSS",
  16: "UNAUTHENTICATED",
};

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: GrpcProxyRequest = await request.json();
    const {
      target,
      service,
      method,
      protoDefinition,
      additionalProtos = {},
      message,
      metadata = {},
      options = {},
    } = body;

    // Validate required fields
    if (!target) {
      return NextResponse.json({ error: "Target server is required" }, { status: 400 });
    }
    if (!service) {
      return NextResponse.json({ error: "Service name is required" }, { status: 400 });
    }
    if (!method) {
      return NextResponse.json({ error: "Method name is required" }, { status: 400 });
    }
    if (!protoDefinition) {
      return NextResponse.json({ error: "Proto definition is required" }, { status: 400 });
    }

    const { useTls = false, insecure = false, timeout = 30000 } = options;

    // Create a protobufjs Root and parse all proto contents
    const root = new protobuf.Root();

    // Add well-known Google types first
    for (const [path, content] of Object.entries(WELL_KNOWN_PROTOS)) {
      try {
        protobuf.parse(content, root, { keepCase: true });
      } catch (err) {
        // Well-known types might already exist or have conflicts, ignore
        console.warn(`Warning parsing well-known type ${path}:`, err);
      }
    }

    // Parse additional proto files (dependencies) before the main proto
    for (const [path, content] of Object.entries(additionalProtos)) {
      try {
        protobuf.parse(content, root, { keepCase: true });
      } catch (err) {
        console.warn(`Warning parsing additional proto ${path}:`, err);
      }
    }

    // Parse the main proto definition
    try {
      protobuf.parse(protoDefinition, root, { keepCase: true });
    } catch (err) {
      return NextResponse.json(
        { error: `Failed to parse proto definition: ${err instanceof Error ? err.message : String(err)}` },
        { status: 400 }
      );
    }

    // Resolve all type references
    try {
      root.resolveAll();
    } catch (err) {
      console.warn("Warning resolving proto types:", err);
    }

    // Create the gRPC service definition from protobufjs
    const grpcObject = createGrpcObject(root);

    // Navigate to the service
    const serviceParts = service.split(".");
    let serviceConstructor: grpc.ServiceClientConstructor | null = null;
    let current: unknown = grpcObject;

    for (const part of serviceParts) {
      if (current && typeof current === "object" && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return NextResponse.json(
          { error: `Service "${service}" not found in proto definition` },
          { status: 400 }
        );
      }
    }

    // Check if we found a service constructor
    if (typeof current === "function") {
      serviceConstructor = current as grpc.ServiceClientConstructor;
    } else {
      return NextResponse.json(
        { error: `"${service}" is not a valid gRPC service` },
        { status: 400 }
      );
    }

    // Create channel credentials
    let credentials: grpc.ChannelCredentials;
    if (useTls) {
      if (insecure) {
        credentials = grpc.credentials.createSsl(null, null, null, {
          checkServerIdentity: () => undefined,
        });
      } else {
        credentials = grpc.credentials.createSsl();
      }
    } else {
      credentials = grpc.credentials.createInsecure();
    }

    // Create the client
    const client = new serviceConstructor(target, credentials);

    // Check if the method exists on the client
    if (typeof (client as Record<string, unknown>)[method] !== "function") {
      return NextResponse.json(
        { error: `Method "${method}" not found in service "${service}"` },
        { status: 400 }
      );
    }

    // Create metadata
    const grpcMetadata = new grpc.Metadata();
    for (const [key, value] of Object.entries(metadata)) {
      // Binary metadata handling (keys ending in -bin)
      if (key.endsWith("-bin")) {
        grpcMetadata.set(key, Buffer.from(value, "base64"));
      } else {
        grpcMetadata.set(key, value);
      }
    }

    // Set deadline
    const deadline = new Date(Date.now() + timeout);

    // Make the gRPC call
    const result = await new Promise<GrpcProxyResponse>((resolve) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clientAny = client as any;
      const methodFn = clientAny[method];

      // Track response metadata and trailers
      let responseMetadata: Record<string, string> = {};
      let responseTrailers: Record<string, string> = {};

      const call = methodFn.call(
        clientAny,
        message,
        grpcMetadata,
        { deadline },
        (error: grpc.ServiceError | null, response: unknown) => {
          const endTime = Date.now();

          if (error) {
            resolve({
              data: null,
              metadata: responseMetadata,
              trailers: responseTrailers,
              status: {
                code: error.code ?? 2, // UNKNOWN
                details: error.details || error.message || STATUS_CODE_NAMES[error.code ?? 2],
              },
              time: endTime - startTime,
              size: 0,
            });
          } else {
            const responseStr = JSON.stringify(response);
            const size = new TextEncoder().encode(responseStr).length;

            resolve({
              data: response,
              metadata: responseMetadata,
              trailers: responseTrailers,
              status: {
                code: 0,
                details: "OK",
              },
              time: endTime - startTime,
              size,
            });
          }
        }
      );

      // Listen for metadata
      if (call && typeof call.on === "function") {
        call.on("metadata", (meta: grpc.Metadata) => {
          responseMetadata = metadataToObject(meta);
        });

        call.on("status", (status: grpc.StatusObject) => {
          responseTrailers = metadataToObject(status.metadata);
        });
      }
    });

    // Close the client
    client.close();

    return NextResponse.json(result);
  } catch (error) {
    const endTime = Date.now();

    if (error instanceof Error) {
      // Check for common gRPC errors
      if (error.message.includes("ECONNREFUSED")) {
        return NextResponse.json({
          data: null,
          metadata: {},
          trailers: {},
          status: {
            code: 14, // UNAVAILABLE
            details: `Connection refused: Unable to connect to ${(await request.json()).target}`,
          },
          time: endTime - startTime,
          size: 0,
        });
      }

      return NextResponse.json({
        data: null,
        metadata: {},
        trailers: {},
        status: {
          code: 2, // UNKNOWN
          details: error.message,
        },
        time: endTime - startTime,
        size: 0,
      });
    }

    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// Helper to convert gRPC Metadata to plain object
function metadataToObject(metadata: grpc.Metadata): Record<string, string> {
  const result: Record<string, string> = {};
  const map = metadata.getMap();

  for (const [key, value] of Object.entries(map)) {
    if (Buffer.isBuffer(value)) {
      result[key] = value.toString("base64");
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Create a gRPC-compatible object from a protobufjs Root
 * This creates service client constructors that can be used with grpc-js
 */
function createGrpcObject(root: protobuf.Root): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  function processNamespace(
    namespace: protobuf.NamespaceBase,
    target: Record<string, unknown>
  ): void {
    if (!namespace.nested) return;

    for (const [name, nested] of Object.entries(namespace.nested)) {
      if (nested instanceof protobuf.Service) {
        // Create a service client constructor
        target[name] = createServiceClientConstructor(nested);
      } else if (nested instanceof protobuf.Namespace) {
        // Recurse into nested namespace
        const nestedTarget: Record<string, unknown> = {};
        target[name] = nestedTarget;
        processNamespace(nested, nestedTarget);
      }
    }
  }

  processNamespace(root, result);
  return result;
}

/**
 * Create a gRPC service client constructor from a protobufjs Service
 */
function createServiceClientConstructor(
  service: protobuf.Service
): grpc.ServiceClientConstructor {
  // Build the service definition
  // Use a mutable record type first, then cast to ServiceDefinition
  const serviceDef: Record<string, grpc.MethodDefinition<unknown, unknown>> = {};

  for (const method of service.methodsArray) {
    // Get the request and response types
    const requestType = service.root.lookupType(method.requestType);
    const responseType = service.root.lookupType(method.responseType);

    // Create serializers/deserializers for the message types
    const requestSerialize = (message: unknown): Buffer => {
      const msg = message as Record<string, unknown>;
      const errMsg = requestType.verify(msg);
      if (errMsg) {
        console.warn(`Request verification warning: ${errMsg}`);
      }
      const encoded = requestType.encode(requestType.create(msg)).finish();
      return Buffer.from(encoded);
    };

    const requestDeserialize = (buffer: Buffer): unknown => {
      return requestType.decode(buffer);
    };

    const responseSerialize = (message: unknown): Buffer => {
      const msg = message as Record<string, unknown>;
      const encoded = responseType.encode(responseType.create(msg)).finish();
      return Buffer.from(encoded);
    };

    const responseDeserialize = (buffer: Buffer): unknown => {
      const decoded = responseType.decode(buffer);
      // Convert to plain object for JSON serialization
      return responseType.toObject(decoded, {
        longs: String,
        enums: String,
        bytes: String,
        defaults: true,
        oneofs: true,
      });
    };

    serviceDef[method.name] = {
      path: `/${service.fullName.replace(/^\./, "")}/${method.name}`,
      requestStream: method.requestStream || false,
      responseStream: method.responseStream || false,
      requestSerialize,
      requestDeserialize,
      responseSerialize,
      responseDeserialize,
    };
  }

  // Create the client constructor using grpc-js
  return grpc.makeGenericClientConstructor(
    serviceDef as grpc.ServiceDefinition,
    service.name,
    {}
  );
}
