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
| 4 | Adding new environment doesnt to anything when i try to clice '+' button from Manage environment option. This happens when running in docker, running in dev mode seems to work. | |

---

## 8. Future Enhancements

- [ ] OAuth 2.0 Authentication (Authorization Code, Client Credentials flows)
- [ ] Request History
- [ ] Import/Export (Postman collection import, JSON export)
- [ ] Code Generation (cURL, JavaScript, Python snippets)
- [ ] WebSocket Support
- [ ] GraphQL Support
- [ ] Protocol Buffers / gRPC Support (see Section 9)
- [ ] AI powered script generation

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

---

## 10. Distribution Plan

### 10.1 Distribution Options Overview

| Method | Use Case | Pros | Cons |
|--------|----------|------|------|
| Docker | Self-hosted, teams, CI/CD | Portable, isolated, easy deploy | Requires Docker |
| npm/npx | Developer local use | One command install | Requires Node.js |
| Desktop App | Non-technical users | No dependencies | Large bundle, updates |
| Cloud SaaS | Zero install | Instant access | Hosting costs, data privacy |

**Recommended Priority:**
1. Docker Image (primary)
2. npm package with npx support
3. Cloud-hosted demo instance
4. Desktop app (future)

### 10.2 Docker Distribution

#### 10.2.1 Dockerfile

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built assets
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
```

#### 10.2.2 Next.js Configuration for Standalone

```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',  // Enable standalone build for Docker
  experimental: {
    outputFileTracingRoot: undefined,
  },
};

module.exports = nextConfig;
```

#### 10.2.3 Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  sendr:
    build: .
    image: sendr:latest
    container_name: sendr
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    # Optional: persist data volume for future server-side storage
    # volumes:
    #   - sendr-data:/app/data

# volumes:
#   sendr-data:
```

#### 10.2.4 Docker Hub Publishing

```bash
# Build and tag
docker build -t sendr:latest .
docker tag sendr:latest yourusername/sendr:latest
docker tag sendr:latest yourusername/sendr:1.0.0

# Push to Docker Hub
docker login
docker push yourusername/sendr:latest
docker push yourusername/sendr:1.0.0
```

#### 10.2.5 GitHub Container Registry (GHCR)

```yaml
# .github/workflows/docker-publish.yml
name: Build and Push Docker Image

on:
  push:
    tags:
      - 'v*'
  release:
    types: [published]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

#### 10.2.6 User Installation

```bash
# Quick start with Docker
docker run -d -p 3000:3000 --name sendr ghcr.io/yourusername/sendr:latest

# Or with Docker Compose
curl -O https://raw.githubusercontent.com/yourusername/sendr/main/docker-compose.yml
docker-compose up -d

# Access at http://localhost:3000
```

### 10.3 npm Package Distribution

#### 10.3.1 Package Configuration

```json
// package.json additions
{
  "name": "sendr",
  "version": "1.0.0",
  "description": "Browser-based API testing tool with passthrough proxy",
  "bin": {
    "sendr": "./bin/cli.js"
  },
  "files": [
    "bin/",
    ".next/standalone/",
    ".next/static/",
    "public/"
  ],
  "keywords": ["api", "testing", "postman", "http", "grpc", "rest"],
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/sendr.git"
  },
  "license": "MIT"
}
```

#### 10.3.2 CLI Entry Point

```javascript
#!/usr/bin/env node
// bin/cli.js

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const port = args.find(a => a.startsWith('--port='))?.split('=')[1] ||
             args[args.indexOf('-p') + 1] ||
             process.env.PORT ||
             3000;

console.log(`
  ╔═══════════════════════════════════════╗
  ║             SENDR                     ║
  ║   Browser-based API Testing Tool      ║
  ╚═══════════════════════════════════════╝
`);

console.log(`Starting Sendr on http://localhost:${port}`);
console.log('Press Ctrl+C to stop\n');

// Set environment and start server
process.env.PORT = port;
const serverPath = path.join(__dirname, '..', '.next', 'standalone', 'server.js');

