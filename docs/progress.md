# Implementation Progress

[Back to main documentation](../CLAUDE.md)

---

## Phase Summary

| Phase | Feature | Status |
|-------|---------|--------|
| 1-10 | Core Features | **100% Complete** |
| 11-15 | gRPC Unary Support | **Complete** |
| 16-18 | gRPC Streaming | Future |
| 19-23 | AI Script Generation | **~95% Complete** |
| 24-29 | Variable Live Preview | **Complete** |
| 30-32 | Folder Support | **100% Complete** |

---

## Core Phases (1-10)

### Phase 1: Skeleton & Proxy (MVP)
- [x] Next.js project with TypeScript and Tailwind
- [x] Proxy API route at `/api/proxy`
- [x] Basic UI (URL bar, Method select, Send button, Response display)

### Phase 2: Editor Experience
- [x] Monaco Editor for Body and Response
- [x] Tabs (Params, Headers, Body, Scripts)
- [x] KeyValueEditor component

### Phase 3: Environment Variables
- [x] Zustand store for environments
- [x] Environment selector dropdown
- [x] Environment manager modal (CRUD)
- [x] Variable interpolation (`{{key}}` replacement)

### Phase 4: Scripting Engine
- [x] Script runner with `pm` API
- [x] Pre-request and test script editors
- [x] Test results display

### Phase 5: Collections
- [x] Dexie.js database setup
- [x] Sidebar with collections tree
- [x] Create Collection / Save Request modals
- [x] Load request from sidebar
- [x] Auto-save for saved requests
- [x] Environment persistence to IndexedDB

### Phase 6: Workflow Runner
- [x] Sequential execution engine
- [x] Variable chaining between requests
- [x] Runner UI with progress bar
- [x] Expandable results with test status

### Phase 7: Enhanced Body Types
- [x] Body mode selector
- [x] Form data key-value editor
- [x] Proxy handling for all body types

### Phase 8: Authentication
- [x] Auth type selector (None, Bearer, Basic, API Key)
- [x] Customizable header keys for Bearer and Basic auth
- [x] Customizable prefix for Bearer tokens
- [x] API Key support (header or query param)
- [x] Variable interpolation in all auth fields
- [x] Auth Editor component with live preview
- [x] Workflow runner auth support

### Phase 9: Response Tabs
- [x] Body tab - Formatted JSON response with syntax highlighting
- [x] Headers tab - Table view of all response headers with count
- [x] Cookies tab - Parsed Set-Cookie headers with name, value, and attributes
- [x] Raw tab - Unformatted response with word wrap

### Phase 10: Response Visualizer
- [x] Auto-detect JSON structure and generate UI template
- [x] Table view for arrays of objects
- [x] Cards view for data with title/subtitle fields
- [x] List view for primitive arrays
- [x] Key-Value view for single objects
- [x] Smart type detection (URLs, images, dates, booleans)
- [x] Template configuration panel (view type, root path, column visibility)
- [x] Per-request template persistence

---

## gRPC Phases (11-18)

See [gRPC documentation](grpc.md) for full details.

### Phase 11: Proto Schema Foundation
- [x] Install protobufjs library
- [x] Create ProtoSchemas table in Dexie database
- [x] Implement ProtoSchemaManager component
- [x] Add proto file upload (drag-drop + file picker)
- [x] Parse proto files and extract services/methods/messages
- [x] Bundle well-known Google proto types

### Phase 12: gRPC Proxy Implementation
- [x] Install @grpc/grpc-js and @grpc/proto-loader
- [x] Create `/api/grpc-proxy` endpoint
- [x] Implement dynamic service/method invocation
- [x] Handle TLS/insecure connections
- [x] Add gRPC metadata support

### Phase 13: gRPC Request UI
- [x] Add protocol toggle (HTTP/gRPC) to URL bar
- [x] Create GrpcRequestEditor component
- [x] Implement service/method selector dropdowns
- [x] Add message editor
- [x] Implement metadata editor

### Phase 14: gRPC Response Handling
- [x] Extend response state to handle gRPC responses
- [x] Add gRPC status code display
- [x] Create Metadata and Trailers tabs
- [x] Integrate Response Visualizer for gRPC

### Phase 15: gRPC Collections Integration
- [x] Extend SavedRequest model with grpcConfig
- [x] Update save/load logic for gRPC requests
- [x] Add gRPC requests to sidebar

