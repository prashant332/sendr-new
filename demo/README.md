# Sendr Demo Collection

A comprehensive demo collection showcasing all Sendr features using publicly available test APIs.

---

## Quick Start

### 1. Import Collection (Includes Environment)

1. In Sendr, click **Import/Export** (or use keyboard shortcut)
2. Select **Import**
3. Choose `demo-collection.json`
4. All 7 collections AND the Demo Environment will be imported

> **Tip:** You can also import just the environment by choosing `demo-environment.json` if you want to set up variables without importing the collections.

### 2. Select the Environment

1. Click the **Environment dropdown** (top right)
2. Select **"Demo Environment"**

### 3. Start Testing!

Select any request from the sidebar and click **Send**.

---

## Environment Variables (Reference)

The following variables are automatically imported with the collection:

| Variable | Value |
|----------|-------|
| `baseUrl` | `https://jsonplaceholder.typicode.com` |
| `httpBinUrl` | `https://httpbin.org` |
| `dogApiUrl` | `https://dog.ceo/api` |
| `testToken` | `demo-token-12345` |
| `testUser` | `testuser` |
| `testPass` | `testpass123` |
| `apiKey` | `demo-api-key-xyz` |
| `userId` | `1` |
| `postId` | `1` |
| `grpcServer` | `localhost:50051` |

---

## Collections Included

| # | Collection | Requests | Features Demonstrated |
|---|------------|----------|----------------------|
| 1 | Basic Requests | 6 | GET, POST, PUT, PATCH, DELETE |
| 2 | Body Types | 5 | JSON, Form Data, URL Encoded, XML, Raw |
| 3 | Authentication | 5 | Bearer, Basic, API Key (header/query) |
| 4 | Variables & Scripting | 6 | Pre-request scripts, variable chaining |
| 5 | Response Visualizer | 5 | Table, Cards, List, Key-Value views |
| 6 | Workflow Demo | 4 | Sequential CRUD with variable passing |
| 7 | gRPC Demo | 5 | Unary calls, metadata, complex messages |

**Total: 36 requests**

---

## File Structure

```
demo/
├── README.md                 # This file
├── demo-collection.json      # Sendr collection export (import this)
├── demo-environment.json     # Environment variables reference
├── demo-collection.md        # Detailed planning document
├── GRPC-TESTING.md          # gRPC setup and testing guide
└── protos/                   # Sample proto files for gRPC
    ├── common/
    │   ├── types.proto       # Money, Address, Pagination
    │   └── enums.proto       # Status, Currency, SortOrder
    ├── user/v1/
    │   ├── user.proto        # User message
    │   └── user_service.proto # UserService (8 methods)
    └── order/v1/
        ├── order.proto       # Order message (complex)
        └── order_service.proto # OrderService (9 methods)
```

---

## Features by Collection

### 1. Basic Requests
- All HTTP methods (GET, POST, PUT, PATCH, DELETE)
- JSON request/response handling
- Status code assertions
- Response data validation

### 2. Body Types
- **JSON**: Nested objects, arrays
- **Form Data**: Multipart with active/inactive fields
- **URL Encoded**: Login-style form submission
- **XML**: Custom content-type header
- **Raw Text**: Plain text body

### 3. Authentication
- **Bearer Token**: Standard Authorization header
- **Basic Auth**: Username/password encoding
- **API Key (Header)**: Custom header name
- **API Key (Query)**: Query parameter
- **Custom Auth**: Non-standard header names and prefixes

### 4. Variables & Scripting
- Pre-request scripts setting variables
- Variable interpolation in URLs, headers, body
- Variable chaining between requests
- Dynamic variable generation (timestamps, random IDs)

### 5. Response Visualizer
- **Table View**: User list as sortable table
- **Cards View**: Posts with title/body as cards
- **List View**: Dog breeds data
- **Key-Value View**: Single user details
- **Images**: URL detection and preview

### 6. Workflow Demo
Complete CRUD workflow:
1. **Create** - POST new resource, save ID
2. **Read** - GET using saved ID
3. **Update** - PUT modified data
4. **Delete** - DELETE and verify

### 7. gRPC Demo
- Unary calls to UserService and OrderService
- Complex nested message structures
- Metadata (gRPC headers)
- Cross-package type usage
- Variable extraction from responses

---

## gRPC Testing

The gRPC collection requires:
1. Proto files uploaded to Sendr (from `protos/` directory)
2. A running gRPC server (or test parsing without one)

See [GRPC-TESTING.md](GRPC-TESTING.md) for detailed setup instructions.

---

## Public APIs Used

| API | URL | Purpose |
|-----|-----|---------|
| JSONPlaceholder | jsonplaceholder.typicode.com | REST CRUD, fake data |
| HTTPBin | httpbin.org | Request/response echo |
| Dog CEO | dog.ceo/api | Images, list data |

**Note:** These are free, public APIs. They may have rate limits or occasional downtime.

---

## Tips

### Running the Workflow
1. Select the "6. Workflow Demo" collection
2. Click the **Run** button to open Workflow Runner
3. Click **Start Run** to execute all 4 requests sequentially
4. Watch variables pass between requests

### Viewing Console Output
- Scripts use `console.log()` for debugging
- View output in the **Console** section after request completion
- Test results show pass/fail status

### Response Visualizer
- After running a request, check the **Rendered** tab
- Use the configuration panel to change view type
- Set root path for nested data (e.g., `message` for Dog API)

---

## Troubleshooting

### "Variable not found"
Ensure the Demo Environment is selected in the dropdown.

### "Connection refused" (gRPC)
The gRPC server isn't running. HTTP collections work without any server setup.

### "401 Unauthorized"
Check that auth credentials in environment match the API expectations (HTTPBin uses the credentials in the URL for basic auth).

---

## Contributing

To modify the demo collection:
1. Make changes in Sendr
2. Export the collection
3. Replace `demo-collection.json`
4. Update documentation as needed
