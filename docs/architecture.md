# Architecture

[Back to main documentation](../CLAUDE.md)

---

## High-Level Architecture

1. **Client (Frontend):** Handles UI, state management, script sandboxing, and workflow execution logic.
2. **Server (Proxy):** Next.js API route acting as HTTP Agent - forwards requests to target APIs and returns responses.
3. **Persistence Layer:** IndexedDB via Dexie.js - stores Collections, Requests, Environments, and Settings locally.

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16 (App Router), React, TypeScript |
| Styling | Tailwind CSS |
| State Management | Zustand (with IndexedDB persistence) |
| Storage | Dexie.js (IndexedDB wrapper) |
| Code Editor | @monaco-editor/react |
| HTTP Client | axios (server-side) |
| gRPC Client | @grpc/grpc-js, @grpc/proto-loader |
| Scripting | Function constructor with sandboxed `pm` API |

## Passthrough Proxy Pattern

All API requests go through `/api/proxy` (HTTP) or `/api/grpc-proxy` (gRPC). The proxy:
1. Receives request details (method, url, headers, body)
2. Strips browser-restricted headers (Host, Origin, Referer)
3. Handles different body types (JSON, XML, form-data, x-www-form-urlencoded)
4. Executes HTTP/gRPC call server-side
5. Returns response with timing and size metadata

---

## Development

### Commands
```bash
npm run dev      # Start development server (http://localhost:3000)
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

### Project Structure
```
src/
├── app/
│   ├── api/
│   │   ├── proxy/route.ts        # HTTP Proxy API endpoint
│   │   ├── grpc-proxy/route.ts   # gRPC Proxy API endpoint
│   │   └── ai/generate/route.ts  # AI script generation endpoint
│   ├── layout.tsx
│   └── page.tsx                  # Main UI component
├── components/
│   ├── AIScriptAssistant.tsx     # AI script generation panel
│   ├── AISettingsModal.tsx       # LLM provider configuration modal
│   ├── AuthEditor.tsx            # Authentication configuration editor
│   ├── BodyEditor.tsx            # Request body editor with mode selector
│   ├── CreateCollectionModal.tsx # Collection creation modal
│   ├── EnvironmentManager.tsx    # Environment CRUD modal
│   ├── EnvironmentSelector.tsx   # Environment dropdown selector
│   ├── GrpcRequestEditor.tsx     # gRPC request configuration
│   ├── ImportExportModal.tsx     # Import/Export UI modal
│   ├── KeyValueEditor.tsx        # Reusable key-value pair editor
│   ├── ProtoSchemaManager.tsx    # Proto file management modal
│   ├── QuickActions.tsx          # AI quick action suggestions
│   ├── ResponseVisualizer.tsx    # Auto-generated response UI renderer
│   ├── SaveRequestModal.tsx      # Save request dialog
│   ├── Sidebar.tsx               # Collections tree view
│   ├── variable-preview/         # Variable preview components
│   └── WorkflowRunner.tsx        # Collection runner UI
├── hooks/
│   ├── useCollections.ts         # CRUD hooks for collections/requests
│   └── useProtoSchemas.ts        # Proto schema management hooks
├── lib/
│   ├── ai/
│   │   ├── adapters/
│   │   │   ├── base.ts           # LLM adapter interface
│   │   │   ├── openai.ts         # OpenAI provider adapter
│   │   │   ├── gemini.ts         # Google Gemini provider adapter
│   │   │   └── index.ts          # Adapter registry
│   │   ├── contextBuilder.ts     # Build LLM context from response
│   │   ├── systemPrompt.ts       # System prompt templates
│   │   ├── types.ts              # AI types & interfaces
│   │   └── index.ts              # AI module exports
│   ├── grpc/
│   │   ├── protoParser.ts        # Proto file parsing
│   │   └── wellKnownProtos.ts    # Bundled Google proto types
│   ├── monaco/                   # Monaco editor variable support
│   ├── db.ts                     # Dexie database schema
│   ├── importExport.ts           # Import/export utilities
│   ├── interpolate.ts            # Variable interpolation
│   ├── scriptRunner.ts           # Script execution with pm API
│   ├── uuid.ts                   # UUID generation utility
│   └── workflowRunner.ts         # Collection runner engine
└── store/
    ├── aiStore.ts                # Zustand AI settings store
    └── environmentStore.ts       # Zustand environment store (IndexedDB persisted)
```

---

## Data Models

### Environment
```typescript
interface Environment {
  id: string;
  name: string;
  variables: Record<string, string>;
}
```

### Collection & Request
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

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "GRPC";

interface SavedRequest {
  id: string;
  collectionId: string;
  name: string;
  method: HttpMethod;
  url: string;
  headers: { key: string; value: string; active: boolean }[];
  params: { key: string; value: string; active: boolean }[];
  body: RequestBody;
  auth: RequestAuth;
  preRequestScript: string;
  testScript: string;
  responseTemplate?: ResponseTemplate;
  grpcConfig?: GrpcConfig;
}
```

### gRPC Configuration
```typescript
interface GrpcConfig {
  protoSchemaId: string;
  service: string;
  method: string;
  useTls: boolean;
  insecure: boolean;
  timeout: number;
  metadata: GrpcMetadataEntry[];
}

interface GrpcMetadataEntry {
  key: string;
  value: string;
  active: boolean;
}

interface ProtoSchema {
  id: string;
  name: string;
  path: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}
```

### Workflow Runner
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
  // gRPC fields
  grpcStatusCode?: number;
  grpcStatusDetails?: string;
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

### AI Settings
```typescript
interface AIProvider {
  id: string;
  name: string;
  type: "openai" | "anthropic" | "gemini" | "ollama" | "custom";
  apiKey: string;
  baseUrl: string;
  model: string;
}

interface AISettings {
  providers: AIProvider[];
  defaultProviderId: string | null;
}
```