### Phase 16: gRPC Workflow Runner
- [x] Extend workflowRunner to handle gRPC requests
- [x] Add gRPC status code to result tracking
- [x] Support variable extraction from gRPC responses
- [x] Add pm.response.metadata() and pm.response.trailers() API

### Phase 17-18: Streaming (Future)
- [ ] Server streaming support
- [ ] Client streaming support
- [ ] Bidirectional streaming

---

## AI Phases (19-23)

See [AI Scripting documentation](ai-scripting.md) for full details.

### Phase 19: AI Foundation
- [x] Create AISettings store with IndexedDB persistence
- [x] Implement LLM adapter interface
- [x] Create OpenAI, Gemini, Anthropic, Ollama adapters

### Phase 20: Script Generation
- [x] Design and implement system prompt
- [x] Build context builder
- [x] Create AI Script Assistant panel UI

### Phase 21: Smart Context
- [x] Implement JSON schema inference from response
- [x] Add response truncation and sanitization
- [x] Include environment variables in context

### Phase 22: Quick Actions
- [x] Implement response analysis for suggestions
- [x] Create quick action suggestion engine
- [x] Add quick action buttons to script editor

### Phase 23: Advanced Features (Partial)
- [ ] Add "Explain Script" feature
- [ ] Implement "Fix Script" for error recovery
- [ ] Add auto-generate assertions option

---

## Variable Preview Phases (24-29)

See [Variable Preview documentation](variable-preview.md) for full details.

### Phase 24-27: Core Implementation
- [x] VariableInput component with autocomplete
- [x] Monaco editor integration
- [x] Hover preview with resolved values
- [x] Inline preview below inputs

### Phase 28-29: Advanced Features
- [x] Undefined variable warnings
- [x] Toggle for inline preview
- [x] All input fields integrated

---

## Folder Support Phases (30-32)

### Problem Analysis

**Current State:**
- Sendr has a flat structure: Collection → Requests (no folders)
- When importing from Postman, folders are flattened into request name prefixes (e.g., `Users/Create User`)
- Sidebar displays requests as a flat list under each collection
- Workflow Runner executes all requests in a collection sequentially

**Postman Structure:**
- Collections → Folders (unlimited nesting) → Requests
- Folders provide organizational hierarchy
- Can run individual folders or entire collections

**The Gap:**
1. No visual folder hierarchy in sidebar despite names containing paths
2. Cannot create/organize requests into folders within Sendr
3. Cannot run a subset of requests (folder-level workflow execution)
4. Postman import loses visual folder structure (preserved only in name prefixes)

### Implementation Approach

**Virtual Folders:** Parse existing `/` prefixed names as virtual folder paths and display hierarchically. No database changes needed - works with existing Postman imports immediately. Folder management operates by updating request name prefixes.

---

### Phase 30: Virtual Folder Display (UI Only) ✓
- [x] Parse request names containing `/` as folder paths
- [x] Build tree structure from flat request list in Sidebar
- [x] Display collapsible folder nodes in sidebar
- [x] Maintain backward compatibility (requests without `/` appear at root)
- [x] Preserve existing Postman import behavior (already creates prefixed names)

**Implementation:**
- Created `buildFolderTree(requests)` utility in `Sidebar.tsx` that groups requests by path segments
- Tree node types: `FolderTreeNode` and `RequestTreeNode`
- Example: `Users/CRUD/Create User` → 📁 Users → 📁 CRUD → Create User
- Folders show amber folder icon and request count badge
- Folder expand/collapse state tracked per collection
- Full path shown in tooltip on hover

---

### Phase 31: Folder-Level Operations ✓
- [x] Add "Run Folder" button on folder nodes (runs only requests in that folder)
- [x] Add request count badge on folders (implemented in Phase 30)
- [x] Sort folders alphabetically, then requests by original order (implemented in Phase 30)
- [ ] Add folder expand/collapse all (deferred - low priority)

**Implementation:**
- Added `folderPath` optional parameter to `RunnerConfig` in `workflowRunner.ts`
- Workflow runner filters requests by folder path prefix before execution
- Added `onRunFolder` callback prop to `Sidebar` component
- Added ▶ "Run Folder" button on folder hover (appears next to folder name)
- Updated `WorkflowRunner` component to accept `folderPath` prop
- WorkflowRunner UI shows "Run Folder" title and folder path when running a folder
- `RunSummary` includes `folderPath` for tracking

---

### Phase 32: Folder Management (Virtual Folders) ✓
- [x] Rename folder: Double-click folder name to edit inline, batch updates all request names
- [x] Delete folder: Click × button, choose to delete requests OR keep them (move to parent)
- [x] Move request to root: Click ↑ button on requests inside folders to move to collection root

