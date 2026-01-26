# gRPC Testing Guide

This guide explains how to test gRPC functionality in Sendr using the provided sample proto files.

---

## Overview

The demo includes realistic proto files demonstrating:
- **Nested imports** - Proto files importing other proto files
- **Cross-package references** - Types from one package used in another
- **Well-known types** - Google's timestamp, field_mask, empty types
- **Complex message structures** - Nested messages, repeated fields, maps, enums, oneOf

---

## Proto File Structure

```
demo/protos/
├── common/
│   ├── types.proto          # Common types (Money, Address, Pagination, PhoneNumber)
│   └── enums.proto          # Common enums (Status, Currency, SortOrder)
├── user/v1/
│   ├── user.proto           # User message (imports common/*, google/protobuf/*)
│   └── user_service.proto   # UserService with 8 RPC methods
└── order/v1/
    ├── order.proto          # Order message (imports user/*, common/*)
    └── order_service.proto  # OrderService with 9 RPC methods
```

### Import Hierarchy

```
order_service.proto
├── order.proto
│   ├── google/protobuf/timestamp.proto (well-known)
│   ├── common/types.proto
│   ├── common/enums.proto
│   └── user/v1/user.proto
│       ├── google/protobuf/timestamp.proto
│       ├── common/types.proto
│       └── common/enums.proto
└── common/types.proto

user_service.proto
├── google/protobuf/empty.proto (well-known)
├── google/protobuf/field_mask.proto (well-known)
├── user/v1/user.proto
├── common/types.proto
└── common/enums.proto
```

---

## Setting Up Proto Files in Sendr

### Step 1: Open Proto Schema Manager

1. In Sendr, click the **gear icon** (⚙️) in the top right
2. Select **"Manage Proto Schemas"**

### Step 2: Upload Proto Files (Order Matters!)

Upload files in dependency order (dependencies first):

1. **common/types.proto**
   - Path: `common/types.proto`

2. **common/enums.proto**
   - Path: `common/enums.proto`

3. **user/v1/user.proto**
   - Path: `user/v1/user.proto`

4. **user/v1/user_service.proto**
   - Path: `user/v1/user_service.proto`

5. **order/v1/order.proto**
   - Path: `order/v1/order.proto`

6. **order/v1/order_service.proto**
   - Path: `order/v1/order_service.proto`

> **Important:** The `path` field must match the import statements in the proto files exactly!

### Step 3: Verify Imports

After uploading, Sendr will show:
- Services discovered (UserService, OrderService)
- Methods available for each service
- Any import resolution warnings

If you see warnings about unresolved imports, check that:
1. The path matches the import statement exactly
2. The dependency file was uploaded before files that import it

---

## Testing Without a gRPC Server

If you don't have a gRPC server running, you can still:

1. **Upload proto files** to test parsing and sample generation
2. **Create gRPC requests** to see the message editor
3. **Generate sample messages** for complex nested types
4. **View the generated JSON** structure

The requests will fail with connection errors, but you can verify:
- Proto parsing works correctly
- Sample messages include nested types
- Variable interpolation works in gRPC messages

---

## Setting Up a Test gRPC Server

### Option 1: Using grpcurl (Echo/Reflection)

If your gRPC server supports reflection:

```bash
# Install grpcurl
brew install grpcurl  # macOS
# or
go install github.com/fullstorydev/grpcurl/cmd/grpcurl@latest

# List services
grpcurl -plaintext localhost:50051 list

# Call a method
grpcurl -plaintext -d '{"user_id": "123"}' \
  localhost:50051 user.v1.UserService/GetUser
```

### Option 2: Using buf (Local Mock Server)

```bash
# Install buf
brew install bufbuild/buf/buf

# Create buf.yaml in demo/protos/
cat > demo/protos/buf.yaml << 'EOF'
version: v1
name: buf.build/example/demo
EOF

# Generate and run mock server (requires buf schema registry)
buf build
```

### Option 3: Using Docker (Pre-built Test Server)

If you have a test gRPC server image:

```bash
# Run a gRPC test server
docker run -p 50051:50051 your-grpc-test-server:latest
```

### Option 4: Write a Simple Test Server

**Node.js example:**

```javascript
// server.js
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

// Load proto files
const packageDef = protoLoader.loadSync(
  path.join(__dirname, 'protos/user/v1/user_service.proto'),
  {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
    includeDirs: [path.join(__dirname, 'protos')]
  }
);

const userProto = grpc.loadPackageDefinition(packageDef).user.v1;

// Implement service
const users = new Map();

const userService = {
  CreateUser: (call, callback) => {
    const user = {
      id: `user-${Date.now()}`,
      email: call.request.email,
      display_name: call.request.display_name,
      profile: call.request.profile,
      status: 1, // ACTIVE
      created_at: { seconds: Math.floor(Date.now() / 1000) },
      roles: call.request.role_ids.map(id => ({ id, name: id, permissions: [] }))
    };
    users.set(user.id, user);
    callback(null, { user });
  },

  GetUser: (call, callback) => {
    const userId = call.request.user_id || call.request.email;
    const user = users.get(userId);
    if (user) {
      callback(null, { user });
    } else {
      callback({ code: grpc.status.NOT_FOUND, message: 'User not found' });
    }
  },

  ListUsers: (call, callback) => {
    const userList = Array.from(users.values());
    callback(null, {
      users: userList,
      pagination: {
        next_page_token: '',
        total_count: userList.length,
        has_more: false
      }
    });
  }
};

// Start server
const server = new grpc.Server();
server.addService(userProto.UserService.service, userService);
server.bindAsync('0.0.0.0:50051', grpc.ServerCredentials.createInsecure(), (err, port) => {
  if (err) {
    console.error('Server failed to start:', err);
    return;
  }
  console.log(`gRPC server running on port ${port}`);
  server.start();
});
```

