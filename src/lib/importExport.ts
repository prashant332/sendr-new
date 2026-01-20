/**
 * Import/Export utilities for Sendr collections
 * Supports:
 * - Postman Collection v2.1 import
 * - Sendr JSON export/import
 */

import { db, Collection, SavedRequest, RequestBody, RequestAuth, HttpMethod, GrpcConfig } from "./db";
import { generateUUID } from "./uuid";

// ============================================================================
// Sendr Export Format
// ============================================================================

export interface SendrExportFormat {
  version: "1.0";
  exportedAt: string;
  collections: SendrExportCollection[];
}

export interface SendrExportCollection {
  name: string;
  requests: SendrExportRequest[];
}

export interface SendrExportRequest {
  name: string;
  method: HttpMethod;
  url: string;
  headers: { key: string; value: string; active: boolean }[];
  params: { key: string; value: string; active: boolean }[];
  body: RequestBody;
  auth: RequestAuth;
  preRequestScript: string;
  testScript: string;
  grpcConfig?: GrpcConfig; // Only for gRPC requests
}

// ============================================================================
// Postman Collection v2.1 Format (subset of types we need)
// ============================================================================

interface PostmanCollection {
  info: {
    name: string;
    schema: string;
  };
  item: PostmanItem[];
  variable?: PostmanVariable[];
}

interface PostmanItem {
  name: string;
  item?: PostmanItem[]; // Folders contain nested items
  request?: PostmanRequest;
  event?: PostmanEvent[];
}

interface PostmanRequest {
  method: string;
  header?: PostmanHeader[];
  url: PostmanUrl | string;
  body?: PostmanBody;
  auth?: PostmanAuth;
}

interface PostmanHeader {
  key: string;
  value: string;
  disabled?: boolean;
}

interface PostmanUrl {
  raw?: string;
  host?: string[];
  path?: string[];
  query?: PostmanQuery[];
  variable?: PostmanVariable[];
}

interface PostmanQuery {
  key: string;
  value: string;
  disabled?: boolean;
}

interface PostmanVariable {
  key: string;
  value: string;
}

interface PostmanBody {
  mode: "raw" | "urlencoded" | "formdata" | "file" | "graphql";
  raw?: string;
  urlencoded?: { key: string; value: string; disabled?: boolean }[];
  formdata?: { key: string; value: string; disabled?: boolean; type?: string }[];
  options?: {
    raw?: {
      language?: string;
    };
  };
}

interface PostmanAuth {
  type: "bearer" | "basic" | "apikey" | "noauth";
  bearer?: { key: string; value: string }[];
  basic?: { key: string; value: string }[];
  apikey?: { key: string; value: string }[];
}

interface PostmanEvent {
  listen: "prerequest" | "test";
  script: {
    exec: string[];
  };
}

// ============================================================================
// Export Functions
// ============================================================================

/**
 * Export all collections or specific collections to Sendr JSON format
 */
export async function exportToJson(collectionIds?: string[]): Promise<SendrExportFormat> {
  let collections: Collection[];

  if (collectionIds && collectionIds.length > 0) {
    collections = await db.collections
      .where("id")
      .anyOf(collectionIds)
      .toArray();
  } else {
    collections = await db.collections.toArray();
  }

  const exportData: SendrExportFormat = {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    collections: [],
  };

  for (const collection of collections) {
    const requests = await db.requests
      .where("collectionId")
      .equals(collection.id)
      .toArray();

    exportData.collections.push({
      name: collection.name,
      requests: requests.map((req) => ({
        name: req.name,
        method: req.method,
        url: req.url,
        headers: req.headers,
        params: req.params,
        body: req.body,
        auth: req.auth,
        preRequestScript: req.preRequestScript,
        testScript: req.testScript,
        ...(req.grpcConfig ? { grpcConfig: req.grpcConfig } : {}),
      })),
    });
  }

  return exportData;
}

/**
 * Download export data as a JSON file
 */