if (!fs.existsSync(serverPath)) {
  console.error('Error: Built files not found. Please rebuild the package.');
  process.exit(1);
}

const server = spawn('node', [serverPath], {
  stdio: 'inherit',
  env: { ...process.env, PORT: port }
});

server.on('error', (err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down Sendr...');
  server.kill('SIGINT');
  process.exit(0);
});
```

#### 10.3.3 User Installation via npm

```bash
# Global install
npm install -g sendr
sendr --port 3000

# Or run directly with npx (no install)
npx sendr
npx sendr --port 8080

# Or add to project
npm install --save-dev sendr
npx sendr
```

### 10.4 Multi-Architecture Docker Builds

Support for ARM64 (Apple Silicon, AWS Graviton) and AMD64:

```yaml
# In GitHub Actions workflow
- name: Build and push multi-arch
  uses: docker/build-push-action@v5
  with:
    context: .
    platforms: linux/amd64,linux/arm64
    push: true
    tags: ${{ steps.meta.outputs.tags }}
```

### 10.5 Environment Variables

```bash
# Supported environment variables
PORT=3000                    # Server port (default: 3000)
HOST=0.0.0.0                 # Bind address (default: 0.0.0.0)
NODE_ENV=production          # Environment mode

# Future: Optional features
SENDR_PROXY_TIMEOUT=30000    # Proxy request timeout in ms
SENDR_MAX_BODY_SIZE=10mb     # Maximum request body size
SENDR_ENABLE_TELEMETRY=false # Anonymous usage telemetry
```

### 10.6 Distribution Checklist

#### Pre-release
- [ ] Update version in package.json
- [ ] Update CHANGELOG.md
- [ ] Run full test suite
- [ ] Test Docker build locally
- [ ] Test npm pack and install locally
- [ ] Update README with latest features

#### Release Process
- [ ] Create git tag (v1.0.0)
- [ ] Push tag to trigger CI/CD
- [ ] Verify Docker image published to GHCR/Docker Hub
- [ ] Publish to npm (`npm publish`)
- [ ] Create GitHub Release with release notes
- [ ] Update documentation site

#### Post-release
- [ ] Verify Docker image works: `docker run ghcr.io/user/sendr:latest`
- [ ] Verify npm package works: `npx sendr@latest`
- [ ] Announce release (Twitter, Discord, etc.)

### 10.7 Versioning Strategy

Follow Semantic Versioning (SemVer):
- **MAJOR** (1.0.0 → 2.0.0): Breaking changes to UI, data models, or API
- **MINOR** (1.0.0 → 1.1.0): New features (gRPC support, new auth types)
- **PATCH** (1.0.0 → 1.0.1): Bug fixes, performance improvements

**Docker Tags:**
- `latest` - Most recent stable release
- `1.0.0` - Specific version (immutable)
- `1.0` - Latest patch of minor version
- `1` - Latest minor of major version
- `edge` - Latest commit on main branch (unstable)

### 10.8 Future: Desktop App (Electron)

For users who prefer a native application:

```
sendr-desktop/
├── electron/
│   ├── main.ts           # Electron main process
│   ├── preload.ts        # Preload script
│   └── window.ts         # Window management
├── package.json          # Electron-specific config
└── electron-builder.yml  # Build configuration
```

**Advantages:**
- No browser needed
- System tray integration
- Native file dialogs for proto upload
- Offline capability (for local APIs)

**Build targets:**
- Windows: `.exe` installer, portable
- macOS: `.dmg`, `.app`
- Linux: `.AppImage`, `.deb`, `.rpm`

### 10.9 File Structure for Distribution

```
sendr/
├── .github/
│   └── workflows/
│       ├── ci.yml              # Test on PR
│       ├── docker-publish.yml  # Build & push Docker
│       └── npm-publish.yml     # Publish to npm
├── bin/
│   └── cli.js                  # npx entry point
├── docker/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── .dockerignore
├── src/                        # Application source
├── package.json
├── next.config.js              # With standalone output
├── CHANGELOG.md
├── LICENSE
└── README.md                   # Installation instructions
```

---

## 11. AI-Powered Script Generation

### 11.1 Overview

**Goal:** Enable users to generate pre-request and test scripts using natural language prompts, powered by any LLM provider.

**Example Prompts:**
- "Filter offers from response and save the cheapest one under $100 to `cheapOffer` variable"
- "Extract the auth token from response headers and set it as `authToken`"
- "Assert that all items in the response have a status of 'active'"
- "Loop through users and find the one with email containing 'admin'"

**Key Principles:**
1. **Provider Agnostic** - Support multiple LLM providers (OpenAI, Anthropic, Ollama, etc.)
2. **Context-Aware** - LLM understands the response structure and available APIs
3. **Secure** - API keys stored locally, never sent to Sendr servers
4. **Iterative** - Users can refine generated scripts through conversation

### 11.2 Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         User Interface                              │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  "Filter offers under $100 and save cheapest to variable"     │  │
│  │  [Generate Script]                                            │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Context Builder                                │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐   │
│  │  Response JSON  │ │  pm API Docs    │ │  Environment Vars   │   │
│  │  (Schema/Sample)│ │  (Reference)    │ │  (Available)        │   │
│  └─────────────────┘ └─────────────────┘ └─────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      LLM Provider Adapter                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │  OpenAI  │ │ Anthropic│ │  Ollama  │ │  Gemini  │ │  Custom  │  │
│  │  GPT-4   │ │  Claude  │ │  (Local) │ │          │ │  (API)   │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Script Validator                               │
│  - Syntax validation (parse without executing)                      │
│  - Security checks (no dangerous operations)                        │
│  - pm API usage validation                                          │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Generated Script                               │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  const response = pm.response.json();                         │  │
│  │  const cheapOffers = response.offers.filter(o => o.price<100);│  │
│  │  const cheapest = cheapOffers.sort((a,b) => a.price-b.price); │  │
│  │  pm.environment.set("cheapOffer", JSON.stringify(cheapest[0]));│ │
│  └───────────────────────────────────────────────────────────────┘  │
│  [Insert to Script] [Refine] [Explain]                              │
└─────────────────────────────────────────────────────────────────────┘
```

