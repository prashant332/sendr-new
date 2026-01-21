import { db, SavedRequest, GrpcConfig } from "@/lib/db";
import { interpolate } from "@/lib/interpolate";
import { runScript, TestResult } from "@/lib/scriptRunner";

export interface RequestResult {
  requestId: string;
  requestName: string;
  method: string;
  url: string;
  statusCode: number;
  statusText: string;
  duration: number;
  testResults: TestResult[];
  logs: string[];
  error?: string;
  // gRPC-specific fields
  grpcStatus?: {
    code: number;
    details: string;
  };
}

export interface RunSummary {
  collectionId: string;
  collectionName: string;
  totalRequests: number;
  completedRequests: number;
  failedRequests: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  results: RequestResult[];
  startTime: number;
  endTime?: number;
}

export interface RunnerConfig {
  collectionId: string;
  initialVariables: Record<string, string>;
  delay?: number; // ms delay between requests
  stopOnError?: boolean;
}

export type RunnerCallback = (
  event: "start" | "request_start" | "request_complete" | "complete",
  data: {
    summary: RunSummary;
    currentRequest?: SavedRequest;
    currentResult?: RequestResult;
  }
) => void;

/**
 * Executes all requests in a collection sequentially.
 * Maintains a runtime environment that persists across requests.
 */
