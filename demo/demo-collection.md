# Demo Collection Plan

[Back to main documentation](../CLAUDE.md) | [Quick Start](README.md) | [gRPC Testing](GRPC-TESTING.md)

---

## Overview

A comprehensive demo collection that showcases all Sendr features using publicly available test APIs and gRPC with sample proto files. The collection can be imported to demonstrate capabilities during demos or for testing.

---

## Public APIs to Use

| API | Base URL | Purpose |
|-----|----------|---------|
| JSONPlaceholder | `https://jsonplaceholder.typicode.com` | REST CRUD operations, free, no auth |
| HTTPBin | `https://httpbin.org` | Echo service for headers, auth, body types |
| ReqRes | `https://reqres.in` | User API with pagination, auth simulation |
| Dog CEO | `https://dog.ceo/api` | Simple API with images (for visualizer demo) |
| GitHub API | `https://api.github.com` | Real-world API with headers |

---

## Features to Demonstrate

### 1. HTTP Methods & Basic Requests
- [x] GET request
- [x] POST with JSON body
- [x] PUT request
- [x] PATCH request
- [x] DELETE request

### 2. Request Body Types
- [x] JSON body
- [x] Form data (multipart)
- [x] URL-encoded form
- [x] XML body
- [x] Raw text

### 3. Authentication Types
- [x] Bearer token
- [x] Basic auth
- [x] API Key (header)
- [x] API Key (query param)

### 4. Variable Interpolation
- [x] Variables in URL
- [x] Variables in headers
- [x] Variables in body
- [x] Nested variables (variable containing variable)

### 5. Scripting (Pre-request & Test)
- [x] `pm.environment.get()` and `pm.environment.set()`
- [x] `pm.response.json()`
- [x] `pm.test()` with assertions
- [x] `pm.expect()` with Chai matchers
- [x] `console.log()` output
- [x] Variable chaining between requests

### 6. Response Visualizer
- [x] Table view (array of objects)
- [x] Cards view (with title/subtitle)
- [x] List view (array of primitives)
- [x] Key-Value view (single object)

### 7. Workflow Runner
- [x] Sequential execution
- [x] Variable passing between requests
- [x] Test results aggregation

---

## Collection Structure

```
Demo Collection
├── 1. Basic Requests
│   ├── GET - List Users
│   ├── GET - Single User
│   ├── POST - Create User
│   ├── PUT - Update User
│   ├── PATCH - Partial Update
│   └── DELETE - Delete User
│
├── 2. Body Types
│   ├── JSON Body
│   ├── Form Data (Multipart)
│   ├── URL Encoded Form
│   ├── XML Body
│   └── Raw Text Body
│
├── 3. Authentication
│   ├── Bearer Token Auth
│   ├── Basic Auth
│   ├── API Key (Header)
│   └── API Key (Query)
│
├── 4. Variables & Scripting
│   ├── Set Variables (Pre-request)
│   ├── Use Variables in URL
│   ├── Use Variables in Headers
│   ├── Chain Variables Between Requests
│   └── Nested Variable Resolution
│
├── 5. Response Visualizer
│   ├── Table View - Users List
│   ├── Cards View - Posts
│   ├── List View - Dog Breeds
│   └── Key-Value View - User Details
│
└── 6. Workflow Demo
    ├── Step 1: Create Resource
    ├── Step 2: Get Created Resource
    ├── Step 3: Update Resource
    └── Step 4: Delete Resource
```

---

## Environment Variables

The demo collection requires an environment with these variables:

| Variable | Default Value | Description |
|----------|---------------|-------------|
| `baseUrl` | `https://jsonplaceholder.typicode.com` | Primary API base URL |
| `httpBinUrl` | `https://httpbin.org` | HTTPBin for echo tests |
| `reqResUrl` | `https://reqres.in/api` | ReqRes API |
| `dogApiUrl` | `https://dog.ceo/api` | Dog CEO API |
| `testToken` | `demo-token-12345` | Demo bearer token |
| `testUser` | `testuser` | Demo username |
| `testPass` | `testpass123` | Demo password |
| `apiKey` | `demo-api-key-xyz` | Demo API key |
| `userId` | `1` | Test user ID |
| `postId` | `1` | Test post ID |

---

## Request Details

### Collection 1: Basic Requests