### 11.3 Data Models

```typescript
// LLM Provider Configuration
interface LLMProvider {
  id: string;
  name: string;                    // "OpenAI", "Anthropic", "Ollama"
  type: "openai" | "anthropic" | "ollama" | "custom";
  baseUrl: string;                 // API endpoint
  model: string;                   // "gpt-4", "claude-3-opus", "llama3"
  apiKey?: string;                 // Encrypted, stored locally
  isDefault: boolean;
}

// Script Generation Request
interface ScriptGenerationRequest {
  prompt: string;                  // User's natural language request
  scriptType: "pre-request" | "test";
  context: ScriptContext;
  conversationHistory?: Message[]; // For refinement/follow-ups
}

// Context provided to LLM
interface ScriptContext {
  responseSchema?: JSONSchema;     // Inferred from actual response
  responseSample?: unknown;        // Actual response data (truncated)
  environmentVariables: string[];  // Available variable names
  existingScript?: string;         // Current script (for modifications)
  requestDetails: {
    method: string;
    url: string;
    isGrpc: boolean;
  };
}

// Generation Result
interface ScriptGenerationResult {
  script: string;                  // Generated JavaScript code
  explanation: string;             // What the script does
  warnings?: string[];             // Potential issues
  suggestions?: string[];          // Alternative approaches
}

// Conversation for refinement
interface Message {
  role: "user" | "assistant";
  content: string;
}

// Stored in IndexedDB
interface AISettings {
  id: "ai-settings";
  providers: LLMProvider[];
  defaultProviderId: string;
  enableAutoSuggestions: boolean;  // Suggest scripts based on response
  maxTokens: number;
  temperature: number;
}
```

### 11.4 LLM Provider Adapters

