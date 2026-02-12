# Sendr - Web-Based API Client

A browser-based API testing tool (similar to Postman) that uses a "Passthrough Proxy" architecture to bypass CORS restrictions.

**Goal:** Browser-based API testing with request organization (Collections) and automated workflow testing (Runner).

**Target User:** Developers who need to test APIs and validate complex API chains without installing local software.

---

## Quick Reference

### Commands
```bash
npm run dev      # Start development server (http://localhost:3000)
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

### Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/architecture.md) | Technical architecture, data models, project structure |
| [Features](docs/features.md) | Feature documentation, import/export |
| [Progress](docs/progress.md) | Implementation progress, bug fixes, future plans |
| [gRPC Support](docs/grpc.md) | Protocol Buffers / gRPC implementation |
| [Distribution](docs/distribution.md) | Docker, npm, CI/CD deployment |
| [AI Scripting](docs/ai-scripting.md) | AI-powered script generation |
| [Variable Preview](docs/variable-preview.md) | Variable interpolation live preview |

---

## Implementation Status Summary

| Feature Area | Status | Documentation |
|--------------|--------|---------------|
| **Core Features (Phases 1-10)** | **100% Complete** | [Features](docs/features.md) |
| HTTP Proxy, Collections, Environments | Implemented | [Features](docs/features.md) |
| Scripting Engine (pm API) | Implemented | [Features](docs/features.md) |
| Workflow Runner | Implemented | [Features](docs/features.md) |
| Response Visualizer | Implemented | [Features](docs/features.md) |
| **Import/Export** | **100% Complete** | [Features](docs/features.md#importexport) |
| Postman Collection v2.1 Import | Implemented | [Features](docs/features.md#importexport) |
| Variable API Normalization | Implemented | [Features](docs/features.md#importexport) |
| **AI Script Generation (Phases 19-23)** | **~95% Complete** | [AI Scripting](docs/ai-scripting.md) |
| LLM Adapters (OpenAI, Gemini, Anthropic, Ollama) | Implemented | [AI Scripting](docs/ai-scripting.md) |
| Quick Actions & Context Builder | Implemented | [AI Scripting](docs/ai-scripting.md) |
| **Distribution** | **100% Complete** | [Distribution](docs/distribution.md) |
| Docker & docker-compose | Implemented | [Distribution](docs/distribution.md) |
| npm/npx CLI | Implemented | [Distribution](docs/distribution.md) |
| CI/CD Workflows | Implemented | [Distribution](docs/distribution.md) |
| **gRPC/Protocol Buffers (Phases 11-18)** | **~85% Complete** | [gRPC](docs/grpc.md) |
| Proto Schema Management | Implemented | [gRPC](docs/grpc.md) |
| gRPC Proxy & UI (Unary) | Implemented | [gRPC](docs/grpc.md) |
| Workflow Runner Integration | Implemented | [gRPC](docs/grpc.md) |
| Streaming Support | Future | [gRPC](docs/grpc.md) |
| **Variable Live Preview (Phases 24-29)** | **Implemented** | [Variable Preview](docs/variable-preview.md) |
| Autocomplete & Hover Preview | Implemented | [Variable Preview](docs/variable-preview.md) |
| Monaco Integration | Implemented | [Variable Preview](docs/variable-preview.md) |
| Inline Preview & Validation | Implemented | [Variable Preview](docs/variable-preview.md) |

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16 (App Router), React, TypeScript |
| Styling | Tailwind CSS |
| State Management | Zustand (with IndexedDB persistence) |
| Storage | Dexie.js (IndexedDB wrapper) |
| Code Editor | @monaco-editor/react |
| HTTP Client | axios (server-side) |
| gRPC Client | @grpc/grpc-js, protobufjs |
| Scripting | Function constructor with sandboxed `pm` API |

---

## Project Structure

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
│   ├── AISettingsModal.tsx       # LLM provider configuration
│   ├── AuthEditor.tsx            # Authentication configuration
│   ├── BodyEditor.tsx            # Request body editor
│   ├── CreateCollectionModal.tsx # Collection creation modal
│   ├── EnvironmentManager.tsx    # Environment CRUD modal
│   ├── EnvironmentSelector.tsx   # Environment dropdown
│   ├── GrpcRequestEditor.tsx     # gRPC request configuration
│   ├── ImportExportModal.tsx     # Import/Export UI
│   ├── KeyValueEditor.tsx        # Reusable key-value editor
│   ├── ProtoSchemaManager.tsx    # Proto file management
│   ├── QuickActions.tsx          # AI quick actions
│   ├── ResponseVisualizer.tsx    # Response UI renderer
│   ├── SaveRequestModal.tsx      # Save request dialog
│   ├── Sidebar.tsx               # Collections tree view
│   ├── variable-preview/         # Variable preview components
│   └── WorkflowRunner.tsx        # Collection runner UI
├── hooks/
│   ├── useCollections.ts         # Collection/request CRUD
│   └── useProtoSchemas.ts        # Proto schema hooks
├── lib/
│   ├── ai/                       # AI adapters and utilities
│   ├── grpc/                     # gRPC utilities
│   ├── monaco/                   # Monaco editor variable support
│   ├── db.ts                     # Dexie database schema
│   ├── importExport.ts           # Import/export utilities
│   ├── interpolate.ts            # Variable interpolation
│   ├── scriptRunner.ts           # Script execution
│   ├── uuid.ts                   # UUID generation utility
│   └── workflowRunner.ts         # Collection runner engine
└── store/
    ├── aiStore.ts                # AI settings store
    └── environmentStore.ts       # Environment store
```

---

## Core Architecture

### Passthrough Proxy Pattern
All API requests go through `/api/proxy` (HTTP) or `/api/grpc-proxy` (gRPC). The proxy:
1. Receives request details (method, url, headers, body)
2. Strips browser-restricted headers (Host, Origin, Referer)
3. Handles different body types (JSON, XML, form-data, etc.)
4. Executes HTTP/gRPC call server-side
5. Returns response with timing and size metadata

### Scripting API
Sandboxed `pm` API mimicking Postman:
```javascript
// Variable access (all scopes normalized to single environment)
pm.environment.get(key)           // Get variable value
pm.environment.set(key, value)    // Set variable value
pm.environment.has(key)           // Check if variable exists
pm.environment.unset(key)         // Remove a variable
pm.environment.clear()            // Remove all variables
pm.environment.toObject()         // Get all variables as object

// Aliases (all map to pm.environment)
pm.variables.get/set/has/unset/clear/toObject
pm.globals.get/set/has/unset/clear/toObject
pm.collectionVariables.get/set/has/unset/clear/toObject

// Response & testing
pm.response.json()                // Get response (test scripts only)
pm.test(name, callback)           // Define test assertion
pm.expect(value)                  // Chai assertion

// gRPC-specific (test scripts)
pm.response.metadata(key)         // Get gRPC metadata
pm.response.trailers(key)         // Get gRPC trailers
pm.response.grpcStatus            // { code, details }
```

**Note:** Sendr uses a single variable scope. Postman's `pm.globals`, `pm.collectionVariables`, and `pm.variables` all map to `pm.environment` for compatibility.

### Variable Interpolation
- **Syntax:** `{{variable_name}}`
- **Applies to:** URL, Headers, Params, Body, Scripts
- **Features:** Recursive resolution, whitespace tolerance
