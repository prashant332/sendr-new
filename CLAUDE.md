# Sendr - Web-Based API Client

This file serves as the single source of truth for product requirements, technical documentation, and progress tracking.

---

## 1. Project Overview

**Sendr** is a browser-based API testing tool (similar to Postman) that uses a "Passthrough Proxy" architecture to bypass CORS restrictions.

**Goal:** Build a browser-based API testing tool with request organization (Collections) and automated workflow testing (Runner).

**Core Constraint:** Browsers cannot make direct cross-origin requests to arbitrary APIs due to CORS. The solution uses a server-side proxy.

**Target User:** Developers who need to test APIs and validate complex API chains without installing local software.

---

## 2. Technical Architecture

### 2.1 High-Level Architecture
1. **Client (Frontend):** Handles UI, state management, script sandboxing, and workflow execution logic.
2. **Server (Proxy):** Next.js API route acting as HTTP Agent - forwards requests to target APIs and returns responses.
3. **Persistence Layer:** IndexedDB via Dexie.js - stores Collections, Requests, Environments, and Settings locally.

### 2.2 Technology Stack
| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16 (App Router), React, TypeScript |
| Styling | Tailwind CSS |
| State Management | Zustand (with IndexedDB persistence) |
| Storage | Dexie.js (IndexedDB wrapper) |
| Code Editor | @monaco-editor/react |
| HTTP Client | axios (server-side) |
| Scripting | Function constructor with sandboxed `pm` API |

### 2.3 Passthrough Proxy Pattern
All API requests go through `/api/proxy`. The proxy:
1. Receives request details (method, url, headers, body)
2. Strips browser-restricted headers (Host, Origin, Referer)
3. Handles different body types (JSON, XML, form-data, x-www-form-urlencoded)
4. Executes HTTP call server-side with axios
5. Returns response with timing and size metadata

---

## 3. Development

### 3.1 Commands
```bash
npm run dev      # Start development server (http://localhost:3000)
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

### 3.2 Project Structure
```
src/
├── app/
│   ├── api/proxy/route.ts    # Proxy API endpoint
│   └── page.tsx              # Main UI component
├── components/
│   ├── AuthEditor.tsx        # Authentication configuration editor
│   ├── BodyEditor.tsx        # Request body editor with mode selector
│   ├── ResponseVisualizer.tsx # Auto-generated response UI renderer
│   ├── KeyValueEditor.tsx    # Reusable key-value pair editor
│   ├── Sidebar.tsx           # Collections tree view
│   ├── WorkflowRunner.tsx    # Collection runner UI
│   ├── EnvironmentSelector.tsx
│   ├── EnvironmentManager.tsx
│   ├── CreateCollectionModal.tsx
│   └── SaveRequestModal.tsx
├── hooks/
│   └── useCollections.ts     # CRUD hooks for collections/requests
├── lib/
│   ├── db.ts                 # Dexie database schema
│   ├── interpolate.ts        # Variable interpolation
│   ├── scriptRunner.ts       # Script execution with pm API
│   └── workflowRunner.ts     # Collection runner engine
└── store/
    └── environmentStore.ts   # Zustand store (IndexedDB persisted)
```

---

## 4. Data Models

### 4.1 Environment
```typescript
interface Environment {
  id: string;
  name: string;
  variables: Record<string, string>;
}
```

### 4.2 Collection & Request
```typescript
interface Collection {
  id: string;
  name: string;
  createdAt: number;
}

type BodyMode = "none" | "json" | "xml" | "form-data" | "x-www-form-urlencoded" | "raw";

interface RequestBody {
  mode: BodyMode;
  raw: string;
  formData: { key: string; value: string; active: boolean }[];
}

type AuthType = "none" | "bearer" | "basic" | "apikey";

interface RequestAuth {
  type: AuthType;
  bearer: {
    token: string;
    headerKey: string;   // Customizable, defaults to "Authorization"
    prefix: string;      // Customizable, defaults to "Bearer"
  };
  basic: {
    username: string;
    password: string;
    headerKey: string;   // Customizable, defaults to "Authorization"
  };
  apikey: {
    key: string;
    value: string;
    addTo: "header" | "query";
  };
}

interface ResponseTemplate {
  enabled: boolean;
  viewType: "auto" | "table" | "cards" | "list" | "keyvalue";
  rootPath: string;
  columns: { key: string; label: string; visible: boolean; type: string }[];
  cardTitleField?: string;
  cardSubtitleField?: string;
}

interface SavedRequest {
  id: string;
  collectionId: string;
  name: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  url: string;
  headers: { key: string; value: string; active: boolean }[];
  params: { key: string; value: string; active: boolean }[];
  body: RequestBody;
  auth: RequestAuth;
  preRequestScript: string;
  testScript: string;
  responseTemplate?: ResponseTemplate;
}
```

### 4.3 Workflow Runner
```typescript
interface RunnerConfig {
  collectionId: string;
  initialVariables: Record<string, string>;
  delay: number;
  stopOnError: boolean;
}

interface RequestResult {
  requestId: string;
  requestName: string;
  method: string;
  url: string;
  statusCode: number;
  statusText: string;
  duration: number;
  testResults: { name: string; passed: boolean; error?: string }[];
  logs: string[];
  error?: string;
}