```typescript
// Base adapter interface
interface LLMAdapter {
  name: string;
  generateScript(request: ScriptGenerationRequest): Promise<ScriptGenerationResult>;
  testConnection(): Promise<boolean>;
}

// OpenAI Adapter
class OpenAIAdapter implements LLMAdapter {
  name = "OpenAI";

  async generateScript(request: ScriptGenerationRequest): Promise<ScriptGenerationResult> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.model,
        messages: this.buildMessages(request),
        temperature: 0.2,  // Low for code generation
        max_tokens: 1000
      })
    });
    return this.parseResponse(await response.json());
  }
}

// Anthropic Adapter
class AnthropicAdapter implements LLMAdapter {
  name = "Anthropic";

  async generateScript(request: ScriptGenerationRequest): Promise<ScriptGenerationResult> {
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1000,
        system: this.buildSystemPrompt(),
        messages: this.buildMessages(request)
      })
    });
    return this.parseResponse(await response.json());
  }
}

// Ollama Adapter (Local LLM)
class OllamaAdapter implements LLMAdapter {
  name = "Ollama";

  async generateScript(request: ScriptGenerationRequest): Promise<ScriptGenerationResult> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        prompt: this.buildPrompt(request),
        stream: false
      })
    });
    return this.parseResponse(await response.json());
  }
}

// Custom/Generic OpenAI-compatible Adapter
class CustomAdapter implements LLMAdapter {
  name = "Custom";
  // Works with any OpenAI-compatible API (Azure, Together, Groq, etc.)
}
```

### 11.5 System Prompt Design

```typescript
const SYSTEM_PROMPT = `You are an expert JavaScript developer specializing in API testing scripts.
You generate scripts for Sendr, an API testing tool similar to Postman.

## Available API (pm object)

### Environment Variables
- pm.environment.get(key: string): string | undefined
- pm.environment.set(key: string, value: string): void

### Response (Test Scripts Only)
- pm.response.json(): any - Parse response body as JSON
- pm.response.text(): string - Get response body as text
- pm.response.status: number - HTTP status code
- pm.response.headers: Record<string, string> - Response headers

### For gRPC:
- pm.response.metadata(key?: string): Record<string, string> | string
- pm.response.trailers(key?: string): Record<string, string> | string
- pm.response.status.code: number - gRPC status code (0-16)
- pm.response.status.details: string - Status message

### Testing (Test Scripts Only)
- pm.test(name: string, fn: () => void): void - Define a test
- pm.expect(value: any): Chai.Assertion - Chai assertion

## Response Data Structure
{responseSchema}

## Sample Response Data
{responseSample}

## Available Environment Variables
{environmentVariables}

## Rules
1. Generate clean, readable JavaScript code
2. Always use const/let, never var
3. Handle edge cases (null checks, empty arrays)
4. Use descriptive variable names
5. Add brief comments for complex logic
6. For test scripts, use pm.test() for assertions
7. Store complex objects as JSON strings in environment variables
8. Never use console.log (use pm.test for validation instead)

## Output Format
Respond with:
1. The JavaScript code in a code block
2. A brief explanation of what the script does
3. Any warnings or suggestions (optional)`;
```

### 11.6 UI Components

#### 11.6.1 AI Script Assistant Panel

```
┌────────────────────────────────────────────────────────────────────┐
│  AI Script Assistant                                    [Settings] │
├────────────────────────────────────────────────────────────────────┤
│  Provider: [OpenAI GPT-4 ▼]                                        │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Describe what you want the script to do...                  │  │
│  │                                                              │  │
│  │  "Filter offers under $100 and save the cheapest one to      │  │
│  │   an environment variable called 'cheapOffer'"               │  │
│  │                                                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  [Generate Test Script]  [Generate Pre-Request Script]             │
│                                                                    │
│  ─────────────────────────────────────────────────────────────────│
│                                                                    │
│  Generated Script:                                                 │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  // Filter offers under $100 and find the cheapest          │  │
│  │  const response = pm.response.json();                        │  │
│  │  const cheapOffers = response.offers                         │  │
│  │    .filter(offer => offer.price < 100)                       │  │
│  │    .sort((a, b) => a.price - b.price);                       │  │
│  │                                                              │  │
│  │  if (cheapOffers.length > 0) {                               │  │
│  │    pm.environment.set("cheapOffer",                          │  │
│  │      JSON.stringify(cheapOffers[0]));                        │  │
│  │  }                                                           │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  Explanation: This script filters the offers array to find        │
│  items priced under $100, sorts them by price ascending, and      │
│  saves the cheapest one to the 'cheapOffer' environment variable. │
│                                                                    │
│  [Insert into Script] [Copy] [Refine...]                          │
└────────────────────────────────────────────────────────────────────┘
```