Run with:
```bash
npm install @grpc/grpc-js @grpc/proto-loader
node server.js
```

---

## Demo Collection: gRPC Requests

The demo collection includes 5 gRPC requests:

### 1. CreateUser (Unary)
- **Service:** `user.v1.UserService`
- **Method:** `CreateUser`
- **Features:** Complex nested message with profile, pre-request script

### 2. GetUser (Unary)
- **Service:** `user.v1.UserService`
- **Method:** `GetUser`
- **Features:** Uses variable from previous request, Bearer auth via metadata

### 3. ListUsers (Unary)
- **Service:** `user.v1.UserService`
- **Method:** `ListUsers`
- **Features:** Pagination, filtering, sorting

### 4. CreateOrder (Complex)
- **Service:** `order.v1.OrderService`
- **Method:** `CreateOrder`
- **Features:** Cross-package types, nested arrays, idempotency key

### 5. GetOrderStats
- **Service:** `order.v1.OrderService`
- **Method:** `GetOrderStats`
- **Features:** Aggregation response, enum usage

---

## Testing Features

### Variable Interpolation in gRPC

Variables work in gRPC messages just like HTTP:

```json
{
  "user_id": "{{grpcUserId}}",
  "pagination": {
    "page_size": {{pageSize}}
  }
}
```

### gRPC Metadata

Metadata is the gRPC equivalent of HTTP headers:

```
Key: authorization
Value: Bearer {{testToken}}

Key: x-request-id
Value: {{requestId}}
```

### Test Scripts for gRPC

```javascript
// Check gRPC status
pm.test("gRPC status is OK", () => {
  pm.expect(pm.response.status.code).to.equal(0);
});

// Access response data
pm.test("User created", () => {
  const data = pm.response.json();
  pm.expect(data.user.id).to.be.a("string");
});

// Access response metadata
pm.test("Check metadata", () => {
  const metadata = pm.response.metadata();
  console.log("Metadata:", metadata);
});

// Access trailers
pm.test("Check trailers", () => {
  const trailers = pm.response.trailers();
  console.log("Trailers:", trailers);
});
```

### gRPC Status Codes

| Code | Name | Description |
|------|------|-------------|
| 0 | OK | Success |
| 1 | CANCELLED | Operation cancelled |
| 2 | UNKNOWN | Unknown error |
| 3 | INVALID_ARGUMENT | Invalid request |
| 4 | DEADLINE_EXCEEDED | Timeout |
| 5 | NOT_FOUND | Resource not found |
| 7 | PERMISSION_DENIED | Auth failed |
| 13 | INTERNAL | Server error |
| 14 | UNAVAILABLE | Service unavailable |

---

## Troubleshooting

### "Cannot resolve import"

**Problem:** Proto file imports another file that isn't uploaded.

**Solution:** Upload all dependency files with correct paths. Check that the path field matches the import statement exactly.

### "Message type not found"

**Problem:** Sample generation fails for a message type.

**Solution:**
1. Ensure all proto files are uploaded
2. Check that `resolveAll()` runs after parsing (automatic in Sendr)
3. Verify the message name matches (case-sensitive)

### "Connection refused"

**Problem:** gRPC server not running or wrong address.

**Solution:**
1. Verify server is running: `grpcurl -plaintext localhost:50051 list`
2. Check the `grpcServer` environment variable
3. For Docker: ensure port mapping is correct

### "14 UNAVAILABLE"

**Problem:** TLS/SSL configuration mismatch.

**Solution:**
- For local development, use `insecure: true` and `useTls: false`
- For production, configure proper TLS certificates

---

## Proto Features Demonstrated

| Feature | File | Example |
|---------|------|---------|
| Nested message | user.proto | `UserProfile` in `User` |
| Repeated fields | user.proto | `repeated Role roles` |
| Enum | enums.proto | `Status`, `Currency` |
| Map | order.proto | `map<string, string> attributes` |
| OneOf | user_service.proto | `oneof identifier { user_id, email }` |
| Well-known types | user.proto | `google.protobuf.Timestamp` |
| Field mask | user_service.proto | `google.protobuf.FieldMask` |
| Cross-package import | order.proto | `import "user/v1/user.proto"` |
| Nested enum | order.proto | `PaymentInfo.PaymentMethod` |

---

## Next Steps

1. Upload the proto files to Sendr
2. Import the demo collection
3. Set up your environment variables
4. Start a test gRPC server (or test parsing without one)
5. Run the gRPC demo requests

For more information, see the main [Sendr documentation](../CLAUDE.md).