#### 1.1 GET - List Users
```
Method: GET
URL: {{baseUrl}}/users
Test Script:
  pm.test("Status is 200", () => {
    pm.expect(pm.response.status).to.equal(200);
  });
  pm.test("Returns array of users", () => {
    const data = pm.response.json();
    pm.expect(data).to.be.an("array");
    pm.expect(data.length).to.be.greaterThan(0);
  });
```

#### 1.2 GET - Single User
```
Method: GET
URL: {{baseUrl}}/users/{{userId}}
Test Script:
  pm.test("Status is 200", () => {
    pm.expect(pm.response.status).to.equal(200);
  });
  pm.test("Returns user object", () => {
    const user = pm.response.json();
    pm.expect(user).to.have.property("id");
    pm.expect(user).to.have.property("name");
    pm.expect(user).to.have.property("email");
  });
```

#### 1.3 POST - Create User
```
Method: POST
URL: {{baseUrl}}/users
Body (JSON):
  {
    "name": "John Doe",
    "username": "johndoe",
    "email": "john@example.com"
  }
Test Script:
  pm.test("Status is 201", () => {
    pm.expect(pm.response.status).to.equal(201);
  });
  pm.test("Returns created user with ID", () => {
    const user = pm.response.json();
    pm.expect(user).to.have.property("id");
    pm.environment.set("createdUserId", user.id);
    console.log("Created user ID:", user.id);
  });
```

#### 1.4 PUT - Update User
```
Method: PUT
URL: {{baseUrl}}/users/{{userId}}
Body (JSON):
  {
    "id": {{userId}},
    "name": "Jane Doe Updated",
    "username": "janedoe",
    "email": "jane.updated@example.com"
  }
Test Script:
  pm.test("Status is 200", () => {
    pm.expect(pm.response.status).to.equal(200);
  });
```

#### 1.5 PATCH - Partial Update
```
Method: PATCH
URL: {{baseUrl}}/users/{{userId}}
Body (JSON):
  {
    "email": "patched@example.com"
  }
Test Script:
  pm.test("Status is 200", () => {
    pm.expect(pm.response.status).to.equal(200);
  });
```

#### 1.6 DELETE - Delete User
```
Method: DELETE
URL: {{baseUrl}}/users/{{userId}}
Test Script:
  pm.test("Status is 200", () => {
    pm.expect(pm.response.status).to.equal(200);
  });
```

---

### Collection 2: Body Types

#### 2.1 JSON Body
```
Method: POST
URL: {{httpBinUrl}}/post
Body (JSON):
  {
    "message": "Hello from Sendr",
    "timestamp": "2024-01-15T10:30:00Z",
    "nested": {
      "key": "value"
    }
  }
Test Script:
  pm.test("Echo returns JSON body", () => {
    const data = pm.response.json();
    pm.expect(data.json.message).to.equal("Hello from Sendr");
  });
```

#### 2.2 Form Data (Multipart)
```
Method: POST
URL: {{httpBinUrl}}/post
Body (form-data):
  field1: value1
  field2: value2
  description: This is a test form submission
Test Script:
  pm.test("Echo returns form data", () => {
    const data = pm.response.json();
    pm.expect(data.form.field1).to.equal("value1");
  });
```

#### 2.3 URL Encoded Form
```
Method: POST
URL: {{httpBinUrl}}/post
Body (x-www-form-urlencoded):
  username: {{testUser}}
  password: {{testPass}}
  remember: true
Test Script:
  pm.test("Echo returns form data", () => {
    const data = pm.response.json();
    pm.expect(data.form).to.have.property("username");
  });
```

#### 2.4 XML Body
```
Method: POST
URL: {{httpBinUrl}}/post
Headers:
  Content-Type: application/xml
Body (XML):
  <?xml version="1.0" encoding="UTF-8"?>
  <request>
    <user>
      <name>John Doe</name>
      <email>john@example.com</email>
    </user>
  </request>
Test Script:
  pm.test("Status is 200", () => {
    pm.expect(pm.response.status).to.equal(200);
  });
```

#### 2.5 Raw Text Body
```
Method: POST
URL: {{httpBinUrl}}/post
Headers:
  Content-Type: text/plain
Body (raw):
  This is plain text content.
  It can span multiple lines.
Test Script:
  pm.test("Echo returns text body", () => {
    const data = pm.response.json();
    pm.expect(data.data).to.include("plain text");
  });
```

