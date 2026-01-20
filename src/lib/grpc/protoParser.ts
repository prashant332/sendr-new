/**
 * Proto file parser using protobufjs
 * Parses .proto files and extracts services, methods, and messages
 */

import * as protobuf from "protobufjs";
import type { ParsedService, ParsedMethod } from "@/lib/db";

export interface ProtoParseResult {
  success: boolean;
  services: ParsedService[];
  messages: string[];
  enums: string[];
  errors: string[];
  packageName: string | null;
  imports: string[];
}

/**
 * Parse a .proto file content and extract services, methods, and messages
 */
export function parseProtoContent(content: string): ProtoParseResult {
  const result: ProtoParseResult = {
    success: false,
    services: [],
    messages: [],
    enums: [],
    errors: [],
    packageName: null,
    imports: [],
  };

  try {
    // Parse the proto content
    const root = protobuf.parse(content, { keepCase: true });

    if (root.package) {
      result.packageName = root.package;
    }

    // Extract imports from the content using regex
    // protobufjs doesn't expose imports directly
    const importRegex = /import\s+["']([^"']+)["']/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      result.imports.push(match[1]);
    }

    // Process the root object
    processNamespace(root.root, "", result);

    result.success = true;
  } catch (err) {
    result.errors.push(`Parse error: ${err instanceof Error ? err.message : String(err)}`);
  }

  return result;
}

/**
 * Recursively process a namespace/type to extract services and messages
 */
function processNamespace(
  namespace: protobuf.NamespaceBase,
  prefix: string,
  result: ProtoParseResult
): void {
  if (!namespace.nested) return;

  for (const [name, nested] of Object.entries(namespace.nested)) {
    const fullName = prefix ? `${prefix}.${name}` : name;

    if (nested instanceof protobuf.Service) {
      // Extract service with its methods
      const service: ParsedService = {
        name,
        fullName,
        methods: [],
      };

      if (nested.methods) {
        for (const [methodName, method] of Object.entries(nested.methods)) {
          const parsedMethod: ParsedMethod = {
            name: methodName,
            inputType: method.requestType,
            outputType: method.responseType,
            clientStreaming: method.requestStream || false,
            serverStreaming: method.responseStream || false,
          };
          service.methods.push(parsedMethod);
        }
      }

      result.services.push(service);
    } else if (nested instanceof protobuf.Type) {
      // It's a message type
      result.messages.push(fullName);
    } else if (nested instanceof protobuf.Enum) {
      // It's an enum
      result.enums.push(fullName);
    } else if (nested instanceof protobuf.Namespace) {
      // Recurse into nested namespace
      processNamespace(nested, fullName, result);
    }
  }
}

/**
 * Get method type description (Unary, Server Streaming, etc.)
 */
export function getMethodType(method: ParsedMethod): string {
  if (method.clientStreaming && method.serverStreaming) {
    return "Bidirectional Streaming";
  } else if (method.clientStreaming) {
    return "Client Streaming";
  } else if (method.serverStreaming) {
    return "Server Streaming";
  }
  return "Unary";
}

/**
 * Get method type short code
 */
export function getMethodTypeCode(method: ParsedMethod): string {
  if (method.clientStreaming && method.serverStreaming) {
    return "BiDi";
  } else if (method.clientStreaming) {
    return "CS";
  } else if (method.serverStreaming) {
    return "SS";
  }
  return "U";
}

/**
 * Generate a sample JSON message for a message type
 */
export function generateSampleMessage(
  protoContent: string,
  messageType: string
): Record<string, unknown> | null {
  try {
    const root = protobuf.parse(protoContent, { keepCase: true });
    const Type = root.root.lookupType(messageType);

    if (!Type) return null;

    // Create a sample object with default values
    const sample: Record<string, unknown> = {};

    for (const field of Type.fieldsArray) {
      sample[field.name] = getDefaultValueForField(field);
    }

    return sample;
  } catch {
    return null;
  }
}

/**
 * Get default value for a protobuf field
 */
function getDefaultValueForField(field: protobuf.Field): unknown {
  // Handle repeated fields
  if (field.repeated) {
    return [];
  }

  // Handle maps
  if (field.map) {
    return {};
  }

  // Handle different types
  switch (field.type) {
    case "double":
    case "float":
      return 0.0;
    case "int32":
    case "int64":
    case "uint32":
    case "uint64":
    case "sint32":
    case "sint64":
    case "fixed32":
    case "fixed64":
    case "sfixed32":
    case "sfixed64":
      return 0;
    case "bool":
      return false;
    case "string":
      return "";
    case "bytes":
      return "";
    default:
      // Likely a message type or enum
      if (field.resolvedType instanceof protobuf.Enum) {
        const enumValues = Object.values(field.resolvedType.values);
        return enumValues[0] ?? 0;
      }
      // For nested messages, return empty object
      return {};
  }
}

/**
 * Validate proto syntax without fully parsing
 */
export function validateProtoSyntax(content: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    protobuf.parse(content, { keepCase: true });
    return { valid: true, errors: [] };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return { valid: false, errors };
  }
}

/**
 * Extract package name from proto content
 */
export function extractPackageName(content: string): string | null {
  const match = /package\s+([a-zA-Z_][a-zA-Z0-9_.]*)\s*;/.exec(content);
  return match ? match[1] : null;
}

/**
 * Extract syntax version from proto content
 */
export function extractSyntaxVersion(content: string): string {
  const match = /syntax\s*=\s*["']([^"']+)["']/.exec(content);
  return match ? match[1] : "proto2"; // Default to proto2 if not specified
}
