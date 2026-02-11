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
  environments?: SendrExportEnvironment[];
}

export interface SendrExportEnvironment {
  name: string;
  variables: Record<string, string>;
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
  event?: PostmanEvent[]; // Collection-level scripts
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

export interface ExportOptions {
  collectionIds?: string[];
  environmentIds?: string[];
  includeEnvironments?: boolean;
}

/**
 * Export collections and environments to Sendr JSON format
 */
export async function exportToJson(options?: ExportOptions | string[]): Promise<SendrExportFormat> {
  // Handle legacy API: exportToJson(collectionIds?: string[])
  let collectionIds: string[] | undefined;
  let environmentIds: string[] | undefined;
  let includeEnvironments = true;

  if (Array.isArray(options)) {
    // Legacy: passed array of collection IDs
    collectionIds = options.length > 0 ? options : undefined;
  } else if (options) {
    collectionIds = options.collectionIds;
    environmentIds = options.environmentIds;
    includeEnvironments = options.includeEnvironments !== false;
  }

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

  // Export environments
  if (includeEnvironments) {
    let environments;
    if (environmentIds && environmentIds.length > 0) {
      environments = await db.environments
        .where("id")
        .anyOf(environmentIds)
        .toArray();
    } else {
      environments = await db.environments.toArray();
    }

    if (environments.length > 0) {
      exportData.environments = environments.map((env) => ({
        name: env.name,
        variables: env.variables,
      }));
    }
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
  environmentsImported: number;
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
    environmentsImported: 0,
    errors: [],
    warnings: [],
  };

  if (data.version !== "1.0") {
    result.warnings.push(`Unknown version "${data.version}", attempting import anyway`);
  }

  // Import collections
  const collections = data.collections || [];
  for (const collection of collections) {
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

  // Import environments
  if (data.environments && data.environments.length > 0) {
    for (const env of data.environments) {
      try {
        await db.environments.add({
          id: generateUUID(),
          name: env.name,
          variables: env.variables || {},
        });
        result.environmentsImported++;
      } catch (err) {
        result.errors.push(`Failed to import environment "${env.name}": ${err}`);
      }
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
    environmentsImported: 0,
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

  // Extract collection-level scripts
  const collectionScripts = extractScriptsFromEvents(data.event);
  const hasCollectionScripts = !!(collectionScripts.preRequest.trim() || collectionScripts.test.trim());

  // Check if collection has scripts at any level
  const hasScripts = checkForScripts(data.item) || hasCollectionScripts;

  // Track unsupported APIs found
  const unsupportedApisFound = new Set<string>();

  // Check collection-level scripts for unsupported APIs
  detectUnsupportedApis(collectionScripts.preRequest).forEach(api => unsupportedApisFound.add(api));
  detectUnsupportedApis(collectionScripts.test).forEach(api => unsupportedApisFound.add(api));

  try {
    await db.collections.add({
      id: collectionId,
      name: collectionName,
      createdAt: Date.now(),
    });
    result.collectionsImported++;

    // Build inherited scripts context
    const inheritedScripts: InheritedScripts = {
      collectionName,
      collectionPreRequest: collectionScripts.preRequest,
      collectionTest: collectionScripts.test,
      folderScripts: [],
    };

    // Recursively process items (handles folders) and track if scripts were normalized
    const processResult = await processPostmanItems(
      data.item,
      collectionId,
      result,
      "",
      inheritedScripts,
      unsupportedApisFound
    );

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
        result.environmentsImported++;
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

    // Warning about collection/folder level scripts being merged
    if (hasCollectionScripts || processResult.hasFolderScripts) {
      const scriptSources: string[] = [];
      if (hasCollectionScripts) scriptSources.push("collection");
      if (processResult.hasFolderScripts) scriptSources.push("folder");

      result.warnings.push(
        `Scripts from ${scriptSources.join(" and ")} level(s) have been merged into individual requests. ` +
        "Each request now contains the combined scripts with clear comments marking the source. " +
        "Please review each request and remove any scripts that are not needed for that specific request."
      );
    }

    if (hasScripts) {
      if (processResult.scriptsWereNormalized) {
        result.warnings.push(
          "Scripts normalized: pm.globals, pm.collectionVariables, and pm.variables " +
          "have been converted to pm.environment for compatibility."
        );
      }
    }

    // Warning about unsupported Postman APIs
    if (unsupportedApisFound.size > 0) {
      const apiList = Array.from(unsupportedApisFound).join(", ");
      result.warnings.push(
        `⚠️ UNSUPPORTED POSTMAN APIs DETECTED: ${apiList}. ` +
        "These APIs are not supported in Sendr and will cause errors. " +
        "Please review your scripts and remove or replace these calls before running requests."
      );
    }
  } catch (err) {
    result.errors.push(`Failed to create collection: ${err}`);
    result.success = false;
  }

  return result;
}

/**
 * Inherited scripts context passed down during import
 */
interface InheritedScripts {
  collectionName: string;
  collectionPreRequest: string;
  collectionTest: string;
  folderScripts: Array<{
    folderName: string;
    preRequest: string;
    test: string;
  }>;
}

/**
 * Result from processing Postman items
 */
interface ProcessResult {
  scriptsWereNormalized: boolean;
  hasFolderScripts: boolean;
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
 * Unsupported Postman Sandbox APIs that we detect and warn about
 */
const UNSUPPORTED_POSTMAN_APIS = [
  { pattern: /new\s+Postman\s*\(/g, name: "new Postman()" },
  { pattern: /pm\.sendRequest\s*\(/g, name: "pm.sendRequest()" },
  { pattern: /pm\.visualizer\./g, name: "pm.visualizer" },
  { pattern: /pm\.execution\./g, name: "pm.execution" },
  { pattern: /pm\.cookies\./g, name: "pm.cookies" },
  { pattern: /pm\.vault\./g, name: "pm.vault" },
  { pattern: /postman\.setNextRequest\s*\(/g, name: "postman.setNextRequest()" },
  { pattern: /postman\.getResponseHeader\s*\(/g, name: "postman.getResponseHeader()" },
  { pattern: /postman\.getResponseCookie\s*\(/g, name: "postman.getResponseCookie()" },
  { pattern: /require\s*\(\s*['"`]/g, name: "require()" },
  { pattern: /pm\.iterationData\./g, name: "pm.iterationData" },
];

/**
 * Detect unsupported Postman Sandbox APIs in a script
 * Returns list of detected unsupported API names
 */
function detectUnsupportedApis(script: string): string[] {
  if (!script || !script.trim()) return [];

  const detected: string[] = [];
  for (const api of UNSUPPORTED_POSTMAN_APIS) {
    if (api.pattern.test(script)) {
      detected.push(api.name);
      // Reset regex lastIndex for global patterns
      api.pattern.lastIndex = 0;
    }
  }
  return detected;
}

/**
 * Extract pre-request and test scripts from Postman events
 */
function extractScriptsFromEvents(events?: PostmanEvent[]): { preRequest: string; test: string } {
  let preRequest = "";
  let test = "";

  if (events) {
    for (const event of events) {
      if (event.listen === "prerequest" && event.script?.exec) {
        preRequest = event.script.exec.join("\n");
      } else if (event.listen === "test" && event.script?.exec) {
        test = event.script.exec.join("\n");
      }
    }
  }

  return { preRequest, test };
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
    (_match, quote, key) => {
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
    (_match, quote, key) => {
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
    (_match, quote, key) => {
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
 * Returns processing result with flags for normalization and folder scripts
 */
async function processPostmanItems(
  items: PostmanItem[],
  collectionId: string,
  result: ImportResult,
  prefix: string,
  inheritedScripts: InheritedScripts,
  unsupportedApisFound: Set<string>
): Promise<ProcessResult> {
  let anyScriptsNormalized = false;
  let hasFolderScripts = false;

  for (const item of items) {
    // Clean the item name - trim whitespace and handle special characters
    const itemName = (item.name || "").trim();

    if (item.item && item.item.length > 0) {
      // It's a folder with nested items
      const folderName = itemName || "Unnamed Folder";
      const folderPrefix = prefix ? `${prefix}/${folderName}` : folderName;

      // Extract folder-level scripts
      const folderScripts = extractScriptsFromEvents(item.event);
      const thisFolderHasScripts = !!(folderScripts.preRequest.trim() || folderScripts.test.trim());

      if (thisFolderHasScripts) {
        hasFolderScripts = true;
        // Check for unsupported APIs in folder scripts
        detectUnsupportedApis(folderScripts.preRequest).forEach(api => unsupportedApisFound.add(api));
        detectUnsupportedApis(folderScripts.test).forEach(api => unsupportedApisFound.add(api));
      }

      // Build inherited scripts for this folder's children
      const childInheritedScripts: InheritedScripts = {
        ...inheritedScripts,
        folderScripts: [
          ...inheritedScripts.folderScripts,
          ...(thisFolderHasScripts ? [{
            folderName,
            preRequest: folderScripts.preRequest,
            test: folderScripts.test,
          }] : []),
        ],
      };

      const childResult = await processPostmanItems(
        item.item,
        collectionId,
        result,
        folderPrefix,
        childInheritedScripts,
        unsupportedApisFound
      );

      if (childResult.scriptsWereNormalized) anyScriptsNormalized = true;
      if (childResult.hasFolderScripts) hasFolderScripts = true;
    } else if (item.request) {
      // It's a request
      try {
        const { request, scriptsWereNormalized } = convertPostmanRequest(
          item,
          prefix,
          inheritedScripts,
          unsupportedApisFound
        );
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
    // Note: Items with neither item[] nor request are skipped (empty folders or malformed data)
  }

  return { scriptsWereNormalized: anyScriptsNormalized, hasFolderScripts };
}

/**
 * Build a merged script with inherited scripts and clear comments
 */
function buildMergedScript(
  scriptType: "Pre-request" | "Test",
  inheritedScripts: InheritedScripts,
  requestScript: string
): string {
  const parts: string[] = [];
  const collectionScript = scriptType === "Pre-request"
    ? inheritedScripts.collectionPreRequest
    : inheritedScripts.collectionTest;

  // Add collection-level script
  if (collectionScript.trim()) {
    parts.push(
      `// ╔════════════════════════════════════════════════════════════════════╗`,
      `// ║ ${scriptType} Script from Collection: "${inheritedScripts.collectionName}"`,
      `// ║ NOTE: This script was copied during import. Review and remove if`,
      `// ║       not needed for this specific request.`,
      `// ╚════════════════════════════════════════════════════════════════════╝`,
      collectionScript,
      ``
    );
  }

  // Add folder-level scripts (in order from root to deepest)
  for (const folder of inheritedScripts.folderScripts) {
    const folderScript = scriptType === "Pre-request" ? folder.preRequest : folder.test;
    if (folderScript.trim()) {
      parts.push(
        `// ╔════════════════════════════════════════════════════════════════════╗`,
        `// ║ ${scriptType} Script from Folder: "${folder.folderName}"`,
        `// ║ NOTE: This script was copied during import. Review and remove if`,
        `// ║       not needed for this specific request.`,
        `// ╚════════════════════════════════════════════════════════════════════╝`,
        folderScript,
        ``
      );
    }
  }

  // Add request-level script
  if (requestScript.trim()) {
    if (parts.length > 0) {
      // Only add header if there were inherited scripts
      parts.push(
        `// ╔════════════════════════════════════════════════════════════════════╗`,
        `// ║ ${scriptType} Script for this Request`,
        `// ╚════════════════════════════════════════════════════════════════════╝`,
        requestScript
      );
    } else {
      parts.push(requestScript);
    }
  }

  return parts.join("\n");
}

/**
 * Convert a Postman request to Sendr format
 */
function convertPostmanRequest(
  item: PostmanItem,
  prefix: string,
  inheritedScripts: InheritedScripts,
  unsupportedApisFound: Set<string>
): { request: Omit<SavedRequest, "id" | "collectionId">; scriptsWereNormalized: boolean } {
  const postmanReq = item.request!;
  // Clean request name - trim whitespace
  const itemName = (item.name || "Unnamed Request").trim();
  // Build full path name with folder prefix
  const name = prefix ? `${prefix}/${itemName}` : itemName;

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

  // Extract and normalize request-level scripts
  let requestPreRequestScript = "";
  let requestTestScript = "";
  let scriptsWereNormalized = false;

  if (item.event) {
    for (const event of item.event) {
      if (event.listen === "prerequest" && event.script?.exec) {
        const raw = event.script.exec.join("\n");
        const { normalized, wasTransformed } = normalizeScriptVariables(raw);
        requestPreRequestScript = normalized;
        if (wasTransformed) scriptsWereNormalized = true;
        // Check for unsupported APIs
        detectUnsupportedApis(raw).forEach(api => unsupportedApisFound.add(api));
      } else if (event.listen === "test" && event.script?.exec) {
        const raw = event.script.exec.join("\n");
        const { normalized, wasTransformed } = normalizeScriptVariables(raw);
        requestTestScript = normalized;
        if (wasTransformed) scriptsWereNormalized = true;
        // Check for unsupported APIs
        detectUnsupportedApis(raw).forEach(api => unsupportedApisFound.add(api));
      }
    }
  }

  // Build merged scripts with inherited collection/folder scripts
  const preRequestScript = buildMergedScript("Pre-request", inheritedScripts, requestPreRequestScript);
  const testScript = buildMergedScript("Test", inheritedScripts, requestTestScript);

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

  // Check for Sendr format (collections and/or environments)
  if (obj.version && (
    (obj.collections && Array.isArray(obj.collections)) ||
    (obj.environments && Array.isArray(obj.environments))
  )) {
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
          environmentsImported: 0,
          errors: ["Unknown file format. Please provide a Sendr or Postman collection."],
          warnings: [],
        };
    }
  } catch (err) {
    return {
      success: false,
      collectionsImported: 0,
      requestsImported: 0,
      environmentsImported: 0,
      errors: [`Failed to parse JSON: ${err}`],
      warnings: [],
    };
  }
}