export function downloadJson(data: SendrExportFormat, filename?: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename || `sendr-export-${new Date().toISOString().split("T")[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================================
// Import Functions
// ============================================================================

export interface ImportResult {
  success: boolean;
  collectionsImported: number;
  requestsImported: number;
  errors: string[];
  warnings: string[];
}

/**
 * Import from Sendr JSON format
 */
export async function importFromSendrJson(data: SendrExportFormat): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    collectionsImported: 0,
    requestsImported: 0,
    errors: [],
    warnings: [],
  };

  if (data.version !== "1.0") {
    result.warnings.push(`Unknown version "${data.version}", attempting import anyway`);
  }

  for (const collection of data.collections) {
    try {
      const collectionId = generateUUID();
      await db.collections.add({
        id: collectionId,
        name: collection.name,
        createdAt: Date.now(),
      });
      result.collectionsImported++;

      for (const request of collection.requests) {
        try {
          await db.requests.add({
            id: generateUUID(),
            collectionId,
            name: request.name,
            method: request.method,
            url: request.url,
            headers: request.headers || [],
            params: request.params || [],
            body: request.body || { mode: "none", raw: "", formData: [] },
            auth: request.auth || createDefaultAuth(),
            preRequestScript: request.preRequestScript || "",
            testScript: request.testScript || "",
            ...(request.grpcConfig ? { grpcConfig: request.grpcConfig } : {}),
          });
          result.requestsImported++;
        } catch (err) {
          result.errors.push(`Failed to import request "${request.name}": ${err}`);
        }
      }
    } catch (err) {
      result.errors.push(`Failed to import collection "${collection.name}": ${err}`);
      result.success = false;
    }
  }

  return result;
}

/**
 * Import from Postman Collection v2.1 format
 */
export async function importFromPostman(data: PostmanCollection): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    collectionsImported: 0,
    requestsImported: 0,
    errors: [],
    warnings: [],
  };

  // Validate it's a Postman collection
  if (!data.info?.schema?.includes("collection.json")) {
    result.errors.push("Invalid Postman collection format");
    result.success = false;
    return result;
  }

  const collectionName = data.info.name || "Imported Collection";
  const collectionId = generateUUID();

  // Check if collection has scripts
  const hasScripts = checkForScripts(data.item);

  try {
    await db.collections.add({
      id: collectionId,
      name: collectionName,
      createdAt: Date.now(),
    });
    result.collectionsImported++;

    // Recursively process items (handles folders) and track if scripts were normalized
    const scriptsWereNormalized = await processPostmanItems(data.item, collectionId, result, "");

    // Import collection-level variables as an environment if present
    let environmentCreated = false;
    if (data.variable && data.variable.length > 0) {
      try {
        const envVariables: Record<string, string> = {};
        for (const v of data.variable) {
          if (v.key) {
            envVariables[v.key] = v.value || "";
          }
        }

        await db.environments.add({
          id: generateUUID(),
          name: `${collectionName} Variables`,
          variables: envVariables,
        });
        environmentCreated = true;
      } catch (err) {
        result.warnings.push(`Failed to import collection variables as environment: ${err}`);
      }
    }

    // Add appropriate messages based on what was imported
    if (environmentCreated) {
      result.warnings.push(
        `Collection variables imported as environment "${collectionName} Variables". ` +
        "Select this environment to use the variables."
      );
    }

    if (hasScripts) {
      if (scriptsWereNormalized) {
        result.warnings.push(
          "Scripts normalized: pm.globals, pm.collectionVariables, and pm.variables " +
          "have been converted to pm.environment for compatibility."
        );
      }
      result.warnings.push(
        "Note: Sendr supports pm.environment, pm.response, pm.test, and pm.expect. " +
        "Other Postman APIs (pm.sendRequest, pm.cookies, etc.) are not supported."
      );
    }
  } catch (err) {
    result.errors.push(`Failed to create collection: ${err}`);
    result.success = false;
  }

  return result;
}

/**
 * Check if any items in the collection have scripts
 */
function checkForScripts(items: PostmanItem[]): boolean {
  for (const item of items) {
    if (item.event && item.event.length > 0) {
      for (const event of item.event) {
        if (event.script?.exec && event.script.exec.length > 0) {
          const code = event.script.exec.join("\n");
          if (code.trim().length > 0) {
            return true;
          }
        }
      }
    }
    if (item.item && checkForScripts(item.item)) {
      return true;
    }
  }
  return false;
}

/**
 * Normalize Postman script variable APIs to use pm.environment
 * Converts pm.globals.*, pm.collectionVariables.*, and pm.variables.* to pm.environment.*
 */
function normalizeScriptVariables(script: string): { normalized: string; wasTransformed: boolean } {
  if (!script || !script.trim()) {
    return { normalized: script, wasTransformed: false };
  }

  let wasTransformed = false;
  let normalized = script;

  // Replace pm.globals.get("key") or pm.globals.get('key') with pm.environment.get("key")
  normalized = normalized.replace(
    /pm\.globals\.get\s*\(\s*(['"`])([^'"`]+)\1\s*\)/g,
    (match, quote, key) => {
      wasTransformed = true;
      return `pm.environment.get(${quote}${key}${quote})`;
    }
  );

  // Replace pm.globals.set("key", value) with pm.environment.set("key", value)
  normalized = normalized.replace(
    /pm\.globals\.set\s*\(/g,
    () => {
      wasTransformed = true;
      return 'pm.environment.set(';
    }
  );

  // Replace pm.collectionVariables.get("key") with pm.environment.get("key")
  normalized = normalized.replace(
    /pm\.collectionVariables\.get\s*\(\s*(['"`])([^'"`]+)\1\s*\)/g,
    (match, quote, key) => {
      wasTransformed = true;
      return `pm.environment.get(${quote}${key}${quote})`;
    }
  );

  // Replace pm.collectionVariables.set("key", value) with pm.environment.set("key", value)
  normalized = normalized.replace(
    /pm\.collectionVariables\.set\s*\(/g,
    () => {
      wasTransformed = true;
      return 'pm.environment.set(';
    }
  );

  // Replace pm.variables.get("key") with pm.environment.get("key")
  // Note: pm.variables.get is read-only in Postman but we normalize it anyway
  normalized = normalized.replace(
    /pm\.variables\.get\s*\(\s*(['"`])([^'"`]+)\1\s*\)/g,
    (match, quote, key) => {
      wasTransformed = true;
      return `pm.environment.get(${quote}${key}${quote})`;
    }
  );

  // Replace pm.variables.set (though it doesn't exist in Postman, handle it just in case)
  normalized = normalized.replace(
    /pm\.variables\.set\s*\(/g,
    () => {
      wasTransformed = true;
      return 'pm.environment.set(';
    }
  );

  return { normalized, wasTransformed };
}

/**
 * Recursively process Postman items (requests and folders)
 * Returns true if any scripts were normalized during processing
 */
async function processPostmanItems(
  items: PostmanItem[],
  collectionId: string,
  result: ImportResult,
  prefix: string
): Promise<boolean> {
  let anyScriptsNormalized = false;

  for (const item of items) {
    if (item.item) {
      // It's a folder, process nested items with prefix
      const folderPrefix = prefix ? `${prefix}/${item.name}` : item.name;
      const normalized = await processPostmanItems(item.item, collectionId, result, folderPrefix);
      if (normalized) anyScriptsNormalized = true;
    } else if (item.request) {
      // It's a request
      try {
        const { request, scriptsWereNormalized } = convertPostmanRequest(item, prefix);
        if (scriptsWereNormalized) anyScriptsNormalized = true;
        await db.requests.add({
          id: generateUUID(),
          collectionId,
          ...request,
        });
        result.requestsImported++;
      } catch (err) {
        result.errors.push(`Failed to import request "${item.name}": ${err}`);
      }
    }
  }

  return anyScriptsNormalized;
}

/**
 * Convert a Postman request to Sendr format
 */
function convertPostmanRequest(
  item: PostmanItem,
  prefix: string
): { request: Omit<SavedRequest, "id" | "collectionId">; scriptsWereNormalized: boolean } {
  const postmanReq = item.request!;
  const name = prefix ? `${prefix}/${item.name}` : item.name;

  // Extract URL
  let url = "";
  let params: { key: string; value: string; active: boolean }[] = [];

  if (typeof postmanReq.url === "string") {
    url = postmanReq.url;
  } else if (postmanReq.url) {
    url = postmanReq.url.raw || "";
    if (postmanReq.url.query) {
      params = postmanReq.url.query.map((q) => ({
        key: q.key,
        value: q.value,
        active: !q.disabled,
      }));
    }
  }

  // Extract headers
  const headers = (postmanReq.header || []).map((h) => ({
    key: h.key,
    value: h.value,
    active: !h.disabled,
  }));

  // Extract body
  const body = convertPostmanBody(postmanReq.body);

  // Extract auth
  const auth = convertPostmanAuth(postmanReq.auth);

  // Extract and normalize scripts
  let preRequestScript = "";
  let testScript = "";
  let scriptsWereNormalized = false;

  if (item.event) {
    for (const event of item.event) {
      if (event.listen === "prerequest" && event.script?.exec) {
        const raw = event.script.exec.join("\n");
        const { normalized, wasTransformed } = normalizeScriptVariables(raw);
        preRequestScript = normalized;
        if (wasTransformed) scriptsWereNormalized = true;
      } else if (event.listen === "test" && event.script?.exec) {
        const raw = event.script.exec.join("\n");
        const { normalized, wasTransformed } = normalizeScriptVariables(raw);
        testScript = normalized;
        if (wasTransformed) scriptsWereNormalized = true;
      }
    }
  }

  // Map method
  const method = (postmanReq.method?.toUpperCase() || "GET") as SavedRequest["method"];
  const validMethods = ["GET", "POST", "PUT", "DELETE", "PATCH"];
  const finalMethod = validMethods.includes(method) ? method : "GET";

  return {
    request: {
      name,
      method: finalMethod as SavedRequest["method"],
      url,
      headers,
      params,
      body,
      auth,
      preRequestScript,
      testScript,
    },
    scriptsWereNormalized,
  };
}

/**
 * Convert Postman body to Sendr format
 */
function convertPostmanBody(body?: PostmanBody): RequestBody {
  if (!body) {
    return { mode: "none", raw: "", formData: [] };
  }

  switch (body.mode) {
    case "raw":
      const language = body.options?.raw?.language?.toLowerCase();
      let mode: RequestBody["mode"] = "raw";
      if (language === "json") mode = "json";
      else if (language === "xml") mode = "xml";
      return {
        mode,
        raw: body.raw || "",
        formData: [],
      };

    case "urlencoded":
      return {
        mode: "x-www-form-urlencoded",
        raw: "",
        formData: (body.urlencoded || []).map((item) => ({
          key: item.key,
          value: item.value,
          active: !item.disabled,
        })),
      };

    case "formdata":
      return {
        mode: "form-data",
        raw: "",
        formData: (body.formdata || [])
          .filter((item) => item.type !== "file") // Skip file uploads
          .map((item) => ({
            key: item.key,
            value: item.value,
            active: !item.disabled,
          })),
      };

    default:
      return { mode: "none", raw: "", formData: [] };
  }
}

/**
 * Convert Postman auth to Sendr format
 */
function convertPostmanAuth(auth?: PostmanAuth): RequestAuth {
  const defaultAuth = createDefaultAuth();

  if (!auth || auth.type === "noauth") {
    return defaultAuth;
  }

  if (auth.type === "bearer" && auth.bearer) {
    const token = auth.bearer.find((b) => b.key === "token")?.value || "";
    return {
      ...defaultAuth,
      type: "bearer",
      bearer: {
        token,
        headerKey: "Authorization",
        prefix: "Bearer",
      },
    };
  }

  if (auth.type === "basic" && auth.basic) {
    const username = auth.basic.find((b) => b.key === "username")?.value || "";
    const password = auth.basic.find((b) => b.key === "password")?.value || "";
    return {
      ...defaultAuth,
      type: "basic",
      basic: {
        username,
        password,
        headerKey: "Authorization",
      },
    };
  }

  if (auth.type === "apikey" && auth.apikey) {
    const key = auth.apikey.find((a) => a.key === "key")?.value || "";
    const value = auth.apikey.find((a) => a.key === "value")?.value || "";
    const inHeader = auth.apikey.find((a) => a.key === "in")?.value !== "query";
    return {
      ...defaultAuth,
      type: "apikey",
      apikey: {
        key,
        value,
        addTo: inHeader ? "header" : "query",
      },
    };
  }

  return defaultAuth;
}

/**
 * Create default auth object
 */
function createDefaultAuth(): RequestAuth {
  return {
    type: "none",
    bearer: { token: "", headerKey: "Authorization", prefix: "Bearer" },
    basic: { username: "", password: "", headerKey: "Authorization" },
    apikey: { key: "", value: "", addTo: "header" },
  };
}

// ============================================================================
// Detection and Parsing
// ============================================================================

export type ImportFormat = "sendr" | "postman" | "unknown";

/**
 * Detect the format of an imported file
 */
export function detectImportFormat(data: unknown): ImportFormat {
  if (!data || typeof data !== "object") {
    return "unknown";
  }

  const obj = data as Record<string, unknown>;

  // Check for Sendr format
  if (obj.version && obj.collections && Array.isArray(obj.collections)) {
    return "sendr";
  }

  // Check for Postman format
  if (obj.info && typeof obj.info === "object") {
    const info = obj.info as Record<string, unknown>;
    if (typeof info.schema === "string" && info.schema.includes("collection.json")) {
      return "postman";
    }
  }

  return "unknown";
}

/**
 * Import from JSON file (auto-detects format)
 */
export async function importFromJson(jsonString: string): Promise<ImportResult> {
  try {
    const data = JSON.parse(jsonString);
    const format = detectImportFormat(data);

    switch (format) {
      case "sendr":
        return await importFromSendrJson(data as SendrExportFormat);
      case "postman":
        return await importFromPostman(data as PostmanCollection);
      default:
        return {
          success: false,
          collectionsImported: 0,
          requestsImported: 0,
          errors: ["Unknown file format. Please provide a Sendr or Postman collection."],
          warnings: [],
        };
    }
  } catch (err) {
    return {
      success: false,
      collectionsImported: 0,
      requestsImported: 0,
      errors: [`Failed to parse JSON: ${err}`],
      warnings: [],
    };
  }
}