#### 11.6.2 Inline Script Generation (Contextual)

```
┌────────────────────────────────────────────────────────────────────┐
│ [Params] [Headers] [Body] [Auth] [Scripts]                         │
├────────────────────────────────────────────────────────────────────┤
│  Test Script                                      [✨ AI Generate] │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                                                              │  │
│  │  // Your test script here...                                 │  │
│  │                                                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  Quick Actions (based on response):                                │
│  [Extract auth token] [Save user ID] [Assert status 200]          │
│  [Validate response schema] [Store for next request]               │
└────────────────────────────────────────────────────────────────────┘
```

#### 11.6.3 AI Settings Modal

```
┌────────────────────────────────────────────────────────────────────┐
│  AI Assistant Settings                                      [X]    │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  LLM Providers                                          [+ Add]    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  ⚫ OpenAI                                                    │  │
│  │     Model: gpt-4-turbo                                       │  │
│  │     API Key: sk-****************************abcd             │  │
│  │     [Test Connection] [Edit] [🗑]                    [Default]│  │
│  │                                                              │  │
│  │  ○ Anthropic                                                 │  │
│  │     Model: claude-3-opus-20240229                            │  │
│  │     API Key: sk-ant-**********************wxyz              │  │
│  │     [Test Connection] [Edit] [🗑]                            │  │
│  │                                                              │  │
│  │  ○ Ollama (Local)                                            │  │
│  │     Model: llama3:8b                                         │  │
│  │     URL: http://localhost:11434                              │  │
│  │     [Test Connection] [Edit] [🗑]                            │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  Options                                                           │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  [✓] Enable quick action suggestions based on response       │  │
│  │  [✓] Include response sample in context (recommended)        │  │
│  │  [ ] Auto-generate test assertions for new requests          │  │
│  │                                                              │  │
│  │  Temperature: [0.2        ] (lower = more deterministic)     │  │
│  │  Max Tokens:  [1000       ]                                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  Privacy Note: API keys are stored locally in your browser.        │
│  Response data sent to LLM is truncated to protect sensitive info. │
│                                                                    │
│                                                  [Save Settings]   │
└────────────────────────────────────────────────────────────────────┘
```

#### 11.6.4 Add Provider Modal

```
┌────────────────────────────────────────────────────────────────────┐
│  Add LLM Provider                                           [X]    │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Provider Type:                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  (•) OpenAI          ( ) Anthropic       ( ) Ollama          │  │
│  │  ( ) Azure OpenAI    ( ) Google Gemini   ( ) Custom API      │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  Configuration:                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Name:     [My OpenAI                               ]        │  │
│  │  API Key:  [sk-...                                  ] [Show] │  │
│  │  Model:    [gpt-4-turbo                          ▼]          │  │
│  │  Base URL: [https://api.openai.com/v1             ]          │  │
│  │            (Change for proxies or Azure)                     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  [Test Connection]                                                 │
│  ✓ Connection successful! Model: gpt-4-turbo                      │
│                                                                    │
│                                         [Cancel]  [Add Provider]   │
└────────────────────────────────────────────────────────────────────┘
```

### 11.7 Smart Context Building

