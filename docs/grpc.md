# gRPC / Protocol Buffers Support

[Back to main documentation](../CLAUDE.md)

---

## Status

**~85% Complete** - Unary gRPC support is fully implemented. Streaming support is planned for future phases.

| Feature | Status |
|---------|--------|
| Proto Schema Management | Implemented |
| gRPC Proxy (Unary) | Implemented |
| Request/Response UI | Implemented |
| Collections Integration | Implemented |
| Workflow Runner Integration | Implemented |
| Scripting API (metadata/trailers) | Implemented |
| Server Streaming | Future |
| Client Streaming | Future |
| Bidirectional Streaming | Future |

---

## Overview

Sendr supports gRPC calls using Protocol Buffers for message serialization.

**Why gRPC Support Matters:**
- gRPC is widely adopted for microservices communication
- Protocol Buffers provide efficient binary serialization
- Many modern APIs (Google Cloud, Kubernetes, internal services) use gRPC
- Developers need browser-based tools to test gRPC services without installing CLI tools

---

## gRPC Communication Patterns

| Pattern | Description | Status |
|---------|-------------|--------|
| Unary | Single request, single response | Implemented |
| Server Streaming | Single request, stream of responses | Future |
| Client Streaming | Stream of requests, single response | Future |
| Bidirectional Streaming | Stream of requests and responses | Future |

---

## Architecture

### Flow Diagram

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

### Key Libraries

| Library | Purpose | Location |
|---------|---------|----------|
| protobufjs | Parse .proto files, serialize/deserialize messages | Client + Server |
| @grpc/grpc-js | Node.js gRPC client for making calls | Server only |

> **Note:** Proto definitions are parsed directly from strings using `protobufjs`, not from files. The gRPC proxy receives proto content in the request body and builds service definitions dynamically.

---

## API Endpoint

### POST /api/grpc-proxy

**Request Payload:**
```typescript
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
    timeout: number;        // Request timeout in ms
  }
}
```

**Response Payload:**
```typescript
{
  data: object;             // JSON representation of response message
  metadata: Record<string, string>;  // Response metadata
  trailers: Record<string, string>;  // gRPC trailers
  status: {
    code: number;           // gRPC status code (0-16)
    details: string;        // Status message
  };
  time: number;             // Duration in ms
  size: number;             // Response size in bytes
}
```

---

## Data Models

### Proto Schema

```typescript
interface ProtoSchema {
  id: string;
  name: string;               // "user_service.proto"
  path: string;               // "user/v1/user_service.proto"
  content: string;            // Raw .proto file content
  createdAt: number;
  updatedAt: number;
}
```

### gRPC Configuration

```typescript
interface GrpcConfig {
  protoSchemaId: string;      // Reference to stored proto schema
  service: string;            // Selected service name
  method: string;             // Selected method name
  useTls: boolean;
  insecure: boolean;          // Skip TLS verification
  timeout: number;            // Request timeout in ms
  metadata: GrpcMetadataEntry[];
}

interface GrpcMetadataEntry {
  key: string;                // Lowercase key
  value: string;              // Supports {{variables}}
  active: boolean;
}
```

### gRPC Status Codes

| Code | Name | Description |
|------|------|-------------|
| 0 | OK | Success |
| 1 | CANCELLED | Operation cancelled |
| 2 | UNKNOWN | Unknown error |
| 3 | INVALID_ARGUMENT | Invalid argument |
| 4 | DEADLINE_EXCEEDED | Timeout |
| 5 | NOT_FOUND | Resource not found |
| 6 | ALREADY_EXISTS | Resource already exists |
| 7 | PERMISSION_DENIED | Permission denied |
| 8 | RESOURCE_EXHAUSTED | Resource exhausted |
| 9 | FAILED_PRECONDITION | Precondition failed |
| 10 | ABORTED | Operation aborted |
| 11 | OUT_OF_RANGE | Out of range |
| 12 | UNIMPLEMENTED | Not implemented |
| 13 | INTERNAL | Internal error |
| 14 | UNAVAILABLE | Service unavailable |
| 15 | DATA_LOSS | Data loss |
| 16 | UNAUTHENTICATED | Not authenticated |

---

## Proto Import Resolution

Proto files commonly import other proto files. Sendr resolves these imports from:

1. **Well-known Google types** (bundled):
   - `google/protobuf/timestamp.proto`
   - `google/protobuf/duration.proto`
   - `google/protobuf/empty.proto`
   - `google/protobuf/wrappers.proto`
   - `google/protobuf/any.proto`
   - `google/protobuf/struct.proto`

2. **User-uploaded schemas** - matched by path

### Path Resolution

When uploading proto files, you can specify a logical path for import resolution:

```
protos/
├── common/
│   └── types.proto            # import "common/types.proto"
├── user/v1/
│   ├── user.proto             # import "user/v1/user.proto"
│   └── user_service.proto     # imports both above
```

### Managing Import Errors

The Proto Schema Manager shows unresolved imports with suggestions:

1. **Auto-suggest paths** when uploading files based on existing imports
2. **One-click fix** button to update paths for unresolved imports
3. **Path suggestions** when editing existing schemas

---

## UI Components

### Proto Schema Manager

Accessible from the header "Proto" button (available regardless of request type).

Features:
- Upload .proto files via drag-and-drop or file picker
- Monaco Editor with protobuf syntax highlighting
- Auto-parse and validate proto syntax
- Display extracted services, methods, and message types
- Handle proto imports with path suggestions

### gRPC Request Editor

When request method is set to "gRPC":

1. **Proto Schema Selection** - Choose from uploaded schemas
2. **Service Selection** - Dropdown of available services
3. **Method Selection** - Dropdown of methods with type indicator
4. **Message Editor** - JSON representation with variable interpolation
5. **Metadata Tab** - Key-value editor for gRPC headers
6. **Options** - TLS, insecure mode, timeout

### gRPC Response Tabs

| Tab | Description |
|-----|-------------|
| Rendered | Response Visualizer (same as HTTP) |
| Message | JSON response with syntax highlighting |
| Metadata | Response metadata as key-value table |
| Trailers | gRPC trailers as key-value table |
| Raw | Raw response text |

---

## Scripting API

### Test Scripts

```javascript
// Get response data
const data = pm.response.json();

// Get gRPC metadata
const allMetadata = pm.response.metadata();
const singleValue = pm.response.metadata("x-request-id");

// Get gRPC trailers
const allTrailers = pm.response.trailers();
const singleTrailer = pm.response.trailers("grpc-status");

// Get gRPC status
const status = pm.response.grpcStatus;
// { code: 0, details: "OK" }

// Test assertions
pm.test("gRPC status is OK", () => {
  pm.expect(pm.response.grpcStatus.code).to.equal(0);
});

pm.test("Response has user", () => {
  const user = pm.response.json().user;
  pm.expect(user.id).to.exist;
});
```

---

## Workflow Runner Integration

gRPC requests are fully supported in the Workflow Runner:

- Sequential execution alongside HTTP requests
- Variable chaining works with gRPC responses
- Test scripts can access metadata and trailers
- gRPC status code shown in results
- Auth converted to metadata headers

---

## Files

| File | Purpose |
|------|---------|
| `src/app/api/grpc-proxy/route.ts` | gRPC proxy endpoint |
| `src/components/GrpcRequestEditor.tsx` | gRPC request configuration UI |
| `src/components/ProtoSchemaManager.tsx` | Proto file management modal |
| `src/hooks/useProtoSchemas.ts` | Proto schema CRUD hooks |
| `src/lib/grpc/protoParser.ts` | Proto file parsing |
| `src/lib/grpc/wellKnownProtos.ts` | Bundled Google proto types |
| `src/lib/workflowRunner.ts` | Workflow runner with gRPC support |
| `src/lib/scriptRunner.ts` | Script runner with gRPC context |

---

## Implementation Phases

### Phase 11: Proto Schema Foundation ✅
- [x] Install protobufjs library
- [x] Create ProtoSchemas table in Dexie database
- [x] Implement ProtoSchemaManager component
- [x] Parse proto files and extract services/methods
- [x] Bundle well-known Google proto types

### Phase 12: gRPC Proxy Implementation ✅
- [x] Install @grpc/grpc-js (protobufjs used for proto parsing)
- [x] Create `/api/grpc-proxy` endpoint
- [x] Implement dynamic service/method invocation
- [x] Handle TLS/insecure connections
- [x] Add gRPC metadata support

### Phase 13: gRPC Request UI ✅
- [x] Add protocol toggle (HTTP/gRPC)
- [x] Create GrpcRequestEditor component
- [x] Implement service/method selectors
- [x] Add message editor
- [x] Implement metadata editor

### Phase 14: gRPC Response Handling ✅
- [x] gRPC status code display
- [x] Metadata and Trailers tabs
- [x] Response Visualizer integration

### Phase 15: gRPC Collections Integration ✅
- [x] Extend SavedRequest model with grpcConfig
- [x] Save/load gRPC requests
- [x] gRPC requests in sidebar

### Phase 16: gRPC Workflow Runner ✅
- [x] Workflow runner gRPC support
- [x] Variable extraction from gRPC responses
- [x] pm.response.metadata() API
- [x] pm.response.trailers() API

### Phase 17-18: Streaming (Future)
- [ ] Server streaming support
- [ ] Client streaming support
- [ ] Bidirectional streaming
- [ ] WebSocket bridge for streaming