export async function runWorkflow(
  config: RunnerConfig,
  onProgress?: RunnerCallback
): Promise<RunSummary> {
  const { collectionId, initialVariables, delay = 0, stopOnError = false } = config;

  // Load collection and requests
  const collection = await db.collections.get(collectionId);
  if (!collection) {
    throw new Error(`Collection not found: ${collectionId}`);
  }

  const requests = await db.requests
    .where("collectionId")
    .equals(collectionId)
    .toArray();

  // Initialize summary
  const summary: RunSummary = {
    collectionId,
    collectionName: collection.name,
    totalRequests: requests.length,
    completedRequests: 0,
    failedRequests: 0,
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    results: [],
    startTime: Date.now(),
  };

  // Runtime environment that persists across requests
  let runtimeVariables = { ...initialVariables };

  onProgress?.("start", { summary });

  // Execute each request sequentially
  for (const request of requests) {
    onProgress?.("request_start", { summary, currentRequest: request });

    const result = await executeRequest(request, runtimeVariables);

    // Update runtime variables with any changes from scripts
    runtimeVariables = { ...runtimeVariables, ...result.updatedVariables };

    // Build request result
    const requestResult: RequestResult = {
      requestId: request.id,
      requestName: request.name,
      method: request.method,
      url: result.interpolatedUrl,
      statusCode: result.statusCode,
      statusText: result.statusText,
      duration: result.duration,
      testResults: result.testResults,
      logs: result.logs,
      error: result.error,
      grpcStatus: result.grpcStatus,
    };

    // Update summary
    summary.results.push(requestResult);
    summary.completedRequests++;

    if (result.error || result.statusCode >= 400) {
      summary.failedRequests++;
    }

    summary.totalTests += result.testResults.length;
    summary.passedTests += result.testResults.filter((t) => t.passed).length;
    summary.failedTests += result.testResults.filter((t) => !t.passed).length;

    onProgress?.("request_complete", { summary, currentRequest: request, currentResult: requestResult });

    // Check if we should stop on error
    if (stopOnError && (result.error || result.statusCode >= 400)) {
      break;
    }

    // Add delay between requests
    if (delay > 0 && requests.indexOf(request) < requests.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  summary.endTime = Date.now();
  onProgress?.("complete", { summary });

  return summary;
}

interface ExecuteResult {
  interpolatedUrl: string;
  statusCode: number;
  statusText: string;
  duration: number;
  testResults: TestResult[];
  logs: string[];
  updatedVariables: Record<string, string>;
  error?: string;
  // gRPC-specific fields
  grpcStatus?: {
    code: number;
    details: string;
  };
  grpcMetadata?: Record<string, string>;
  grpcTrailers?: Record<string, string>;
}

async function executeRequest(
  request: SavedRequest,
  variables: Record<string, string>
): Promise<ExecuteResult> {
  let currentVariables = { ...variables };
  const logs: string[] = [];
  let testResults: TestResult[] = [];

  // Run pre-request script
  if (request.preRequestScript?.trim()) {
    const preResult = runScript(request.preRequestScript, {
      variables: currentVariables,
    });
    currentVariables = { ...currentVariables, ...preResult.updatedVariables };
    logs.push(...preResult.logs);

    if (preResult.error) {
      return {
        interpolatedUrl: request.url,
        statusCode: 0,
        statusText: "Pre-request Script Error",
        duration: 0,
        testResults: [],
        logs: [...logs, `Pre-request script error: ${preResult.error}`],
        updatedVariables: currentVariables,
        error: `Pre-request script error: ${preResult.error}`,
      };
    }
  }

  // Handle gRPC requests separately
  if (request.method === "GRPC" && request.grpcConfig) {
    return executeGrpcRequest(request, currentVariables, logs);
  }

  // Interpolate URL
  const interpolatedUrl = interpolate(request.url, currentVariables);

  // Build query params
  const activeParams = request.params.filter((p) => p.active && p.key);
  const queryString = activeParams
    .map(
      (p) =>
        `${encodeURIComponent(interpolate(p.key, currentVariables))}=${encodeURIComponent(
          interpolate(p.value, currentVariables)
        )}`
    )
    .join("&");

  const finalUrl = queryString
    ? `${interpolatedUrl}${interpolatedUrl.includes("?") ? "&" : "?"}${queryString}`
    : interpolatedUrl;

  // Build headers
  const headers: Record<string, string> = {};
  for (const h of request.headers) {
    if (h.active && h.key) {
      headers[interpolate(h.key, currentVariables)] = interpolate(
        h.value,
        currentVariables
      );
    }
  }

  // Apply authentication (backward compatible)
  let authUrl = finalUrl;
  if (request.auth && request.auth.type !== "none") {
    const auth = request.auth;
    if (auth.type === "bearer") {
      const token = interpolate(auth.bearer.token, currentVariables);
      const headerKey = interpolate(auth.bearer.headerKey || "Authorization", currentVariables);
      // Only use "Bearer" default if prefix is undefined, not if explicitly empty
      const rawPrefix = auth.bearer.prefix !== undefined ? auth.bearer.prefix : "Bearer";
      const prefix = interpolate(rawPrefix, currentVariables);
      if (token) {
        headers[headerKey] = prefix ? `${prefix} ${token}` : token;
      }
    } else if (auth.type === "basic") {
      const username = interpolate(auth.basic.username, currentVariables);
      const password = interpolate(auth.basic.password, currentVariables);
      const headerKey = interpolate(auth.basic.headerKey || "Authorization", currentVariables);
      if (username || password) {
        const encoded = btoa(`${username}:${password}`);
        headers[headerKey] = `Basic ${encoded}`;
      }
    } else if (auth.type === "apikey") {
      const key = interpolate(auth.apikey.key, currentVariables);
      const value = interpolate(auth.apikey.value, currentVariables);
      if (key && value) {
        if (auth.apikey.addTo === "header") {
          headers[key] = value;
        } else {
          const separator = authUrl.includes("?") ? "&" : "?";
          authUrl = `${authUrl}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
        }
      }
    }
  }

  // Build request body based on mode
  let requestBody: unknown = undefined;
  // Cast to unknown first for backward compatibility with old string bodies
  const body = request.body as unknown;

  // Handle backward compatibility: old requests have body as string
  if (typeof body === "string") {
    if (request.method !== "GET" && body.trim()) {
      const interpolatedBody = interpolate(body, currentVariables);
      try {
        requestBody = JSON.parse(interpolatedBody);
        if (!headers["Content-Type"]) {
          headers["Content-Type"] = "application/json";
        }
      } catch {
        requestBody = interpolatedBody;
      }
    }
  } else if (body && typeof body === "object" && "mode" in body && (body as { mode: string }).mode !== "none" && request.method !== "GET") {
    const typedBody = body as { mode: string; raw: string; formData: { key: string; value: string; active: boolean }[] };
    if (typedBody.mode === "json" || typedBody.mode === "xml" || typedBody.mode === "raw") {
      const interpolatedBody = interpolate(typedBody.raw, currentVariables);
      if (typedBody.mode === "json" && interpolatedBody.trim()) {
        try {
          requestBody = JSON.parse(interpolatedBody);
        } catch {
          requestBody = interpolatedBody;
        }
        if (!headers["Content-Type"]) {
          headers["Content-Type"] = "application/json";
        }
      } else if (typedBody.mode === "xml") {
        requestBody = interpolatedBody;
        if (!headers["Content-Type"]) {
          headers["Content-Type"] = "application/xml";
        }
      } else {
        requestBody = interpolatedBody;
      }
    } else if (typedBody.mode === "form-data" || typedBody.mode === "x-www-form-urlencoded") {
      const formData: Record<string, string> = {};
      typedBody.formData
        .filter((f) => f.active && f.key)
        .forEach((f) => {
          formData[interpolate(f.key, currentVariables)] = interpolate(f.value, currentVariables);
        });
      requestBody = { _formData: formData, _formMode: typedBody.mode };
    }
  }

  // Make the request via proxy
  const startTime = Date.now();
  let statusCode = 0;
  let statusText = "";
  let responseData: unknown = null;
  let responseHeaders: Record<string, string> = {};
  let error: string | undefined;

  try {
    const response = await fetch("/api/proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method: request.method,
        url: authUrl,
        headers,
        body: requestBody,
      }),
    });

    const result = await response.json();
    statusCode = result.status || 0;
    statusText = result.statusText || "";
    responseData = result.data;
    responseHeaders = result.headers || {};

    if (result.error) {
      error = result.error;
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    statusText = "Network Error";
  }

  const duration = Date.now() - startTime;

  // Run test script
  if (request.testScript?.trim() && !error) {
    const testResult = runScript(request.testScript, {
      variables: currentVariables,
      response: {
        status: statusCode,
        statusText,
        headers: responseHeaders,
        data: responseData,
      },
    });
    currentVariables = { ...currentVariables, ...testResult.updatedVariables };
    testResults = testResult.testResults;
    logs.push(...testResult.logs);

    if (testResult.error) {
      logs.push(`Test script error: ${testResult.error}`);
    }
  }

  return {
    interpolatedUrl: authUrl,
    statusCode,
    statusText,
    duration,
    testResults,
    logs,
    updatedVariables: currentVariables,
    error,
  };
}

/**
 * Execute a gRPC request via the grpc-proxy endpoint
 */
async function executeGrpcRequest(
  request: SavedRequest,
  variables: Record<string, string>,
  logs: string[]
): Promise<ExecuteResult> {
  let currentVariables = { ...variables };
  let testResults: TestResult[] = [];

  const grpcConfig = request.grpcConfig as GrpcConfig;
  const interpolatedUrl = interpolate(request.url, currentVariables);

  // Get proto schema from database
  const protoSchema = await db.protoSchemas.get(grpcConfig.protoSchemaId);
  if (!protoSchema) {
    return {
      interpolatedUrl,
      statusCode: 0,
      statusText: "Proto Schema Not Found",
      duration: 0,
      testResults: [],
      logs: [...logs, `Proto schema not found: ${grpcConfig.protoSchemaId}`],
      updatedVariables: currentVariables,
      error: `Proto schema not found: ${grpcConfig.protoSchemaId}`,
    };
  }

  // Build gRPC metadata from config + auth
  const metadata: Record<string, string> = {};

  // Add metadata from grpcConfig
  if (grpcConfig.metadata) {
    for (const entry of grpcConfig.metadata) {
      if (entry.active && entry.key) {
        metadata[entry.key.toLowerCase()] = interpolate(entry.value, currentVariables);
      }
    }
  }

  // Apply authentication to metadata
  if (request.auth && request.auth.type !== "none") {
    const auth = request.auth;
    if (auth.type === "bearer") {
      const token = interpolate(auth.bearer.token, currentVariables);
      const headerKey = interpolate(auth.bearer.headerKey || "authorization", currentVariables).toLowerCase();
      const rawPrefix = auth.bearer.prefix !== undefined ? auth.bearer.prefix : "Bearer";
      const prefix = interpolate(rawPrefix, currentVariables);
      if (token) {
        metadata[headerKey] = prefix ? `${prefix} ${token}` : token;
      }
    } else if (auth.type === "basic") {
      const username = interpolate(auth.basic.username, currentVariables);
      const password = interpolate(auth.basic.password, currentVariables);
      const headerKey = interpolate(auth.basic.headerKey || "authorization", currentVariables).toLowerCase();
      if (username || password) {
        const encoded = btoa(`${username}:${password}`);
        metadata[headerKey] = `Basic ${encoded}`;
      }
    } else if (auth.type === "apikey") {
      const key = interpolate(auth.apikey.key, currentVariables).toLowerCase();
      const value = interpolate(auth.apikey.value, currentVariables);
      if (key && value && auth.apikey.addTo === "header") {
        metadata[key] = value;
      }
    }
  }

  // Get request message from body
  let message: Record<string, unknown> = {};
  const body = request.body as unknown;
  if (body && typeof body === "object" && "mode" in body) {
    const typedBody = body as { mode: string; raw: string };
    if (typedBody.mode === "json" && typedBody.raw?.trim()) {
      try {
        const interpolatedBody = interpolate(typedBody.raw, currentVariables);
        message = JSON.parse(interpolatedBody);
      } catch {
        // If JSON parsing fails, use empty object
        logs.push("Warning: Failed to parse request body as JSON");
      }
    }
  }

  // Make gRPC request
  const startTime = Date.now();
  let statusCode = 0;
  let statusText = "";
  let responseData: unknown = null;
  let responseMetadata: Record<string, string> = {};
  let responseTrailers: Record<string, string> = {};
  let grpcStatus: { code: number; details: string } | undefined;
  let error: string | undefined;

  try {
    const response = await fetch("/api/grpc-proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target: interpolatedUrl,
        service: grpcConfig.service,
        method: grpcConfig.method,
        protoDefinition: protoSchema.content,
        message,
        metadata,
        options: {
          useTls: grpcConfig.useTls,
          insecure: grpcConfig.insecure,
          timeout: grpcConfig.timeout || 30000,
        },
      }),
    });

    const result = await response.json();

    if (result.error) {
      // Handle proxy-level errors
      error = result.error;
      statusText = result.error;
    } else {
      responseData = result.data;
      responseMetadata = result.metadata || {};
      responseTrailers = result.trailers || {};
      grpcStatus = result.status;

      // Map gRPC status to HTTP-like status for consistency
      statusCode = grpcStatus?.code === 0 ? 200 : 500;
      statusText = grpcStatus?.details || "Unknown";

      if (grpcStatus?.code !== 0) {
        error = `gRPC Error: ${grpcStatus?.details || "Unknown error"} (code: ${grpcStatus?.code})`;
      }
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    statusText = "Network Error";
  }

  const duration = Date.now() - startTime;

  // Run test script with gRPC-specific context
  if (request.testScript?.trim() && !error) {
    const testResult = runScript(request.testScript, {
      variables: currentVariables,
      response: {
        status: statusCode,
        statusText,
        headers: {}, // gRPC doesn't have HTTP headers
        data: responseData,
        grpcMetadata: responseMetadata,
        grpcTrailers: responseTrailers,
        grpcStatus,
      },
    });
    currentVariables = { ...currentVariables, ...testResult.updatedVariables };
    testResults = testResult.testResults;
    logs.push(...testResult.logs);

    if (testResult.error) {
      logs.push(`Test script error: ${testResult.error}`);
    }
  }

  return {
    interpolatedUrl,
    statusCode,
    statusText,
    duration,
    testResults,
    logs,
    updatedVariables: currentVariables,
    error,
    grpcStatus,
    grpcMetadata: responseMetadata,
    grpcTrailers: responseTrailers,
  };
}