---

### Collection 3: Authentication

#### 3.1 Bearer Token Auth
```
Method: GET
URL: {{httpBinUrl}}/bearer
Auth Type: Bearer
  Token: {{testToken}}
Test Script:
  pm.test("Auth header sent correctly", () => {
    const data = pm.response.json();
    pm.expect(data.authenticated).to.be.true;
  });
```

#### 3.2 Basic Auth
```
Method: GET
URL: {{httpBinUrl}}/basic-auth/{{testUser}}/{{testPass}}
Auth Type: Basic
  Username: {{testUser}}
  Password: {{testPass}}
Test Script:
  pm.test("Basic auth successful", () => {
    const data = pm.response.json();
    pm.expect(data.authenticated).to.be.true;
    pm.expect(data.user).to.equal("testuser");
  });
```

#### 3.3 API Key (Header)
```
Method: GET
URL: {{httpBinUrl}}/headers
Auth Type: API Key
  Key: X-API-Key
  Value: {{apiKey}}
  Add To: Header
Test Script:
  pm.test("API key sent in header", () => {
    const data = pm.response.json();
    pm.expect(data.headers["X-Api-Key"]).to.equal("demo-api-key-xyz");
  });
```

#### 3.4 API Key (Query)
```
Method: GET
URL: {{httpBinUrl}}/get
Auth Type: API Key
  Key: api_key
  Value: {{apiKey}}
  Add To: Query
Test Script:
  pm.test("API key sent in query", () => {
    const data = pm.response.json();
    pm.expect(data.args.api_key).to.equal("demo-api-key-xyz");
  });
```

---

### Collection 4: Variables & Scripting

#### 4.1 Set Variables (Pre-request)
```
Method: GET
URL: {{baseUrl}}/posts/1
Pre-request Script:
  // Set dynamic variables before request
  pm.environment.set("requestTime", new Date().toISOString());
  pm.environment.set("randomId", Math.floor(Math.random() * 100));
  console.log("Pre-request: Variables set");
Test Script:
  pm.test("Can read variables set in pre-request", () => {
    const requestTime = pm.environment.get("requestTime");
    pm.expect(requestTime).to.be.a("string");
    console.log("Request was made at:", requestTime);
  });
```

#### 4.2 Use Variables in URL
```
Method: GET
URL: {{baseUrl}}/posts/{{postId}}/comments
Test Script:
  pm.test("Returns comments for post", () => {
    const data = pm.response.json();
    pm.expect(data).to.be.an("array");
  });
```

#### 4.3 Use Variables in Headers
```
Method: GET
URL: {{httpBinUrl}}/headers
Headers:
  X-Custom-Header: {{testToken}}
  X-Request-Id: request-{{userId}}-{{postId}}
Test Script:
  pm.test("Custom headers sent correctly", () => {
    const data = pm.response.json();
    pm.expect(data.headers["X-Custom-Header"]).to.include("demo-token");
  });
```

#### 4.4 Chain Variables Between Requests
```
Method: POST
URL: {{baseUrl}}/posts
Body (JSON):
  {
    "title": "Test Post from Sendr",
    "body": "This post was created to test variable chaining",
    "userId": {{userId}}
  }
Test Script:
  pm.test("Extract and save post ID for next request", () => {
    const post = pm.response.json();
    pm.environment.set("chainedPostId", post.id);
    console.log("Saved post ID for chaining:", post.id);
  });
```

#### 4.5 Nested Variable Resolution
```
Method: GET
URL: {{nestedUrl}}
Pre-request Script:
  // Demonstrate nested variable resolution
  // Set baseUrl if not already set, then use it in another variable
  pm.environment.set("protocol", "https");
  pm.environment.set("host", "jsonplaceholder.typicode.com");
  pm.environment.set("nestedUrl", "{{protocol}}://{{host}}/users/1");
Test Script:
  pm.test("Nested variables resolved correctly", () => {
    pm.expect(pm.response.status).to.equal(200);
  });
```

---

### Collection 5: Response Visualizer

#### 5.1 Table View - Users List
```
Method: GET
URL: {{baseUrl}}/users
Description: Returns array of user objects - best viewed as Table
Test Script:
  pm.test("Returns users for table view", () => {
    const users = pm.response.json();
    pm.expect(users).to.be.an("array");
    pm.expect(users[0]).to.have.property("name");
    pm.expect(users[0]).to.have.property("email");
  });
```

