# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sendr is a browser-based API testing tool (similar to Postman) that uses a "Passthrough Proxy" architecture to bypass CORS restrictions. The client handles UI and scripting, while a Node.js server acts as the HTTP agent for making actual API calls.

## Tech Stack

- **Frontend:** Next.js 16 (App Router), React, TypeScript
- **Styling:** Tailwind CSS
- **State Management:** Zustand (with IndexedDB persistence)
- **Storage:** Dexie.js (IndexedDB wrapper)
- **Code Editor:** @monaco-editor/react
- **HTTP Client:** axios (server-side)

## Development Commands

```bash
npm run dev      # Start development server (http://localhost:3000)
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Architecture

### Passthrough Proxy Pattern
All API requests from the browser go through `/api/proxy` on the backend. The frontend never makes direct `fetch` calls to target APIs. The proxy:
1. Receives resolved request details (method, url, headers, body)
2. Strips browser-restricted headers (Host, Origin, Referer)
3. Handles different body types (JSON, XML, form-data, x-www-form-urlencoded)
4. Executes the HTTP call server-side with axios
5. Returns the response with timing and size metadata

### Scripting Sandbox
User scripts (pre-request and test scripts) run in a sandboxed Function constructor. The `pm` object API mimics Postman:
- `pm.environment.get(key)` / `pm.environment.set(key, value)`
- `pm.response.json()` (test scripts only)
- `pm.test(testName, callback)`

### Variable Interpolation
Variables use `{{variable_name}}` syntax and are resolved from the active Environment before sending requests. Interpolation applies to URL, headers, params, and body.

### Data Persistence
All data is persisted to IndexedDB using Dexie.js:
- **Collections** - Groups of related requests
- **Requests** - Saved API requests with all configuration
- **Environments** - Named sets of variables
- **Settings** - App settings like active environment

## Key Files

### Core
- `src/app/api/proxy/route.ts` - Proxy API endpoint (handles all body types)
- `src/app/page.tsx` - Main UI component with request editor
- `src/lib/db.ts` - Dexie database schema and interfaces

### State & Storage
- `src/store/environmentStore.ts` - Zustand store for environments (persisted to IndexedDB)
- `src/hooks/useCollections.ts` - CRUD hooks for collections and requests

### Utilities
- `src/lib/interpolate.ts` - Variable interpolation utility
- `src/lib/scriptRunner.ts` - Script execution with pm API
- `src/lib/workflowRunner.ts` - Collection runner engine for sequential execution

### Components
- `src/components/Sidebar.tsx` - Collections tree view with run button
- `src/components/BodyEditor.tsx` - Request body editor with mode selector
- `src/components/KeyValueEditor.tsx` - Reusable key-value pair editor
- `src/components/EnvironmentSelector.tsx` - Environment dropdown
- `src/components/EnvironmentManager.tsx` - Environment CRUD modal
- `src/components/CreateCollectionModal.tsx` - New collection modal
- `src/components/SaveRequestModal.tsx` - Save request to collection modal
- `src/components/WorkflowRunner.tsx` - Collection runner UI with progress

## Core Data Models

### RequestBody
```typescript
type BodyMode = "none" | "json" | "xml" | "form-data" | "x-www-form-urlencoded" | "raw";

interface RequestBody {
  mode: BodyMode;
  raw: string;
  formData: { key: string; value: string; active: boolean }[];
}
```

### SavedRequest
```typescript
interface SavedRequest {
  id: string;
  collectionId: string;
  name: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  url: string;
  headers: { key: string; value: string; active: boolean }[];
  params: { key: string; value: string; active: boolean }[];
  body: RequestBody;
  preRequestScript: string;
  testScript: string;
}
```

### Environment
```typescript
interface Environment {
  id: string;
  name: string;
  variables: Record<string, string>;
}
```

## Implementation Status

### Completed Features
- [x] Phase 1: Basic proxy and single-request UI
- [x] Phase 2: Monaco Editor, tabs (Params, Headers, Body, Scripts)
- [x] Phase 3: Environment variables with interpolation
- [x] Phase 4: Scripting engine with pm API
- [x] Phase 5: Collections with IndexedDB persistence
- [x] Phase 6: Workflow Runner (Collection Runner)
- [x] Multiple body types (JSON, XML, form-data, x-www-form-urlencoded, raw)
- [x] Environment persistence to IndexedDB
- [x] Auto-save for saved requests