```typescript
// Intelligently build context for the LLM
function buildScriptContext(
  response: unknown,
  request: SavedRequest,
  maxSampleSize: number = 2000
): ScriptContext {

  // 1. Infer JSON schema from response
  const responseSchema = inferJSONSchema(response);

  // 2. Create truncated sample (protect sensitive data)
  const responseSample = truncateAndSanitize(response, maxSampleSize);

  // 3. Get available environment variables
  const environmentVariables = getAllEnvironmentVariableNames();

  // 4. Include existing script if modifying
  const existingScript = request.testScript || request.preRequestScript;

  return {
    responseSchema,
    responseSample,
    environmentVariables,
    existingScript,
    requestDetails: {
      method: request.method,
      url: request.url,
      isGrpc: !!request.grpcConfig?.enabled
    }
  };
}

// Infer JSON schema from response data
function inferJSONSchema(data: unknown, depth: number = 3): JSONSchema {
  if (depth === 0) return { type: "any" };

  if (data === null) return { type: "null" };
  if (Array.isArray(data)) {
    return {
      type: "array",
      items: data.length > 0 ? inferJSONSchema(data[0], depth - 1) : {}
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

// Truncate large responses and sanitize sensitive data
function truncateAndSanitize(data: unknown, maxSize: number): unknown {
  const SENSITIVE_KEYS = ["password", "secret", "token", "apikey", "authorization"];

  function sanitize(obj: unknown, currentSize: number = 0): unknown {
    if (currentSize > maxSize) return "[truncated]";

    if (Array.isArray(obj)) {
      // Only include first 3 items of arrays
      return obj.slice(0, 3).map(item => sanitize(item, currentSize));
    }

    if (typeof obj === "object" && obj !== null) {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        // Mask sensitive fields
        if (SENSITIVE_KEYS.some(s => key.toLowerCase().includes(s))) {
          result[key] = "[REDACTED]";
        } else {
          result[key] = sanitize(value, currentSize + JSON.stringify(value).length);
        }
      }
      return result;
    }

    // Truncate long strings
    if (typeof obj === "string" && obj.length > 100) {
      return obj.substring(0, 100) + "...";
    }

    return obj;
  }

  return sanitize(data);
}
```

### 11.8 Script Validation

```typescript
interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

function validateGeneratedScript(
  script: string,
  scriptType: "pre-request" | "test"
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Syntax validation
  try {
    new Function(script);
  } catch (e) {
    errors.push(`Syntax error: ${e.message}`);
  }

  // 2. Security checks
  const dangerousPatterns = [
    { pattern: /eval\s*\(/, message: "eval() is not allowed" },
    { pattern: /Function\s*\(/, message: "Function constructor is not allowed" },
    { pattern: /fetch\s*\(/, message: "fetch() is not available in scripts" },
    { pattern: /require\s*\(/, message: "require() is not available in scripts" },
    { pattern: /import\s+/, message: "ES imports are not available in scripts" },
    { pattern: /process\./, message: "process is not available in scripts" },
    { pattern: /window\./, message: "window is not available in scripts" },
    { pattern: /document\./, message: "document is not available in scripts" },
  ];

  for (const { pattern, message } of dangerousPatterns) {
    if (pattern.test(script)) {
      errors.push(message);
    }
  }

  // 3. API usage validation
  if (scriptType === "pre-request") {
    if (script.includes("pm.response")) {
      errors.push("pm.response is not available in pre-request scripts");
    }
    if (script.includes("pm.test")) {
      warnings.push("pm.test is typically used in test scripts, not pre-request");
    }
  }

  // 4. Best practice warnings
  if (script.includes("var ")) {
    warnings.push("Consider using 'const' or 'let' instead of 'var'");
  }
  if (script.includes("console.log")) {
    warnings.push("console.log output won't be visible; use pm.test for validation");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
```

### 11.9 Quick Actions (Auto-Suggested)

