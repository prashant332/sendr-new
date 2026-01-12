import { db, SavedRequest } from "@/lib/db";
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

  // Interpolate URL, headers, params, and body
  const interpolatedUrl = interpolate(request.url, currentVariables);
  const interpolatedBody = interpolate(request.body || "", currentVariables);

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
        url: finalUrl,
        headers,
        body: request.method !== "GET" ? interpolatedBody : undefined,
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
    interpolatedUrl: finalUrl,
    statusCode,
    statusText,
    duration,
    testResults,
    logs,
    updatedVariables: currentVariables,
    error,
  };
}