#### 5.2 Cards View - Posts
```
Method: GET
URL: {{baseUrl}}/posts?_limit=6
Description: Returns posts with title/body - best viewed as Cards
Test Script:
  pm.test("Returns posts for cards view", () => {
    const posts = pm.response.json();
    pm.expect(posts).to.be.an("array");
    pm.expect(posts[0]).to.have.property("title");
    pm.expect(posts[0]).to.have.property("body");
  });
```

#### 5.3 List View - Dog Breeds
```
Method: GET
URL: {{dogApiUrl}}/breeds/list/all
Description: Returns object with breed arrays - demonstrates list view
Test Script:
  pm.test("Returns breed list", () => {
    const data = pm.response.json();
    pm.expect(data).to.have.property("message");
    pm.expect(data.status).to.equal("success");
  });
```

#### 5.4 Key-Value View - User Details
```
Method: GET
URL: {{baseUrl}}/users/1
Description: Returns single user object - best viewed as Key-Value
Test Script:
  pm.test("Returns user details", () => {
    const user = pm.response.json();
    pm.expect(user).to.be.an("object");
    pm.expect(user.id).to.equal(1);
  });
```

---

### Collection 6: Workflow Demo

This collection demonstrates a complete CRUD workflow with variable chaining.

#### 6.1 Step 1: Create Resource
```
Method: POST
URL: {{baseUrl}}/posts
Body (JSON):
  {
    "title": "Workflow Demo Post",
    "body": "Created by Sendr workflow runner",
    "userId": 1
  }
Test Script:
  pm.test("Resource created", () => {
    pm.expect(pm.response.status).to.equal(201);
    const data = pm.response.json();
    pm.environment.set("workflowPostId", data.id);
    console.log("Created post ID:", data.id);
  });
```

#### 6.2 Step 2: Get Created Resource
```
Method: GET
URL: {{baseUrl}}/posts/{{workflowPostId}}
Test Script:
  pm.test("Can retrieve created resource", () => {
    pm.expect(pm.response.status).to.equal(200);
    const post = pm.response.json();
    pm.expect(post.title).to.include("Workflow");
  });
```

#### 6.3 Step 3: Update Resource
```
Method: PUT
URL: {{baseUrl}}/posts/{{workflowPostId}}
Body (JSON):
  {
    "id": {{workflowPostId}},
    "title": "Updated Workflow Post",
    "body": "Modified by Sendr workflow runner",
    "userId": 1
  }
Test Script:
  pm.test("Resource updated", () => {
    pm.expect(pm.response.status).to.equal(200);
    const post = pm.response.json();
    pm.expect(post.title).to.include("Updated");
    console.log("Successfully updated post");
  });
```

#### 6.4 Step 4: Delete Resource
```
Method: DELETE
URL: {{baseUrl}}/posts/{{workflowPostId}}
Test Script:
  pm.test("Resource deleted", () => {
    pm.expect(pm.response.status).to.equal(200);
    console.log("Workflow complete - resource cleaned up");
  });
```

---

## File Deliverables

1. **`demo-collection.json`** - ✅ Created - Sendr JSON export format file containing all 6 collections (32 requests)
2. **`demo-environment.json`** - ✅ Created - Environment variables file with setup instructions
3. **`progress.md`** - ✅ Updated - Added Demo Collection section with usage instructions

---

## Implementation Checklist

- [x] Create demo-collection.json with all requests
- [ ] Test each request manually
- [ ] Verify all test scripts pass
- [ ] Run workflow collection end-to-end
- [ ] Test import functionality
- [x] Document any API limitations or workarounds

---

## Notes

### API Limitations

1. **JSONPlaceholder**: Mock API - POST/PUT/DELETE return fake responses but don't actually persist data
2. **HTTPBin**: May have rate limits; some endpoints may be slow
3. **ReqRes**: Free tier may have limitations
4. **Dog CEO**: Read-only API, good for visualizer demos

### Best Practices for Demo

1. Start with basic GET requests to show instant value
2. Progress to POST/PUT to show body editing
3. Demonstrate auth with HTTPBin's auth endpoints
4. Use workflow runner to show variable chaining
5. End with visualizer to show data presentation

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-01-XX | Initial demo collection plan |