```typescript
// Analyze response and suggest relevant quick actions
function suggestQuickActions(response: unknown): QuickAction[] {
  const suggestions: QuickAction[] = [];

  if (typeof response !== "object" || response === null) {
    return suggestions;
  }

  const data = response as Record<string, unknown>;

  // Check for common patterns and suggest actions

  // Auth token in response
  if (data.token || data.access_token || data.accessToken) {
    suggestions.push({
      label: "Save auth token",
      prompt: "Extract the authentication token and save it as 'authToken' environment variable",
      icon: "key"
    });
  }

  // User/ID patterns
  if (data.id || data.userId || data.user?.id) {
    suggestions.push({
      label: "Save ID",
      prompt: "Save the ID from response to an environment variable",
      icon: "id"
    });
  }

  // Array data
  const arrayFields = Object.entries(data).filter(([_, v]) => Array.isArray(v));
  for (const [key, arr] of arrayFields) {
    if ((arr as unknown[]).length > 0) {
      suggestions.push({
        label: `Filter ${key}`,
        prompt: `Help me filter the ${key} array based on a condition`,
        icon: "filter"
      });
      suggestions.push({
        label: `Extract from ${key}`,
        prompt: `Extract specific fields from the ${key} array and save to variable`,
        icon: "extract"
      });
    }
  }

  // Pagination
  if (data.page || data.totalPages || data.hasMore || data.nextCursor) {
    suggestions.push({
      label: "Handle pagination",
      prompt: "Save pagination info for the next request",
      icon: "pages"
    });
  }

  // Always available
  suggestions.push({
    label: "Assert status 200",
    prompt: "Create a test that asserts the response status is 200",
    icon: "check"
  });

  suggestions.push({
    label: "Validate schema",
    prompt: "Create tests to validate the response matches the expected schema",
    icon: "schema"
  });

  return suggestions;
}

interface QuickAction {
  label: string;
  prompt: string;
  icon: string;
}
```

### 11.10 Implementation Phases

#### Phase 19: AI Foundation
- [ ] Create AISettings store with IndexedDB persistence
- [ ] Implement LLM adapter interface
- [ ] Create OpenAI adapter
- [ ] Create Anthropic adapter
- [ ] Create Ollama adapter (local LLM support)
- [ ] Build secure API key storage (encrypted in IndexedDB)
- [ ] Create AI Settings modal UI

#### Phase 20: Script Generation
- [ ] Design and implement system prompt
- [ ] Build context builder (schema inference, sanitization)
- [ ] Create script generation API route (proxy to avoid CORS)
- [ ] Implement script validation
- [ ] Create AI Script Assistant panel UI
- [ ] Add "Insert into Script" functionality
- [ ] Implement conversation history for refinement

#### Phase 21: Smart Context
- [ ] Implement JSON schema inference from response
- [ ] Add response truncation and sanitization
- [ ] Include environment variables in context
- [ ] Support gRPC response context
- [ ] Add existing script context for modifications

#### Phase 22: Quick Actions
- [ ] Implement response analysis for suggestions
- [ ] Create quick action suggestion engine
- [ ] Add quick action buttons to script editor
- [ ] Pre-fill prompts for common operations

#### Phase 23: Advanced Features
- [ ] Add "Explain Script" feature (describe existing scripts)
- [ ] Implement "Fix Script" for error recovery
- [ ] Add auto-generate assertions option
- [ ] Create script templates library
- [ ] Support custom system prompt overrides

### 11.11 API Route for LLM Proxy

