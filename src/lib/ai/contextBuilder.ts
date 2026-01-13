import { ScriptContext, JSONSchema, QuickAction } from "./types";

const SENSITIVE_KEYS = [
  "password",
  "secret",
  "token",
  "apikey",
  "api_key",
  "authorization",
  "auth",
  "credential",
  "private",
  "key",
];

const MAX_ARRAY_ITEMS = 3;
const MAX_STRING_LENGTH = 200;
const MAX_OBJECT_DEPTH = 4;

/**
 * Infer a JSON schema from response data
 */
export function inferJSONSchema(data: unknown, depth: number = MAX_OBJECT_DEPTH): JSONSchema {
  if (depth === 0) {
    return { type: "any" };
  }

  if (data === null) {
    return { type: "null" };
  }

  if (data === undefined) {
    return { type: "undefined" };
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return { type: "array", items: { type: "any" } };
    }
    // Infer from first item
    return {
      type: "array",
      items: inferJSONSchema(data[0], depth - 1),
    };
  }

  if (typeof data === "object") {
    const properties: Record<string, JSONSchema> = {};
    for (const [key, value] of Object.entries(data)) {
      properties[key] = inferJSONSchema(value, depth - 1);
    }
    return { type: "object", properties };
  }

  return { type: typeof data };
}

/**
 * Check if a key might contain sensitive data
 */
function isSensitiveKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return SENSITIVE_KEYS.some((sensitive) => lowerKey.includes(sensitive));
}

/**
 * Truncate and sanitize response data for LLM context
 * - Removes sensitive fields
 * - Truncates arrays to first N items
 * - Truncates long strings
 */
export function truncateAndSanitize(
  data: unknown,
  maxSize: number = 2000,
  currentSize: number = 0
): unknown {
  if (currentSize > maxSize) {
    return "[truncated]";
  }

  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    const truncated = data.slice(0, MAX_ARRAY_ITEMS);
    const sanitized = truncated.map((item) =>
      truncateAndSanitize(item, maxSize, currentSize + JSON.stringify(item).length)
    );

    if (data.length > MAX_ARRAY_ITEMS) {
      return [...sanitized, `... and ${data.length - MAX_ARRAY_ITEMS} more items`];
    }
    return sanitized;
  }

  if (typeof data === "object") {
    const result: Record<string, unknown> = {};
    let size = currentSize;

    for (const [key, value] of Object.entries(data)) {
      // Mask sensitive fields
      if (isSensitiveKey(key)) {
        result[key] = "[REDACTED]";
        continue;
      }

      const valueSize = JSON.stringify(value).length;
      if (size + valueSize > maxSize) {
        result[key] = "[truncated]";
        continue;
      }

      result[key] = truncateAndSanitize(value, maxSize, size);
      size += valueSize;
    }

    return result;
  }

  if (typeof data === "string") {
    if (data.length > MAX_STRING_LENGTH) {
      return data.substring(0, MAX_STRING_LENGTH) + "...";
    }
    return data;
  }

  return data;
}

/**
 * Build the full context for script generation
 */
export function buildScriptContext(
  response: unknown,
  environmentVariables: Record<string, string>,
  requestDetails: { method: string; url: string; isGrpc?: boolean },
  existingScript?: string,
  includeResponseSample: boolean = true
): ScriptContext {
  const context: ScriptContext = {
    environmentVariables: Object.keys(environmentVariables),
    requestDetails: {
      method: requestDetails.method,
      url: requestDetails.url,
      isGrpc: requestDetails.isGrpc || false,
    },
  };

  // Only include response data if there is a response
  if (response !== null && response !== undefined) {
    context.responseSchema = inferJSONSchema(response);

    if (includeResponseSample) {
      context.responseSample = truncateAndSanitize(response);
    }
  }

  if (existingScript && existingScript.trim()) {
    context.existingScript = existingScript;
  }

  return context;
}

/**
 * Analyze response and suggest relevant quick actions
 */
export function suggestQuickActions(response: unknown): QuickAction[] {
  const suggestions: QuickAction[] = [];

  if (typeof response !== "object" || response === null) {
    // Basic suggestions for non-object responses
    suggestions.push({
      id: "assert-status",
      label: "Assert status 200",
      prompt: "Create a test that asserts the response status is 200",
      icon: "check",
      scriptType: "test",
    });
    return suggestions;
  }

  const data = response as Record<string, unknown>;

  // Check for auth token patterns
  if (
    data.token ||
    data.access_token ||
    data.accessToken ||
    data.id_token ||
    data.jwt
  ) {
    suggestions.push({
      id: "save-token",
      label: "Save auth token",
      prompt:
        "Extract the authentication token from the response and save it as 'authToken' environment variable",
      icon: "key",
      scriptType: "test",
    });
  }

  // Check for ID patterns
  if (data.id || data.userId || data.user_id || (data.user && typeof data.user === "object")) {
    suggestions.push({
      id: "save-id",
      label: "Save ID",
      prompt: "Save the ID from the response to an environment variable called 'lastId'",
      icon: "hash",
      scriptType: "test",
    });
  }

  // Check for array data
  const arrayFields = Object.entries(data).filter(([, v]) => Array.isArray(v));
  for (const [key, arr] of arrayFields) {
    if ((arr as unknown[]).length > 0) {
      suggestions.push({
        id: `filter-${key}`,
        label: `Filter ${key}`,
        prompt: `Help me filter the ${key} array based on a condition I specify`,
        icon: "filter",
        scriptType: "test",
      });
    }
  }

  // Check for pagination
  if (
    data.page ||
    data.totalPages ||
    data.total_pages ||
    data.hasMore ||
    data.has_more ||
    data.nextCursor ||
    data.next_cursor ||
    data.nextPage
  ) {
    suggestions.push({
      id: "pagination",
      label: "Handle pagination",
      prompt: "Save pagination info (page number, cursor, or next page URL) for the next request",
      icon: "layers",
      scriptType: "test",
    });
  }

  // Check for user data
  if (data.user || data.users || data.email || data.username) {
    suggestions.push({
      id: "validate-user",
      label: "Validate user data",
      prompt: "Create tests to validate user data has required fields (email, name, id)",
      icon: "user",
      scriptType: "test",
    });
  }

  // Always available suggestions
  suggestions.push({
    id: "assert-status",
    label: "Assert status 200",
    prompt: "Create a test that asserts the response status is 200",
    icon: "check",
    scriptType: "test",
  });

  suggestions.push({
    id: "validate-schema",
    label: "Validate schema",
    prompt: "Create tests to validate the response matches the expected schema structure",
    icon: "file-text",
    scriptType: "test",
  });

  suggestions.push({
    id: "store-response",
    label: "Store response",
    prompt:
      "Store the entire response (or a specific part) to an environment variable for use in subsequent requests",
    icon: "save",
    scriptType: "test",
  });

  return suggestions;
}