**Implementation:**

*New functions in `useCollections.ts`:*
- `renameFolder(collectionId, oldPath, newPath)` - Batch updates all request name prefixes
- `deleteFolder(collectionId, folderPath, keepRequests)` - Deletes folder, optionally keeps requests
- `moveRequestToFolder(requestId, targetFolder)` - Moves request by updating name prefix

*UI in `Sidebar.tsx`:*
- Double-click folder name → inline edit mode (Enter to save, Escape to cancel)
- × button on folder hover → confirm dialog with options (OK=delete all, Cancel=keep requests)
- ↑ button on requests in folders → moves request to collection root

**No database schema changes** - all operations work by manipulating request name prefixes

---

## Bug Fixes

| ID | Description | Status |
|----|-------------|--------|
| 1 | Environment variables lost after page refresh | Fixed - Zustand + IndexedDB persistence |
| 2 | Clicking second request loads first request | Fixed - Proper request key handling |
| 3 | Response Visualizer only renders in Auto mode | Fixed - Auto/manual view types working |
| 4 | Environment creation fails in Docker | Fixed - Multiple issues addressed |
| 5 | Bearer prefix added for API-Key auth | Fixed - Empty prefix now correctly handled |
| 6 | Body editor too small | Fixed - Responsive height with min/max bounds |
| 7 | URL variable interpolation not working | Fixed - Enhanced interpolate function |
| 8 | Nested variable interpolation not working | Fixed - Recursive interpolation with max depth |
| 9 | Request name not visible | Fixed - Request name shown in header with tooltip |
| 10 | While working with gRPC request, cannot go to Auth or Scripts tab - switches back to gRPC tab instantly | Fixed - Removed activeTab from useEffect dependencies, use ref to track method changes |
| 11 | gRPC sample message generation only generates root fields, not nested message types | Fixed - Added resolveAll() call to resolve type references |
| 12 | Proto parse errors only shown in console, not in UI | Fixed - Added warnings/errors display in GrpcRequestEditor |
| 13 | Getting error ENOENT: no such file or directory, open 'main.proto' while trying to invoke grpc service | Fixed - Rewrote gRPC proxy to parse proto strings directly with protobufjs |
| 14 | Getting error pm.expect(...).to.be.greaterThan is not a function from the script. This should be supported in script engine | Fixed - Added greaterThan and lessThan as Chai-style aliases |
| 15 | Getting error Cannot read properties of undefined (reading 'property') for the script pm.expect(data.form).to.not.have.property("inactive_field") | Fixed - Added to.not.have.property() that handles undefined values |
| 16 | i cannot edit the name of the request onces it is saved. i should be able to change the name | Fixed - Click request name in header to edit inline |
### Bug Fix Details

#### Bug #4 (Environment Creation in Docker)

**Root Causes:**
1. `handleAddEnvironment` was not awaiting the async `addEnvironment` call
2. Race condition: user could click "+" before store initialization completed
3. No error feedback to user when operation failed
4. IndexedDB timing issues in production/standalone builds

**Fix Applied:**
- Made `handleAddEnvironment` async with proper await
- Added `isAdding` state to prevent double-clicks
- Added `error` state with visible error banner
- Added `ensureDbReady()` helper with retry logic

#### Bug #8 (Nested Variable Interpolation)

- Modified `interpolate()` function to support recursive resolution
- Variables containing other variables are now resolved iteratively
- Example: `baseURL = "https://{{envType}}.example.com"` + `envType = "prod"` → `"https://prod.example.com"`
- Added `maxDepth` parameter (default: 10) to prevent infinite loops

#### Bug #11 (gRPC Nested Message Generation)

**Root Cause:** protobufjs requires calling `resolveAll()` on the root after parsing to resolve type references. Without this, `field.resolvedType` is `null` for nested message types.

**Fix Applied:**
- Added `root.root.resolveAll()` call in `generateSampleMessage()` after parsing
- This ensures all type references are resolved before generating samples
- Nested message types now properly generate sample fields recursively
- Includes depth limit (default: 5) and cycle detection for self-referential messages

#### Bug #16 (Cannot Edit Request Name)

**Root Cause:** There was no UI to edit a request's name after it was saved. The name was displayed as static text.

**Fix Applied:**
- Made the request name in the header clickable
- Clicking the name enters inline edit mode with an input field
- Press Enter or click away to save the new name
- Press Escape to cancel editing
- The name updates in the sidebar automatically via Dexie's live queries

