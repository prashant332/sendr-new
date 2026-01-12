# Product Specification: Sendr (Web-Based API Client)

## 1. Executive Summary
**Goal:** Build a browser-based API testing tool identical to Postman's core functionality, including request organization (Collections) and automated workflow testing (Runner).
**Core Constraint:** Browsers cannot make direct cross-origin requests to arbitrary APIs due to CORS. The solution requires a "Passthrough Proxy" architecture.
**Target User:** Developers who need to test APIs and validate complex API chains without installing local software.

---

## 2. Technical Stack & Architecture

### 2.1 High-Level Architecture
1.  **Client (Frontend):** Handles UI, state management, script sandboxing, and the "Runner" execution logic.
2.  **Server (Proxy):** A lightweight Next.js API route acting as the HTTP Agent. It forwards requests to the target API and returns raw responses.
3.  **Persistence Layer:** **IndexedDB (Client-side)** via `Dexie.js`. This stores Collections, Requests, Environments, and Settings locally in the browser.

### 2.2 Technology Stack
* **Frontend:** Next.js 16 (App Router), React, TypeScript.
* **Styling:** Tailwind CSS.
* **State Management:** Zustand (Global Store with IndexedDB persistence).
* **Storage:** `Dexie.js` (IndexedDB Wrapper).
* **Code Editor:** `@monaco-editor/react`.
* **HTTP Client:** `axios` (server-side proxy).
* **Scripting Engine:** Function constructor with sandboxed `pm` API.

---

## 3. Data Models (TypeScript Interfaces)

### 3.1 Environment
```typescript
interface Environment {
  id: string;
  name: string;
  variables: Record<string, string>;
}
```

### 3.2 Collection & Request
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

interface SavedRequest {
  id: string;
  collectionId: string;
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers: { key: string; value: string; active: boolean }[];
  params: { key: string; value: string; active: boolean }[];
  body: RequestBody;
  preRequestScript: string;
  testScript: string;
}
```

### 3.3 Workflow Runner
```typescript
interface RunnerConfig {
  collectionId: string;
  initialVariables: Record<string, string>;
  delay: number; // ms delay between requests
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

## 4. Feature Requirements & Logic

### Feature A: The Passthrough Proxy (Core) [IMPLEMENTED]
* **Endpoint:** `POST /api/proxy`
* **Logic:** Receives `{ method, url, headers, body }`, strips forbidden browser headers (Host, Origin), forwards to target, and returns the response object.
* **Body Handling:** Supports JSON, XML, raw text, form-data (multipart), and x-www-form-urlencoded.
* **Error Handling:** Captures network errors (DNS, Timeout) as JSON responses, not 500 server errors.

### Feature B: Variable Interpolation [IMPLEMENTED]
* **Logic:** Replace `{{key}}` tokens in URL, Headers, Params, and Body with values from the active Environment.
* **Scope:** During a "Workflow Run", the environment is dynamic—variables set in Request A (via script) are available in Request B.

### Feature C: Scripting Sandbox [IMPLEMENTED]
* **Mechanism:** Sandboxed Function constructor with `pm` object API.
* **Critical for Workflows:** Supports `pm.environment.set()`. Updated environment is passed to the next request in workflow queue.
* **API:**
    * `pm.environment.set(key, val)` / `get(key)`
    * `pm.response.json()` (test scripts only)
    * `pm.test(name, callback)`

### Feature D: Collection Management [IMPLEMENTED]
* **UI:** Sidebar with tree view (Collections -> Requests).
* **Actions:** Create Collection, Save Request to Collection, Delete Collection/Request.
* **Persistence:** Auto-save changes to IndexedDB. Data persists across page refreshes.

### Feature E: Workflow Runner (Collection Runner) [IMPLEMENTED]
* **Definition:** Executes all requests in a Collection sequentially.
* **Execution Loop:**
    1. Load Collection Requests
    2. For each request:
       - Run pre-request script -> Update Runtime Environment
       - Interpolate URL/Headers/Body variables
       - Send request via Proxy -> Get Response
       - Run test script -> Assertions -> Update Runtime Environment
       - Store result in RunSummary
    3. Proceed to next request with updated environment
* **UI:** Progress bar, expandable results per request, test pass/fail indicators, console logs.

### Feature F: Multiple Body Types [IMPLEMENTED]
* **Supported Modes:**
    * `none` - No body
    * `json` - JSON with syntax highlighting
    * `xml` - XML with syntax highlighting
    * `form-data` - multipart/form-data (key-value pairs)
    * `x-www-form-urlencoded` - URL encoded form data
    * `raw` - Plain text
* **UI:** Mode selector buttons in Body tab, appropriate editor for each mode.

### Feature G: Environment Persistence [IMPLEMENTED]
* **Storage:** Environments saved to IndexedDB, survives page refresh.
* **Active Environment:** Remembered across sessions.

---

## 5. Implementation Roadmap (Status)

### Phase 1: The Skeleton & Proxy (MVP) [COMPLETED]
- [x] Initialize Next.js repo with TypeScript and Tailwind
- [x] Implement proxy API route at `/api/proxy`
- [x] Basic single-request UI (URL bar, Method select, Send button, Response display)

### Phase 2: The Editor Experience [COMPLETED]
- [x] Monaco Editor integration for Request Body and Response Viewer
- [x] Tabs for Params, Headers, Body, Scripts
- [x] KeyValueEditor component for params/headers

### Phase 3: Environment Variables [COMPLETED]
- [x] Zustand store for environments
- [x] Environment selector dropdown
- [x] Environment manager modal (CRUD)
- [x] Variable interpolation (`{{key}}` replacement)

### Phase 4: Scripting Engine [COMPLETED]
- [x] Script runner with `pm` API
- [x] Pre-request and test script editors
- [x] Test results display

### Phase 5: Collections (Organization) [COMPLETED]
- [x] Dexie.js database setup
- [x] Sidebar with collections tree view
- [x] Create Collection modal
- [x] Save Request modal
- [x] Load request from sidebar
- [x] Auto-save changes to saved requests
- [x] Environment persistence to IndexedDB

### Phase 6: Workflow Runner [COMPLETED]
- [x] Workflow runner engine (sequential execution)
- [x] Variable chaining between requests
- [x] Runner UI with progress bar
- [x] Expandable results with test status
- [x] Console log display

### Phase 7: Enhanced Body Types [COMPLETED]
- [x] Body mode selector (none, json, xml, form-data, x-www-form-urlencoded, raw)
- [x] Form data key-value editor
- [x] Proxy handling for all body types

---

## 6. Future Enhancements (Not Yet Implemented)

* **Authentication:** Bearer token, Basic Auth, OAuth 2.0 support
* **Request History:** Log of recent requests
* **Import/Export:** Postman collection import, JSON export
* **Response Tabs:** Headers, Cookies, Raw response view
* **Code Generation:** Generate code snippets (cURL, JavaScript, Python, etc.)
* **WebSocket Support:** Test WebSocket connections
* **GraphQL Support:** GraphQL query editor and variables
