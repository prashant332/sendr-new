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
