# Features

[Back to main documentation](../CLAUDE.md)

---

## Passthrough Proxy

- **HTTP Endpoint:** `POST /api/proxy`
- **gRPC Endpoint:** `POST /api/grpc-proxy`
- **Body Types:** JSON, XML, raw text, form-data (multipart), x-www-form-urlencoded
- **Error Handling:** Network errors returned as JSON, not 500 errors

---

## Variable Interpolation

- **Syntax:** `{{variable_name}}`
- **Applies to:** URL, Headers, Params, Body, Scripts
- **Workflow Scope:** Variables set in Request A available in Request B
- **Recursive:** Variables can contain other variables (max depth: 10)
- **Whitespace:** Tolerant of spaces inside braces: `{{ variable }}`

---

## Scripting Sandbox

Sandboxed `pm` API mimicking Postman:

```javascript
// Environment Variables
pm.environment.get(key)           // Get variable
pm.environment.set(key, value)    // Set variable

// Response (test scripts only)
pm.response.json()                // Get response as JSON
pm.response.text()                // Get response as text
pm.response.status                // HTTP status code
pm.response.headers               // Response headers

// Testing
pm.test(name, callback)           // Define test assertion
pm.expect(value)                  // Chai assertion

// gRPC-specific (test scripts only)
pm.response.metadata(key)         // Get gRPC response metadata
pm.response.trailers(key)         // Get gRPC trailers
pm.response.grpcStatus            // { code, details }

// Console
console.log(...)                  // Log output (visible in results)
console.error(...)
console.warn(...)
```

---

## Collection Management

- Sidebar tree view (Collections → Requests)
- Create/Delete Collections and Requests
- Auto-save changes to IndexedDB
- Click to load request into editor
- Drag and drop reordering (future)

---

## Workflow Runner

- Sequential execution of all requests in a collection
- Supports both HTTP and gRPC requests
- Variable chaining between requests
- Progress bar and expandable results
- Test pass/fail indicators and console logs
- Stop on error option
- Configurable delay between requests

---

## Request Body Types

| Mode | Description |
|------|-------------|
| none | No body |
| json | JSON with syntax highlighting |
| xml | XML with syntax highlighting |
| form-data | multipart/form-data (key-value) |
| x-www-form-urlencoded | URL encoded form data |
| raw | Plain text |

---

## Authentication

| Type | Description |
|------|-------------|
| None | No authentication |
| Bearer Token | Token-based auth with customizable header name and prefix |
| Basic Auth | Username/password with customizable header name |
| API Key | Key-value pair added to header or query params |

**Features:**
- Customizable header key (e.g., use "X-Auth-Token" instead of "Authorization")
- Customizable prefix for Bearer tokens (e.g., "Bearer", "Token", or none)
- API Key can be added to header or query parameters
- All fields support variable interpolation (`{{variable}}`)
- Auth applied in both manual requests and workflow runner
- For gRPC, auth is converted to metadata headers

---

## Response Tabs

### HTTP Response Tabs

| Tab | Description |
|-----|-------------|
| Rendered | Auto-generated UI based on JSON structure (default) |
| Body | Formatted JSON response with syntax highlighting |
| Headers | Table view of all response headers with header count badge |
| Cookies | Parsed Set-Cookie headers showing name, value, and attributes |
| Raw | Unformatted response text with word wrap enabled |

### gRPC Response Tabs

| Tab | Description |
|-----|-------------|
| Rendered | Auto-generated UI based on JSON structure (default) |
| Message | Formatted JSON response with syntax highlighting |
| Metadata | gRPC response metadata key-value table |
| Trailers | gRPC trailers key-value table |
| Raw | Unformatted response text |

---

## Response Visualizer

Auto-generates a representable UI for JSON responses based on data structure analysis.

| View Type | When Used |
|-----------|-----------|
| Table | Arrays of objects - displays data in sortable columns |
| Cards | Arrays with title/subtitle fields - displays as card grid |
| List | Arrays of primitives - displays as simple list |
| Key-Value | Single objects - displays as property table |

**Features:**
- Auto-detects data types (string, number, boolean, date, URL, image)
- Configurable root path for nested data (e.g., `data.items`)
- Column visibility toggle
- Templates saved per-request and reused for subsequent responses
- Smart type rendering: URLs are clickable, images show previews, dates are formatted

---

## Import/Export

### Supported Formats

| Format | Import | Export |
|--------|--------|--------|
| Sendr JSON | Yes | Yes |
| Postman Collection v2.1 | Yes | No |

### Sendr JSON Format

```typescript
interface SendrExportFormat {
  version: "1.0";
  exportedAt: string;
  collections: {
    name: string;
    requests: {
      name: string;
      method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
      url: string;
      headers: { key: string; value: string; active: boolean }[];
      params: { key: string; value: string; active: boolean }[];
      body: RequestBody;
      auth: RequestAuth;
      preRequestScript: string;
      testScript: string;
    }[];
  }[];
}
```

### Postman Import Support

- Supports Postman Collection v2.1 schema
- Converts request body (raw JSON/XML, form-data, urlencoded)
- Converts authentication (Bearer, Basic, API Key)
- Imports pre-request and test scripts (with automatic normalization)
- Handles nested folders (flattened with path prefix)
- **Collection variables** are imported as a Sendr environment (named "{Collection Name} Variables")

### Script Compatibility

Postman scripts are imported with **automatic variable API normalization**:

| Postman API | Sendr Support |
|-------------|---------------|
| `pm.environment.get/set` | Supported |
| `pm.response.json()` | Supported |
| `pm.response.code/status/headers` | Supported |
| `pm.test(name, fn)` | Supported |
| `pm.expect()` (Chai assertions) | Supported |
| `console.log/error/warn` | Supported |
| `pm.globals.get/set` | **Normalized** → `pm.environment.get/set` |
| `pm.collectionVariables.get/set` | **Normalized** → `pm.environment.get/set` |
| `pm.variables.get` | **Normalized** → `pm.environment.get` |
| `pm.request.*` | Not supported |
| `pm.sendRequest()` | Not supported |
| `pm.cookies.*` | Not supported |
| `pm.iterationData.*` | Not supported |

### Variable Normalization

During import, Sendr automatically transforms Postman's different variable scopes into the unified `pm.environment` API:

```javascript
// Postman script (before import)
pm.globals.set("token", response.token);
pm.collectionVariables.get("baseUrl");
pm.variables.get("userId");

// Sendr script (after import)
pm.environment.set("token", response.token);
pm.environment.get("baseUrl");
pm.environment.get("userId");
```

**Benefits:**
- Collection variables are imported as a Sendr environment
- Scripts using `pm.globals`, `pm.collectionVariables`, or `pm.variables` work without modification
- A warning is shown during import when scripts are normalized

**Note:** Select the imported environment ("{Collection Name} Variables") to use the collection's variables.

### Usage

1. Click the upload icon (↑) in the Sidebar header
2. **Import:** Drag and drop a JSON file or click to browse
3. **Export:** Select collections to export (or all) and click "Export to JSON"

### Files

- `src/lib/importExport.ts` - Import/export utilities
- `src/components/ImportExportModal.tsx` - UI modal