interface RunSummary {
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
```

---

## 5. Features

### 5.1 Passthrough Proxy
- **Endpoint:** `POST /api/proxy`
- **Body Types:** JSON, XML, raw text, form-data (multipart), x-www-form-urlencoded
- **Error Handling:** Network errors returned as JSON, not 500 errors

### 5.2 Variable Interpolation
- **Syntax:** `{{variable_name}}`
- **Applies to:** URL, Headers, Params, Body
- **Workflow Scope:** Variables set in Request A available in Request B

### 5.3 Scripting Sandbox
Sandboxed `pm` API mimicking Postman:
```javascript
pm.environment.get(key)           // Get variable
pm.environment.set(key, value)    // Set variable
pm.response.json()                // Get response (test scripts only)
pm.test(name, callback)           // Define test assertion
```

### 5.4 Collection Management
- Sidebar tree view (Collections → Requests)
- Create/Delete Collections and Requests
- Auto-save changes to IndexedDB
- Click to load request into editor

### 5.5 Workflow Runner
- Sequential execution of all requests in a collection
- Variable chaining between requests
- Progress bar and expandable results
- Test pass/fail indicators and console logs

### 5.6 Request Body Types
| Mode | Description |
|------|-------------|
| none | No body |
| json | JSON with syntax highlighting |
| xml | XML with syntax highlighting |
| form-data | multipart/form-data (key-value) |
| x-www-form-urlencoded | URL encoded form data |
| raw | Plain text |

### 5.7 Authentication
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

### 5.8 Response Tabs
| Tab | Description |
|-----|-------------|
| Rendered | Auto-generated UI based on JSON structure (default) |
| Body | Formatted JSON response with syntax highlighting |
| Headers | Table view of all response headers with header count badge |
| Cookies | Parsed Set-Cookie headers showing name, value, and attributes |
| Raw | Unformatted response text with word wrap enabled |

### 5.9 Response Visualizer
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

## 6. Implementation Progress

### Phase 1: Skeleton & Proxy (MVP) ✅
- [x] Next.js project with TypeScript and Tailwind
- [x] Proxy API route at `/api/proxy`
- [x] Basic UI (URL bar, Method select, Send button, Response display)

### Phase 2: Editor Experience ✅
- [x] Monaco Editor for Body and Response
- [x] Tabs (Params, Headers, Body, Scripts)
- [x] KeyValueEditor component

### Phase 3: Environment Variables ✅
- [x] Zustand store for environments
- [x] Environment selector dropdown
- [x] Environment manager modal (CRUD)
- [x] Variable interpolation (`{{key}}` replacement)

### Phase 4: Scripting Engine ✅
- [x] Script runner with `pm` API
- [x] Pre-request and test script editors
- [x] Test results display

### Phase 5: Collections ✅
- [x] Dexie.js database setup
- [x] Sidebar with collections tree
- [x] Create Collection / Save Request modals
- [x] Load request from sidebar
- [x] Auto-save for saved requests
- [x] Environment persistence to IndexedDB

### Phase 6: Workflow Runner ✅
- [x] Sequential execution engine
- [x] Variable chaining between requests
- [x] Runner UI with progress bar
- [x] Expandable results with test status

### Phase 7: Enhanced Body Types ✅
- [x] Body mode selector
- [x] Form data key-value editor
- [x] Proxy handling for all body types

### Phase 8: Authentication ✅
- [x] Auth type selector (None, Bearer, Basic, API Key)
- [x] Customizable header keys for Bearer and Basic auth
- [x] Customizable prefix for Bearer tokens
- [x] API Key support (header or query param)
- [x] Variable interpolation in all auth fields
- [x] Auth Editor component with live preview
- [x] Workflow runner auth support

### Phase 9: Response Tabs ✅
- [x] Body tab - Formatted JSON response with syntax highlighting
- [x] Headers tab - Table view of all response headers with count
- [x] Cookies tab - Parsed Set-Cookie headers with name, value, and attributes
- [x] Raw tab - Unformatted response with word wrap

### Phase 10: Response Visualizer ✅
- [x] Auto-detect JSON structure and generate UI template
- [x] Table view for arrays of objects
- [x] Cards view for data with title/subtitle fields
- [x] List view for primitive arrays
- [x] Key-Value view for single objects
- [x] Smart type detection (URLs, images, dates, booleans)
- [x] Template configuration panel (view type, root path, column visibility)
- [x] Per-request template persistence

---

## 7. Bug Fixes

| ID | Description | Status |
|----|-------------|--------|
| 1 | Environment variables lost after page refresh | ✅ Fixed |
| 2 | Clicking second request in collection loads first request | ✅ Fixed |
| 3 | Response Visualizer only renders in Auto mode, manual view types show nothing | ✅ Fixed |

---

## 8. Future Enhancements

- [ ] OAuth 2.0 Authentication (Authorization Code, Client Credentials flows)
- [ ] Request History
- [ ] Import/Export (Postman collection import, JSON export)
- [ ] Code Generation (cURL, JavaScript, Python snippets)
- [ ] WebSocket Support
- [ ] GraphQL Support
- [ ] Protocol Buffers / gRPC Support (see Section 9)

---

## 9. Protocol Buffers / gRPC Support Plan

### 9.1 Overview

**Goal:** Enable Sendr to make gRPC calls to services using Protocol Buffers for message serialization, supporting all four gRPC communication patterns.

**Why gRPC Support Matters:**
- gRPC is widely adopted for microservices communication
- Protocol Buffers provide efficient binary serialization
- Many modern APIs (Google Cloud, Kubernetes, internal services) use gRPC
- Developers need browser-based tools to test gRPC services without installing CLI tools

### 9.2 gRPC Communication Patterns

| Pattern | Description | Complexity |
|---------|-------------|------------|
| Unary | Single request, single response | Low |
| Server Streaming | Single request, stream of responses | Medium |
| Client Streaming | Stream of requests, single response | Medium |
| Bidirectional Streaming | Stream of requests and responses | High |

**Initial Implementation:** Unary calls only (Phase 1-3), streaming in later phases.

### 9.3 Technical Architecture

#### 9.3.1 Proto Schema Management
```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (Client)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Proto File  │  │   Schema    │  │  Message Editor     │ │
│  │   Upload    │──▶│   Parser    │──▶│  (JSON ↔ Proto)    │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Server (Proxy)                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   gRPC      │  │   Proto     │  │   Response          │ │
│  │   Client    │──▶│  Serialize  │──▶│   Deserialize      │ │
│  │  (@grpc)    │  │  (protobufjs)│  │   (to JSON)        │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### 9.3.2 Key Libraries
| Library | Purpose | Location |
|---------|---------|----------|
| protobufjs | Parse .proto files, serialize/deserialize messages | Client + Server |
| @grpc/grpc-js | Node.js gRPC client for making calls | Server only |
| @grpc/proto-loader | Dynamic proto loading | Server only |

#### 9.3.3 Proxy Extension
New endpoint: `POST /api/grpc-proxy`
```typescript
// Request payload
{
  target: string;           // "localhost:50051"
  service: string;          // "greeter.Greeter"
  method: string;           // "SayHello"
  protoDefinition: string;  // Raw .proto file content
  message: object;          // JSON representation of request message
  metadata: Record<string, string>;  // gRPC metadata (headers)
  options: {
    useTls: boolean;
    insecure: boolean;      // Skip certificate verification
    timeout: number;
  }
}

// Response payload
{
  data: object;             // JSON representation of response message
  metadata: Record<string, string>;  // Response metadata
  trailers: Record<string, string>;  // gRPC trailers
  status: {
    code: number;           // gRPC status code (0-16)
    details: string;        // Status message
  };
  time: number;             // Duration in ms
}
```

### 9.4 Data Models

#### 9.4.1 Proto Schema Storage
```typescript
interface ProtoSchema {
  id: string;
  name: string;               // "user_service.proto" (filename only)
  path: string;               // "user/v1/user_service.proto" (logical path for import resolution)
  content: string;            // Raw .proto file content
  imports: string[];          // Resolved proto schema IDs this file depends on
  collectionId?: string;      // Optional: associate with collection
  createdAt: number;
  updatedAt: number;
}

interface ParsedService {
  name: string;               // "UserService"
  fullName: string;           // "myapp.users.v1.UserService"
  methods: ParsedMethod[];
}

interface ParsedMethod {
  name: string;               // "GetUser"
  inputType: string;          // "GetUserRequest"
  outputType: string;         // "GetUserResponse"
  clientStreaming: boolean;
  serverStreaming: boolean;
}

interface ImportResolutionResult {
  resolved: boolean;
  schemaId?: string;          // ID of resolved ProtoSchema
  path: string;               // The import path from the proto file
  error?: string;             // Error message if unresolved
  isWellKnown: boolean;       // True if google/protobuf/* type
}
```

#### 9.4.2 Extended Request Model
```typescript
// Extend BodyMode
type BodyMode = "none" | "json" | "xml" | "form-data" | "x-www-form-urlencoded" | "raw" | "protobuf";

// New: gRPC-specific request configuration
interface GrpcConfig {
  enabled: boolean;
  protoSchemaId: string;      // Reference to stored proto schema
  service: string;            // Selected service name
  method: string;             // Selected method name
  useTls: boolean;
  insecure: boolean;          // Skip TLS verification (dev only)
  timeout: number;            // Request timeout in ms
}

// Extended SavedRequest
interface SavedRequest {
  // ... existing fields ...
  grpcConfig?: GrpcConfig;
}

// Extended RequestBody for protobuf mode
interface RequestBody {
  mode: BodyMode;
  raw: string;
  formData: { key: string; value: string; active: boolean }[];
  protoMessage?: string;      // JSON representation of proto message
}
```

#### 9.4.3 gRPC Response Model
```typescript
interface GrpcResponse {
  data: unknown;              // Deserialized response message
  metadata: Record<string, string>;
  trailers: Record<string, string>;
  status: {
    code: GrpcStatusCode;
    details: string;
  };
  time: number;
  size: number;
}

// gRPC status codes (google.rpc.Code)
enum GrpcStatusCode {
  OK = 0,
  CANCELLED = 1,
  UNKNOWN = 2,
  INVALID_ARGUMENT = 3,
  DEADLINE_EXCEEDED = 4,
  NOT_FOUND = 5,
  ALREADY_EXISTS = 6,
  PERMISSION_DENIED = 7,
  RESOURCE_EXHAUSTED = 8,
  FAILED_PRECONDITION = 9,
  ABORTED = 10,
  OUT_OF_RANGE = 11,
  UNIMPLEMENTED = 12,
  INTERNAL = 13,
  UNAVAILABLE = 14,
  DATA_LOSS = 15,
  UNAUTHENTICATED = 16
}
```

#### 9.4.4 Proto Import Resolution

Proto files commonly import other proto files using relative or absolute paths. Sendr must resolve these imports correctly to parse and compile proto definitions.

**Example Directory Structure:**
```
protos/
├── google/protobuf/           # Well-known types (bundled)
│   ├── timestamp.proto
│   ├── duration.proto
│   ├── empty.proto
│   └── wrappers.proto
├── common/
│   ├── types.proto            # import "google/protobuf/timestamp.proto"
│   └── pagination.proto
├── user/v1/
│   ├── user.proto             # import "common/types.proto"
│   └── user_service.proto     # import "user/v1/user.proto"
└── order/v1/
    └── order_service.proto    # import "user/v1/user.proto"
                               # import "common/pagination.proto"
```

**Import Statement Examples:**
```protobuf
// In user/v1/user_service.proto
syntax = "proto3";
package user.v1;

import "user/v1/user.proto";           // Absolute path from root
import "common/types.proto";           // Absolute path from root
import "google/protobuf/timestamp.proto"; // Well-known type
```

**Resolution Algorithm:**
```typescript
function resolveImport(
  importPath: string,           // e.g., "common/types.proto"
  importingFilePath: string,    // e.g., "user/v1/user_service.proto"
  allSchemas: ProtoSchema[],
  wellKnownTypes: Map<string, string>
): ImportResolutionResult {

  // 1. Check if it's a well-known Google type
  if (importPath.startsWith("google/protobuf/")) {
    const content = wellKnownTypes.get(importPath);
    if (content) {
      return { resolved: true, path: importPath, isWellKnown: true };
    }
    return {
      resolved: false,
      path: importPath,
      isWellKnown: true,
      error: `Well-known type not bundled: ${importPath}`
    };
  }

  // 2. Try absolute path resolution (from proto root)
  const absoluteMatch = allSchemas.find(s => s.path === importPath);
  if (absoluteMatch) {
    return {
      resolved: true,
      schemaId: absoluteMatch.id,
      path: importPath,
      isWellKnown: false
    };
  }

  // 3. Try relative path resolution (from importing file's directory)
  const importingDir = dirname(importingFilePath); // "user/v1"
  const relativePath = normalizePath(join(importingDir, importPath));
  const relativeMatch = allSchemas.find(s => s.path === relativePath);
  if (relativeMatch) {
    return {
      resolved: true,
      schemaId: relativeMatch.id,
      path: relativePath,
      isWellKnown: false
    };
  }

  // 4. Import not found
  return {
    resolved: false,
    path: importPath,
    isWellKnown: false,
    error: `Cannot resolve import "${importPath}" from "${importingFilePath}"`
  };
}
```

**Transitive Dependency Resolution:**
```typescript
interface DependencyGraph {
  schemaId: string;
  dependencies: DependencyGraph[];
  allContent: string[];  // Flattened proto content for compilation
}

function buildDependencyGraph(
  rootSchemaId: string,
  allSchemas: ProtoSchema[],
  visited: Set<string> = new Set()
): DependencyGraph {

  if (visited.has(rootSchemaId)) {
    // Circular dependency detected - proto allows this
    return { schemaId: rootSchemaId, dependencies: [], allContent: [] };
  }
  visited.add(rootSchemaId);

  const schema = allSchemas.find(s => s.id === rootSchemaId);
  const dependencies = schema.imports
    .map(importId => buildDependencyGraph(importId, allSchemas, visited));

  // Flatten: dependencies first, then this file (topological order)
  const allContent = [
    ...dependencies.flatMap(d => d.allContent),
    schema.content
  ];

  return { schemaId: rootSchemaId, dependencies, allContent };
}
```

**Well-Known Types (Bundled):**

Sendr bundles these commonly-used Google proto files:
| Proto File | Purpose |
|------------|---------|
| `google/protobuf/timestamp.proto` | Point in time (seconds + nanos) |
| `google/protobuf/duration.proto` | Time span (seconds + nanos) |
| `google/protobuf/empty.proto` | Empty message type |
| `google/protobuf/wrappers.proto` | Nullable primitives (StringValue, Int32Value, etc.) |
| `google/protobuf/any.proto` | Dynamic typing |
| `google/protobuf/struct.proto` | JSON-like dynamic structure |
| `google/protobuf/field_mask.proto` | Partial updates |

**UI: Upload with Path Preservation:**
```
┌────────────────────────────────────────────────────────────────┐
│  Add Proto Files                                               │
├────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Drag & drop .proto files or folders here               │  │
│  │  or click to browse                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  Proto Root Path: [protos/                    ] (optional)     │
│  ℹ️ Prefix added to uploaded file paths for import resolution  │
│                                                                │
│  Files to upload:                                              │
│  ├─ 📄 user_service.proto  →  user/v1/user_service.proto      │
│  ├─ 📄 user.proto          →  user/v1/user.proto              │
│  └─ 📄 types.proto         →  common/types.proto              │
│                                                                │
│  ⚠️ Missing imports detected:                                  │
│     - common/pagination.proto (required by order_service.proto)│
│                                                                │
│                              [Cancel]  [Upload & Validate]     │
└────────────────────────────────────────────────────────────────┘
```

**Upload Options:**
1. **Single file upload** - User specifies the logical path manually
2. **Folder upload** - Preserves directory structure automatically
3. **ZIP upload** - Extracts and preserves paths from archive
4. **Proto root prefix** - Optionally prepend a path to all uploaded files

**Validation on Upload:**
1. Parse proto syntax (fail fast on syntax errors)
2. Extract all import statements
3. Resolve imports against existing schemas + well-known types
4. Show warnings for unresolved imports (allow upload anyway)
5. Re-validate dependent schemas when new files are added

**Import Resolution Error Handling:**
```
┌────────────────────────────────────────────────────────────────┐
│  ⚠️ Import Resolution Errors                                   │
├────────────────────────────────────────────────────────────────┤
│  user/v1/user_service.proto:                                   │
│    Line 5: import "common/types.proto"                         │
│    ❌ Cannot resolve - file not found                          │
│    💡 Upload common/types.proto or check the path              │
│                                                                │
│  order/v1/order_service.proto:                                 │
│    Line 7: import "payment/v1/payment.proto"                   │
│    ❌ Cannot resolve - file not found                          │
│    💡 Upload payment/v1/payment.proto or check the path        │
└────────────────────────────────────────────────────────────────┘
```

### 9.5 UI Components

#### 9.5.1 Proto Schema Manager
```
┌────────────────────────────────────────────────────────────────┐
│  Proto Schemas                                        [+ Add]  │
├────────────────────────────────────────────────────────────────┤
│  📄 user_service.proto                              [Edit][🗑] │
│     Services: UserService (3 methods)                          │
│  📄 common/types.proto                              [Edit][🗑] │
│     Messages: Timestamp, Money, Address                        │
│  📄 order_service.proto                             [Edit][🗑] │
│     Services: OrderService (5 methods)                         │
└────────────────────────────────────────────────────────────────┘
```

**Features:**
- Upload .proto files via drag-and-drop or file picker
- Monaco Editor with protobuf syntax highlighting
- Auto-parse and validate proto syntax
- Display extracted services, methods, and message types
- Handle proto imports (link to other stored schemas)

#### 9.5.2 gRPC Request Editor
```
┌────────────────────────────────────────────────────────────────┐
│ [gRPC ▼]  grpc://localhost:50051                      [Send]   │
├────────────────────────────────────────────────────────────────┤
│ Proto: [user_service.proto ▼]                                  │
│ Service: [UserService ▼]                                       │
│ Method: [GetUser ▼]  (Unary)                                   │
├────────────────────────────────────────────────────────────────┤
│ [Metadata] [Message] [Auth] [Scripts]                          │
├────────────────────────────────────────────────────────────────┤
│ // GetUserRequest                                              │
│ {                                                              │
│   "user_id": "{{userId}}",                                     │
│   "include_profile": true                                      │
│ }                                                              │
└────────────────────────────────────────────────────────────────┘
```

**Features:**
- Protocol selector: HTTP / gRPC toggle
- Service/method dropdowns populated from selected proto schema
- Method type indicator (Unary, Server Streaming, etc.)
- Message editor with auto-completion from proto message definition
- Variable interpolation support in message fields
- Metadata editor (equivalent to HTTP headers)

#### 9.5.3 gRPC Response Viewer
```
┌────────────────────────────────────────────────────────────────┐
│ Status: OK (0)                      42ms    1.2 KB             │
├────────────────────────────────────────────────────────────────┤
│ [Rendered] [Message] [Metadata] [Trailers] [Raw]               │
├────────────────────────────────────────────────────────────────┤
│ // GetUserResponse                                             │
│ {                                                              │
│   "user": {                                                    │
│     "id": "user_123",                                          │
│     "name": "John Doe",                                        │
│     "email": "john@example.com"                                │
│   },                                                           │
│   "profile": { ... }                                           │
│ }                                                              │
└────────────────────────────────────────────────────────────────┘
```

**Tabs:**
- **Rendered:** Response Visualizer (reuse existing component)
- **Message:** Formatted JSON with syntax highlighting
- **Metadata:** Response metadata as key-value table
- **Trailers:** gRPC trailers as key-value table
- **Raw:** Binary representation (hex dump) for debugging

#### 9.5.4 Collection-Proto Schema Association

Proto schemas can be managed at two levels: **global** (available to all collections) or **collection-scoped** (associated with a specific collection).

**Association Model:**
```typescript
// Proto schemas have optional collection binding
interface ProtoSchema {
  id: string;
  name: string;
  path: string;
  content: string;
  imports: string[];
  collectionId?: string;      // null = global, string = collection-scoped
  createdAt: number;
  updatedAt: number;
}

// Collections can have default proto schemas
interface Collection {
  id: string;
  name: string;
  createdAt: number;
  defaultProtoSchemaIds?: string[];  // Proto schemas shown first in dropdowns
}
```

**UI: Collection Settings with Proto Schemas:**
```
┌────────────────────────────────────────────────────────────────┐
│  Collection: User API Tests                        [Settings]  │
├────────────────────────────────────────────────────────────────┤
│  Proto Schemas                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Collection Schemas (scoped to this collection):         │  │
│  │  ├─ 📄 user/v1/user_service.proto    [Set Default] [🗑]  │  │
│  │  └─ 📄 user/v1/user.proto            [Set Default] [🗑]  │  │
│  │                                                          │  │
│  │  Global Schemas (available to all):                      │  │
│  │  ├─ 📄 common/types.proto            [Add to Collection] │  │
│  │  └─ 📄 common/pagination.proto       [Add to Collection] │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  [+ Upload Proto to Collection]  [+ Link Global Proto]         │
└────────────────────────────────────────────────────────────────┘
```

**Sidebar: gRPC Requests in Collections:**
```
┌─────────────────────────────────┐
│  Collections                    │
├─────────────────────────────────┤
│  ▼ User API Tests               │
│    ├─ 📨 Get All Users (GET)    │  ← HTTP request
│    ├─ 📨 Create User (POST)     │  ← HTTP request
│    ├─ ⚡ GetUser (gRPC)         │  ← gRPC request (different icon)
│    ├─ ⚡ ListUsers (gRPC)       │
│    └─ ⚡ UpdateUser (gRPC)      │
│  ▶ Order API Tests              │
│  ▶ Payment Service              │
└─────────────────────────────────┘
```

**Request Display Format:**
- HTTP: `{Name} ({METHOD})` with 📨 icon
- gRPC: `{MethodName} (gRPC)` with ⚡ icon, optionally show service name

**Creating gRPC Request from Proto:**
```
┌────────────────────────────────────────────────────────────────┐
│  Add Request to Collection                                     │
├────────────────────────────────────────────────────────────────┤
│  Request Type: ( ) HTTP  (•) gRPC                              │
│                                                                │
│  Proto Schema: [user/v1/user_service.proto        ▼]           │
│                                                                │
│  Select Methods to Add:                                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  UserService                                              │  │
│  │  [✓] GetUser (Unary)                                     │  │
│  │  [✓] ListUsers (Server Streaming)                        │  │
│  │  [ ] CreateUser (Unary)                                  │  │
│  │  [ ] UpdateUser (Unary)                                  │  │
│  │  [ ] DeleteUser (Unary)                                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  Target Server: [grpc://localhost:50051           ]            │
│                                                                │
│                              [Cancel]  [Add 2 Requests]        │
└────────────────────────────────────────────────────────────────┘
```

**Workflow:**
1. User opens collection settings or "Add Request" modal
2. Selects "gRPC" request type
3. Picks a proto schema (collection-scoped shown first, then global)
4. Selects one or more service methods to add
5. Each method becomes a separate SavedRequest with pre-filled grpcConfig
6. Requests appear in sidebar with gRPC indicator

#### 9.5.5 gRPC Metadata Editor

gRPC metadata is the equivalent of HTTP headers - key-value pairs sent with requests. Metadata is used for authentication, tracing, and custom application data.

**Metadata vs HTTP Headers:**
| Aspect | HTTP Headers | gRPC Metadata |
|--------|--------------|---------------|
| Format | Key: Value | key: value (lowercase keys) |
| Binary | Limited | Supported (key ending in `-bin`) |
| Reserved | Many (Host, Content-Type) | Few (grpc-* reserved) |
| Case | Case-insensitive | Lowercase required |

**UI: Metadata Tab (Request Editor):**
```
┌────────────────────────────────────────────────────────────────┐
│ [Metadata] [Message] [Auth] [Scripts]                          │
├────────────────────────────────────────────────────────────────┤
│  Request Metadata                                    [+ Add]   │
│  ┌────────┬─────────────────────────────────┬────────┬───────┐ │
│  │ Active │ Key                             │ Value  │       │ │
│  ├────────┼─────────────────────────────────┼────────┼───────┤ │
│  │  [✓]   │ authorization                   │ Bearer │  [🗑] │ │
│  │        │                                 │ {{tok}}│       │ │
│  ├────────┼─────────────────────────────────┼────────┼───────┤ │
│  │  [✓]   │ x-request-id                    │ {{rid}}│  [🗑] │ │
│  ├────────┼─────────────────────────────────┼────────┼───────┤ │
│  │  [ ]   │ x-debug-mode                    │ true   │  [🗑] │ │
│  └────────┴─────────────────────────────────┴────────┴───────┘ │
│                                                                │
│  ℹ️ Metadata keys must be lowercase. Keys ending in "-bin"     │
│     are treated as binary (base64 encoded).                    │
└────────────────────────────────────────────────────────────────┘
```

**Data Model:**
```typescript
interface GrpcMetadataEntry {
  key: string;              // Lowercase, e.g., "authorization"
  value: string;            // Supports {{variables}}
  active: boolean;          // Toggle on/off without deleting
}

// Extended GrpcConfig
interface GrpcConfig {
  enabled: boolean;
  protoSchemaId: string;
  service: string;
  method: string;
  useTls: boolean;
  insecure: boolean;
  timeout: number;
  metadata: GrpcMetadataEntry[];  // Request metadata
}
```

**Common Metadata Patterns:**
```
┌────────────────────────────────────────────────────────────────┐
│  Quick Add Common Metadata                                     │
├────────────────────────────────────────────────────────────────┤
│  [+ Authorization]  [+ Request ID]  [+ Trace Context]          │
│  [+ Deadline]       [+ Custom...]                              │
└────────────────────────────────────────────────────────────────┘
```

| Quick Add | Key | Default Value |
|-----------|-----|---------------|
| Authorization | `authorization` | `Bearer {{token}}` |
| Request ID | `x-request-id` | `{{$guid}}` |
| Trace Context | `traceparent` | `00-{{$guid}}-{{$guid8}}-01` |
| Deadline | `grpc-timeout` | `30S` |

**Auth Integration with Metadata:**

When Auth tab is configured, auth is automatically converted to metadata:
```
┌────────────────────────────────────────────────────────────────┐
│ [Metadata] [Message] [Auth] [Scripts]                          │
├────────────────────────────────────────────────────────────────┤
│  Auth Type: [Bearer Token ▼]                                   │
│                                                                │
│  Token: [{{authToken}}                              ]          │
│  Header Key: [authorization                         ]          │
│  Prefix: [Bearer                                    ]          │
│                                                                │
│  Preview:                                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  authorization: Bearer {{authToken}}                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  ℹ️ This will be added to request metadata automatically.      │
└────────────────────────────────────────────────────────────────┘
```

**Metadata in Proxy Request:**
```typescript
// Client sends to /api/grpc-proxy
{
  target: "localhost:50051",
  service: "user.v1.UserService",
  method: "GetUser",
  protoDefinition: "...",
  message: { user_id: "123" },
  metadata: {
    "authorization": "Bearer eyJhbG...",    // From Auth tab
    "x-request-id": "abc-123-def",          // From Metadata tab
    "x-custom-header": "value"              // From Metadata tab
  },
  options: { useTls: false, timeout: 30000 }
}
```

**Server-Side Metadata Handling:**
```typescript
// In /api/grpc-proxy/route.ts
import * as grpc from '@grpc/grpc-js';

function createMetadata(entries: Record<string, string>): grpc.Metadata {
  const metadata = new grpc.Metadata();

  for (const [key, value] of Object.entries(entries)) {
    // Validate key format (lowercase, no spaces)
    if (!/^[a-z0-9_-]+$/.test(key) && !key.endsWith('-bin')) {
      throw new Error(`Invalid metadata key: ${key}`);
    }

    // Binary metadata (base64 decode)
    if (key.endsWith('-bin')) {
      metadata.set(key, Buffer.from(value, 'base64'));
    } else {
      metadata.set(key, value);
    }
  }

  return metadata;
}

// Making the call with metadata
const call = client[method](
  requestMessage,
  metadata,           // Passed as second argument
  { deadline: Date.now() + timeout },
  (error, response) => { ... }
);
```

**Response Metadata Display:**
```
┌────────────────────────────────────────────────────────────────┐
│ [Rendered] [Message] [Metadata] [Trailers] [Raw]               │
├────────────────────────────────────────────────────────────────┤
│  Response Metadata (3)                                         │
│  ┌─────────────────────────────┬─────────────────────────────┐ │
│  │ Key                         │ Value                       │ │
│  ├─────────────────────────────┼─────────────────────────────┤ │
│  │ content-type                │ application/grpc            │ │
│  │ x-request-id                │ abc-123-def                 │ │
│  │ x-served-by                 │ pod-user-service-7d8f9      │ │
│  └─────────────────────────────┴─────────────────────────────┘ │
│                                                                │
│  Response Trailers (2)                                         │
│  ┌─────────────────────────────┬─────────────────────────────┐ │
│  │ Key                         │ Value                       │ │
│  ├─────────────────────────────┼─────────────────────────────┤ │
│  │ grpc-status                 │ 0                           │ │
│  │ grpc-message                │ OK                          │ │
│  └─────────────────────────────┴─────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

**Scripting API for Metadata:**
```javascript
// Pre-request script - modify metadata before sending
pm.grpc.metadata.set("x-request-id", pm.environment.get("requestId"));
pm.grpc.metadata.set("x-correlation-id", "corr-" + Date.now());
pm.grpc.metadata.get("authorization");  // Read current value
pm.grpc.metadata.remove("x-debug");     // Remove a key
pm.grpc.metadata.toObject();            // Get all as object

// Test script - read response metadata
const serverPod = pm.response.metadata("x-served-by");
pm.environment.set("lastServer", serverPod);

const grpcStatus = pm.response.trailers("grpc-status");
pm.test("gRPC status is OK", () => {
  pm.expect(grpcStatus).to.equal("0");
});
```

### 9.6 Implementation Phases

#### Phase 11: Proto Schema Foundation
- [ ] Install protobufjs library
- [ ] Create ProtoSchemas table in Dexie database (with `path` field for import resolution)
- [ ] Implement ProtoSchemaManager component
- [ ] Add proto file upload (drag-drop + file picker)
- [ ] Support folder/ZIP upload with path preservation
- [ ] Add "Proto Root Path" prefix option for upload
- [ ] Integrate Monaco Editor with protobuf language support
- [ ] Parse proto files and extract services/methods/messages
- [ ] Bundle well-known Google proto types (timestamp, duration, empty, wrappers, any, struct, field_mask)
- [ ] Implement import resolution algorithm (absolute + relative paths)
- [ ] Build transitive dependency graph for nested imports
- [ ] Show import resolution errors with actionable suggestions
- [ ] Re-validate dependent schemas when new files are added
- [ ] Validate proto syntax with error highlighting

#### Phase 12: gRPC Proxy Implementation
- [ ] Install @grpc/grpc-js and @grpc/proto-loader
- [ ] Create `/api/grpc-proxy` endpoint
- [ ] Implement dynamic service/method invocation
- [ ] Handle TLS/insecure connections
- [ ] Implement request timeout handling
- [ ] Map gRPC errors to structured response format
- [ ] Add gRPC metadata (headers) support
- [ ] Return response metadata and trailers

#### Phase 13: gRPC Request UI
- [ ] Add protocol toggle (HTTP/gRPC) to URL bar
- [ ] Create GrpcRequestEditor component
- [ ] Implement service/method selector dropdowns
- [ ] Add message editor with proto-aware auto-completion
- [ ] Implement metadata editor with KeyValueEditor (lowercase key validation)
- [ ] Add "Quick Add" buttons for common metadata (Authorization, Request ID, etc.)
- [ ] Add TLS configuration options
- [ ] Support variable interpolation in messages and metadata values
- [ ] Integrate Auth tab to auto-generate metadata entries
- [ ] Add binary metadata support (keys ending in `-bin` with base64 encoding)

#### Phase 14: gRPC Response Handling
- [ ] Extend response state to handle gRPC responses
- [ ] Add gRPC status code display with human-readable names
- [ ] Create Metadata tab with key-value table for response metadata
- [ ] Create Trailers tab with key-value table for gRPC trailers
- [ ] Integrate Response Visualizer for gRPC responses
- [ ] Add raw binary view (hex dump)
- [ ] Support gRPC response in test scripts (`pm.response.json()`)
- [ ] Add `pm.response.metadata()` and `pm.response.trailers()` to scripting API

#### Phase 15: gRPC Collections Integration
- [ ] Extend SavedRequest model with grpcConfig (including metadata array)
- [ ] Update save/load logic for gRPC requests
- [ ] Add gRPC requests to sidebar with ⚡ icon and service/method display
- [ ] Implement auto-save for gRPC request changes
- [ ] Add collection-level proto schema association (global vs collection-scoped)
- [ ] Create "Add gRPC Request" modal with method multi-select from proto
- [ ] Add Collection Settings panel for managing proto schema associations
- [ ] Support bulk-adding multiple service methods as separate requests
- [ ] Add `defaultProtoSchemaIds` to Collection model for dropdown ordering

#### Phase 16: gRPC Workflow Runner
- [ ] Extend workflowRunner to handle gRPC requests
- [ ] Add gRPC status code to result tracking
- [ ] Support variable extraction from gRPC responses
- [ ] Display gRPC-specific results in runner UI

#### Phase 17: Server Streaming Support
- [ ] Extend grpc-proxy for server streaming
- [ ] Implement streaming response accumulation
- [ ] Add stream progress indicator in UI
- [ ] Display multiple response messages
- [ ] Support stream cancellation

#### Phase 18: Client & Bidirectional Streaming (Advanced)
- [ ] Implement WebSocket bridge for streaming
- [ ] Create stream message composer UI
- [ ] Handle bidirectional message flow
- [ ] Add stream state management

### 9.7 Technical Challenges & Solutions

#### Challenge 1: Proto Schema Resolution
**Problem:** Proto files often import other proto files (e.g., `google/protobuf/timestamp.proto`).

**Solution:**
- Bundle common Google proto files (timestamp, duration, empty, wrappers)
- Allow users to upload dependent proto files
- Implement import resolution from stored schemas
- Show clear errors for missing imports

#### Challenge 2: Browser Binary Handling
**Problem:** Browsers work with text; protobuf uses binary serialization.

**Solution:**
- Serialize/deserialize entirely server-side
- Send JSON representation to/from client
- Server converts JSON → Proto binary → gRPC → Proto binary → JSON
- Use protobufjs for consistent encoding/decoding

#### Challenge 3: gRPC Authentication
**Problem:** gRPC uses metadata for auth, not HTTP headers directly.

**Solution:**
- Map existing auth types to gRPC metadata:
  - Bearer → `authorization: Bearer <token>`
  - API Key → Custom metadata key-value
  - Basic → `authorization: Basic <base64>`
- Support channel credentials for mTLS (future)

#### Challenge 4: Connection Management
**Problem:** gRPC uses persistent HTTP/2 connections; browser proxy pattern creates new connections.

**Solution:**
- Accept connection overhead for simplicity (proxy creates new connection per request)
- Future optimization: Connection pooling in proxy with channel reuse
- Add connection timeout configuration

#### Challenge 5: Streaming Over HTTP Proxy
**Problem:** The passthrough proxy pattern doesn't naturally support streaming.

**Solution (Phase 17-18):**
- Use Server-Sent Events (SSE) for server streaming
- Use WebSocket upgrade for bidirectional streaming
- New endpoint: `/api/grpc-stream` with different response handling

### 9.8 Scripting API Extensions

Extend `pm` API for gRPC:
```javascript
// Pre-request script
pm.grpc.metadata.set("x-request-id", "123");
pm.grpc.message.get();        // Get current message object
pm.grpc.message.set(obj);     // Replace message object

// Test script
pm.response.json();           // Deserialized response message (unchanged)
pm.response.metadata();       // Get response metadata
pm.response.trailers();       // Get response trailers
pm.response.status.code;      // gRPC status code (0-16)
pm.response.status.details;   // Status message

// Test assertions
pm.test("Status is OK", () => {
  pm.expect(pm.response.status.code).to.equal(0);
});

pm.test("User returned", () => {
  const user = pm.response.json().user;
  pm.expect(user.id).to.equal(pm.environment.get("userId"));
});
```

### 9.9 Database Schema Changes

```typescript
// Schema version 2: Add proto schemas table
db.version(2).stores({
  collections: "id, name, createdAt",
  requests: "id, collectionId, name",
  environments: "id, name",
  settings: "id",
  protoSchemas: "id, name, path, collectionId, createdAt"  // NEW - path indexed for import resolution
});

// Updated Collection interface (no schema change, just new optional field)
interface Collection {
  id: string;
  name: string;
  createdAt: number;
  defaultProtoSchemaIds?: string[];  // NEW - ordered list of default protos for this collection
}

// Updated SavedRequest interface (extended grpcConfig)
interface SavedRequest {
  // ... existing fields ...
  grpcConfig?: {
    enabled: boolean;
    protoSchemaId: string;
    service: string;
    method: string;
    useTls: boolean;
    insecure: boolean;
    timeout: number;
    metadata: {                    // NEW - request metadata
      key: string;
      value: string;
      active: boolean;
    }[];
  };
}
```

### 9.10 File Structure Changes

```
src/
├── app/
│   ├── api/
│   │   ├── proxy/route.ts         # Existing HTTP proxy
│   │   └── grpc-proxy/route.ts    # NEW: gRPC proxy endpoint
│   └── page.tsx
├── components/
│   ├── ... existing components ...
│   ├── GrpcRequestEditor.tsx      # NEW: gRPC request configuration
│   ├── ProtoSchemaManager.tsx     # NEW: Proto file management modal
│   ├── ProtoEditor.tsx            # NEW: Monaco editor for .proto files
│   ├── ServiceMethodSelector.tsx  # NEW: Dropdowns for service/method
│   └── GrpcResponseViewer.tsx     # NEW: gRPC-specific response tabs
├── lib/
│   ├── ... existing libs ...
│   ├── protoParser.ts             # NEW: Parse .proto files
│   ├── protoImportResolver.ts     # NEW: Resolve imports with relative/absolute paths
│   ├── wellKnownProtos.ts         # NEW: Bundled Google proto definitions
│   └── grpcClient.ts              # NEW: gRPC client utilities
└── store/
    └── protoSchemaStore.ts        # NEW: Zustand store for proto schemas
```

### 9.11 Success Metrics

| Metric | Target |
|--------|--------|
| Unary call success rate | >99% |
| Proto parse success (valid files) | 100% |
| UI response time (send → display) | <200ms + network |
| Supported proto3 features | All common types |
| Error message clarity | User actionable |

### 9.12 Out of Scope (Initial Release)

- gRPC-Web protocol (different wire format)
- Mutual TLS (mTLS) certificate management
- gRPC reflection (auto-discover services without proto files)
- Load balancing / multiple targets
- Retry policies / circuit breakers
- Proto2 syntax (proto3 only initially)