```typescript
// /api/ai/generate/route.ts
// Proxy LLM requests to avoid CORS and protect API keys

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { provider, apiKey, model, messages, baseUrl } = body;

  try {
    let response;

    switch (provider) {
      case "openai":
        response = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.2,
            max_tokens: 1500
          })
        });
        break;

      case "anthropic":
        response = await fetch(`${baseUrl}/messages`, {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model,
            max_tokens: 1500,
            messages
          })
        });
        break;

      case "ollama":
        response = await fetch(`${baseUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages,
            stream: false
          })
        });
        break;

      default:
        // Generic OpenAI-compatible API
        response = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ model, messages, temperature: 0.2 })
        });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    return NextResponse.json(
      { error: "Failed to generate script", details: error.message },
      { status: 500 }
    );
  }
}
```

### 11.12 Database Schema Changes

```typescript
// Add AI settings table
db.version(3).stores({
  collections: "id, name, createdAt",
  requests: "id, collectionId, name",
  environments: "id, name",
  settings: "id",
  protoSchemas: "id, name, path, collectionId, createdAt",
  aiSettings: "id"  // NEW - single row for AI configuration
});
```

### 11.13 File Structure Changes

```
src/
├── app/
│   ├── api/
│   │   ├── proxy/route.ts
│   │   ├── grpc-proxy/route.ts
│   │   └── ai/
│   │       └── generate/route.ts    # NEW: LLM proxy endpoint
│   └── page.tsx
├── components/
│   ├── ... existing components ...
│   ├── AIScriptAssistant.tsx        # NEW: AI generation panel
│   ├── AISettingsModal.tsx          # NEW: Provider configuration
│   ├── QuickActions.tsx             # NEW: Suggested actions
│   └── AddProviderModal.tsx         # NEW: Add LLM provider
├── lib/
│   ├── ... existing libs ...
│   ├── ai/
│   │   ├── adapters/
│   │   │   ├── base.ts              # NEW: Adapter interface
│   │   │   ├── openai.ts            # NEW: OpenAI adapter
│   │   │   ├── anthropic.ts         # NEW: Anthropic adapter
│   │   │   └── ollama.ts            # NEW: Ollama adapter
│   │   ├── contextBuilder.ts        # NEW: Build LLM context
│   │   ├── schemaInference.ts       # NEW: Infer JSON schema
│   │   ├── scriptValidator.ts       # NEW: Validate generated scripts
│   │   ├── quickActions.ts          # NEW: Suggest actions
│   │   └── systemPrompt.ts          # NEW: System prompt templates
└── store/
    ├── environmentStore.ts
    └── aiStore.ts                   # NEW: AI settings store
```

### 11.14 Security Considerations

1. **API Key Storage**
   - Keys stored in IndexedDB, encrypted with Web Crypto API
   - Never sent to Sendr servers (all LLM calls via local proxy)
   - Option to use environment variables for CI/CD

2. **Response Data Privacy**
   - Response samples truncated before sending to LLM
   - Sensitive fields (passwords, tokens) automatically redacted
   - User can disable response context sharing

3. **Generated Script Safety**
   - All scripts validated before insertion
   - Dangerous patterns blocked (eval, fetch, etc.)
   - Scripts run in existing sandbox

4. **Rate Limiting**
   - Client-side rate limiting to prevent accidental API abuse
   - Clear feedback on API usage

### 11.15 Example Prompts and Outputs

**Prompt:** "Filter the offers array to find items under $100, sort by price, and save the cheapest to 'bestDeal'"

**Generated Script:**
```javascript
// Filter offers under $100 and save the cheapest
const response = pm.response.json();

const affordableOffers = response.offers
  .filter(offer => offer.price < 100)
  .sort((a, b) => a.price - b.price);

if (affordableOffers.length > 0) {
  const bestDeal = affordableOffers[0];
  pm.environment.set("bestDeal", JSON.stringify(bestDeal));

  pm.test("Found affordable offer", () => {
    pm.expect(bestDeal.price).to.be.below(100);
  });
} else {
  pm.test("No affordable offers found", () => {
    pm.expect.fail("No offers under $100 available");
  });
}
```

---

**Prompt:** "Create tests to verify all users have valid email addresses"

**Generated Script:**
```javascript
// Validate all users have valid email addresses
const response = pm.response.json();
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

pm.test("Response contains users array", () => {
  pm.expect(response.users).to.be.an("array");
  pm.expect(response.users.length).to.be.greaterThan(0);
});

pm.test("All users have valid email addresses", () => {
  const invalidEmails = response.users.filter(
    user => !emailRegex.test(user.email)
  );

  pm.expect(invalidEmails).to.have.lengthOf(
    0,
    `Found ${invalidEmails.length} users with invalid emails`
  );
});

pm.test("No duplicate email addresses", () => {
  const emails = response.users.map(u => u.email);
  const uniqueEmails = new Set(emails);
  pm.expect(uniqueEmails.size).to.equal(emails.length);
});
```