#### Bug #14 (pm.expect greaterThan not a function)

**Root Cause:** The Chai-style assertion library was missing `greaterThan` and `lessThan` methods which are common aliases.

**Fix Applied:**
- Added `to.be.greaterThan(num)` as alias for `to.be.above(num)`
- Added `to.be.lessThan(num)` as alias for `to.be.below(num)`

#### Bug #15 (to.not.have.property fails on undefined)

**Root Cause:** The `to.not.have` object was missing entirely from the assertion library. When calling `pm.expect(undefined).to.not.have.property("key")`, it threw an error because `have` didn't exist on `not`.

**Fix Applied:**
- Added `to.not.have.property(key)` method
- Handles undefined/null values gracefully (passes since they don't have any properties)
- Only throws if value is an object that actually has the specified property

#### Bug #13 (gRPC ENOENT 'main.proto' Error)

**Root Cause:** Two issues:
1. The gRPC proxy was using `@grpc/proto-loader`'s `load("main.proto")` function which tries to read from the filesystem, but proto definitions are passed as strings in the request body
2. The client was only sending the main proto file, not its dependencies (imported proto files), causing "no such type" errors for types defined in other files

**Fix Applied:**

*Server-side (grpc-proxy):*
- Replaced `@grpc/proto-loader` with direct `protobufjs` parsing
- Proto content strings are now parsed directly using `protobuf.parse(content, root, { keepCase: true })`
- Well-known Google types and additional proto imports are parsed into the same Root
- Created `createGrpcObject()` function to convert protobufjs Root to gRPC service definitions
- Created `createServiceClientConstructor()` to build proper gRPC client constructors with serializers/deserializers
- Uses `grpc.makeGenericClientConstructor()` with the service definitions

*Client-side (page.tsx and workflowRunner.ts):*
- Added logic to gather all proto schemas from the database
- All proto files are now sent as `additionalProtos` in the gRPC request
- This ensures cross-file type references (like `OrderNote`) are resolved correctly

---

## Demo Collection

A comprehensive demo collection is available to showcase all Sendr features using publicly available test APIs. All demo files are located in the `demo/` directory (separate from docs).

### Files

| File | Description |
|------|-------------|
| `demo/README.md` | Quick start guide for the demo collection |
| `demo/demo-collection.json` | Sendr export file with 7 collections (36 requests) |
| `demo/demo-environment.json` | Environment variables reference |
| `demo/demo-collection.md` | Planning document with detailed specifications |
| `demo/GRPC-TESTING.md` | gRPC setup and testing guide |
| `demo/protos/` | Sample proto files for gRPC testing |

### Collections Included

1. **Basic Requests** - GET, POST, PUT, PATCH, DELETE operations
2. **Body Types** - JSON, Form Data, URL Encoded, XML, Raw Text
3. **Authentication** - Bearer, Basic, API Key (header & query)
4. **Variables & Scripting** - Pre-request scripts, variable chaining, interpolation
5. **Response Visualizer** - Table, Cards, List, Key-Value views
6. **Workflow Demo** - Complete CRUD workflow with variable passing
7. **gRPC Demo** - Unary calls with complex nested messages

### Sample Proto Files

Realistic proto files demonstrating:
- Nested imports across packages
- Well-known Google types (timestamp, field_mask, empty)
- Complex message structures (nested messages, maps, enums, oneOf)
- Cross-package type references

```
demo/protos/
├── common/types.proto       # Money, Address, Pagination
├── common/enums.proto       # Status, Currency, SortOrder
├── user/v1/user.proto       # User message
├── user/v1/user_service.proto # UserService (8 RPC methods)
├── order/v1/order.proto     # Order message (complex)
└── order/v1/order_service.proto # OrderService (9 RPC methods)
```

### How to Use

1. Import `demo/demo-collection.json` using the Import/Export feature
2. Create a new environment with variables from `demo/demo-environment.json`
3. Select the environment and run any collection
4. Use the Workflow Runner on "6. Workflow Demo" to see sequential execution
5. For gRPC: Upload proto files from `demo/protos/` and see `demo/GRPC-TESTING.md`

---

## Future Enhancements

- [ ] OAuth 2.0 Authentication (Authorization Code, Client Credentials flows)
- [ ] Request History
- [ ] Code Generation (cURL, JavaScript, Python snippets)
- [ ] WebSocket Support
- [ ] GraphQL Support
- [ ] gRPC Streaming Support
