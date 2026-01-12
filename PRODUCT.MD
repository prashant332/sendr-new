# Product Specification: PostmanWeb (Web-Based API Client)

## 1. Executive Summary
**Goal:** Build a browser-based API testing tool identical to Postman’s core functionality, including request organization (Collections) and automated workflow testing (Runner).
**Core Constraint:** Browsers cannot make direct cross-origin requests to arbitrary APIs due to CORS. The solution requires a "Passthrough Proxy" architecture.
**Target User:** Developers who need to test APIs and validate complex API chains without installing local software.

---

## 2. Technical Stack & Architecture

### 2.1 High-Level Architecture
1.  **Client (Frontend):** Handles UI, state management, script sandboxing, and the "Runner" execution logic.
2.  **Server (Proxy):** A lightweight Node.js server acting as the HTTP Agent. It forwards requests to the target API and returns raw responses.
3.  **Persistence Layer:** **IndexedDB (Client-side)** via `Dexie.js` or `idb`. This stores Collections, Requests, and History locally in the browser, ensuring data persists across reloads without needing a dedicated backend database immediately.

### 2.2 Technology Stack
* **Frontend:** Next.js (App Router), React, TypeScript.
* **Styling:** Tailwind CSS + ShadcnUI.
* **State Management:** Zustand (Global Store) + TanStack Query (optional for async state).
* **Storage:** `Dexie.js` (IndexedDB Wrapper).
* **Code Editor:** `@monaco-editor/react`.
* **Backend:** Node.js with Express or Fastify.
* **HTTP Client:** `axios` or `undici` (server-side).
* **Scripting Engine:** Native Web Workers (isolated thread).

---

## 3. Data Models (TypeScript Interfaces)

The application must adhere to these structures to support nesting and workflows.

    // 1. The Environment
    interface Environment {
      id: string;
      name: string;
      variables: Record<string, string>; 
    }

    // 2. The Collection Structure (Recursive)
    interface Collection {
      id: string;
      name: string;
      items: (CollectionFolder | ApiRequest)[]; // Recursive: Folders or Requests
      createdAt: number;
    }

    interface CollectionFolder {
      id: string;
      name: string;
      items: (CollectionFolder | ApiRequest)[];
    }

    // 3. The Request Definition
    interface ApiRequest {
      id: string;
      name: string;
      parentId: string; // ID of Collection or Folder
      method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
      url: string; 
      headers: { key: string; value: string; active: boolean }[];
      params: { key: string; value: string; active: boolean }[];
      body: {
        mode: 'none' | 'raw' | 'form-data';
        raw?: string;
        language?: 'json' | 'text' | 'xml';
      };
      auth: {
        type: 'none' | 'bearer';
        bearerToken?: string;
      };
      preRequestScript?: string; 
      testScript?: string;      
    }

    // 4. Workflow Runner Config
    interface RunnerConfig {
      collectionId: string;
      environmentId: string;
      iterationCount: number;
      delay: number; // ms delay between requests
      stopOnError: boolean;
    }

    // 5. Runner Result
    interface RunSummary {
      totalRequests: number;
      failedRequests: number;
      results: {
        requestId: string;
        requestName: string;
        statusCode: number;
        testPassCount: number;
        testFailCount: number;
        logs: string[];
      }[];
    }

---

## 4. Feature Requirements & Logic

### Feature A: The Passthrough Proxy (Core)
* **Endpoint:** `POST /api/proxy`
* **Logic:** Receives `{ method, url, headers, body }`, strips forbidden browser headers (Host, Origin), forwards to target, and returns the response object.
* **Error Handling:** Captures network errors (DNS, Timeout) as JSON responses, not 500 server errors.

### Feature B: Variable Interpolation
* **Logic:** Recursively replace `{{key}}` in URL, Headers, and Body with values from the active Environment.
* **Scope:** During a "Workflow Run", the environment must be dynamic—variables set in Request A (via script) must be available in Request B.

### Feature C: Scripting Sandbox (Web Worker)
* **Mechanism:** Secure Web Worker mocking the `pm` object.
* **Critical for Workflows:** The worker must support `pm.environment.set()`. This updated environment is passed *back* to the main thread to be used by the *next* request in the queue.
* **Worker API:**
    * `pm.environment.set(key, val)` / `get(key)`
    * `pm.response.json()`
    * `pm.test(name, callback)`

### Feature D: Collection Management
* **UI:** Sidebar with a tree view (Collections -> Folders -> Requests).
* **Actions:** Create Collection, Add Folder, Save Request to Collection, Drag & Drop (optional).
* **Persistence:** Auto-save changes to IndexedDB so user data isn't lost on refresh.

### Feature E: Workflow Runner (Collection Runner)
* **Definition:** A mechanism to execute all requests in a Collection sequentially.
* **Execution Loop Logic:**
    1.  Load Collection Requests (flatten the tree).
    2.  **Start Loop:**
    3.  **Pre-Request:** Run script -> Update Runtime Environment.
    4.  **Interpolate:** Resolve URL/Body variables.
    5.  **Request:** Send to Proxy -> Get Response.
    6.  **Test:** Run script -> Assertions -> Update Runtime Environment.
    7.  **Store Result:** Save pass/fail status to `RunSummary`.
    8.  **Next:** Proceed to next request using the *updated* environment.

---

## 5. Implementation Roadmap (Phased)

**Phase 1: The Skeleton & Proxy (MVP)**
1.  Initialize Next.js repo & Node Proxy Server.
2.  Implement basic single-request UI (URL bar, Method select, Send button).
3.  **Goal:** Send 1 request to a public API and view the response JSON.

**Phase 2: The Editor & Variables**
1.  Monaco Editor integration for Request Body and Response Viewer.
2.  Environment Variable Manager (Zustand store).
3.  Regex interpolation logic (`{{key}}` replacement).
4.  **Goal:** Use variables in a request URL and body.

**Phase 3: The Scripting Engine**
1.  Web Worker implementation for `pre-request` and `test` scripts.
2.  Mocking `pm.response.json()` and `pm.environment.set()`.
3.  **Goal:** Write a test script that parses a JSON response and sets an environment variable.

**Phase 4: Collections (Organization)**
1.  Implement **IndexedDB** service layer (`Dexie.js`).
2.  Build the **Sidebar UI** (Tree view).
3.  Implement "Save Request" and "Create Collection" modals.
4.  **Goal:** Create a collection "My API", add a request, refresh the page, and see it persist.

**Phase 5: The Workflow Runner**
1.  Build the **Runner UI**: "Run Collection" button, Progress Bar, Console Log view.
2.  Implement the **Async Execution Engine**: A recursive/async function that iterates through requests.
3.  **Chaining Logic:** Ensure variable updates in Request 1 are visible to Request 2.
4.  **Goal:** Run a 2-step workflow: (1) Login [Set Token], (2) Get Profile [Use Token]. Both must pass.

---

## 6. Prompt Strategy for AI Development
* **General:** "I am building PostmanWeb based on the PRD. We are currently on Phase [X]."
* **Phase 1-3:** Focus on the "Single Request" flow.
* **Phase 4 (Collections):** "Create a custom hook `useCollections` that uses `dexie.js` to store collections in IndexedDB. Create a Sidebar component that renders this nested data structure."
* **Phase 5 (Runner):** "Implement the `WorkflowRunner` engine. This should be an async function that iterates through an array of Requests. It must maintain a `currentEnvironment` state that gets updated after every request's test script executes."