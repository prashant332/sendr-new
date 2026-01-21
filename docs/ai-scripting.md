# AI-Powered Script Generation

[Back to main documentation](../CLAUDE.md)

---

## Status

**~95% Complete** - Core AI script generation is fully implemented.

| Feature | Status |
|---------|--------|
| LLM Provider Adapters | Implemented |
| AI Script Assistant Panel | Implemented |
| Provider Configuration | Implemented |
| Quick Actions | Implemented |
| Context Builder | Implemented |
| Script Validation | Implemented |
| Conversation History | Implemented |
| Explain Script | Future |
| Fix Script | Future |

---

## Overview

Generate pre-request and test scripts using natural language prompts, powered by any LLM provider.

**Example Prompts:**
- "Filter offers from response and save the cheapest one under $100 to `cheapOffer` variable"
- "Extract the auth token from response headers and set it as `authToken`"
- "Assert that all items in the response have a status of 'active'"
- "Loop through users and find the one with email containing 'admin'"

**Key Principles:**
1. **Provider Agnostic** - Support multiple LLM providers
2. **Context-Aware** - LLM understands response structure and available APIs
3. **Secure** - API keys stored locally, never sent to external servers
4. **Iterative** - Refine generated scripts through conversation

---

## Supported Providers

| Provider | Type | Description |
|----------|------|-------------|
| OpenAI | Cloud | GPT-4, GPT-3.5-turbo |
| Anthropic | Cloud | Claude 3 (Opus, Sonnet, Haiku) |
| Google Gemini | Cloud | Gemini Pro, Gemini Flash |
| Ollama | Local | Llama3, Mistral, CodeLlama |
| Custom | Any | Any OpenAI-compatible API |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         User Interface                              │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  "Filter offers under $100 and save cheapest to variable"     │  │
│  │  [Generate Script]                                            │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Context Builder                                │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐   │
│  │  Response JSON  │ │  pm API Docs    │ │  Environment Vars   │   │
│  │  (Schema/Sample)│ │  (Reference)    │ │  (Available)        │   │
│  └─────────────────┘ └─────────────────┘ └─────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      LLM Provider Adapter                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │  OpenAI  │ │ Anthropic│ │  Ollama  │ │  Gemini  │ │  Custom  │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Script Validator                               │
│  - Syntax validation                                                │
│  - Security checks (no eval, fetch, etc.)                           │
│  - pm API usage validation                                          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Models

### LLM Provider Configuration

```typescript
interface AIProvider {
  id: string;
  name: string;                    // "My OpenAI"
  type: "openai" | "anthropic" | "gemini" | "ollama" | "custom";
  baseUrl: string;                 // API endpoint
  model: string;                   // "gpt-4", "claude-3-opus"
  apiKey: string;                  // Stored locally
}

interface AISettings {
  providers: AIProvider[];
  defaultProviderId: string | null;
}
```

### Script Generation Context

```typescript
interface ScriptContext {
  responseSchema?: JSONSchema;     // Inferred from response
  responseSample?: unknown;        // Truncated response data
  environmentVariables: string[];  // Available variable names
  existingScript?: string;         // Current script
  requestDetails: {
    method: string;
    url: string;
    isGrpc: boolean;
  };
}
```

---

## Context Builder

The context builder intelligently prepares information for the LLM:

### JSON Schema Inference

Automatically infers schema from response data:

```typescript
// Response
{ "users": [{ "id": 1, "name": "John" }] }

// Inferred Schema
{
  "type": "object",
  "properties": {
    "users": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "number" },
          "name": { "type": "string" }
        }
      }
    }
  }
}
```

### Response Sanitization

- Truncates large responses to reduce tokens
- Redacts sensitive fields (password, token, secret)
- Limits array items to first 3 elements

---

## Quick Actions

Auto-suggested actions based on response analysis:

| Pattern Detected | Suggested Action |
|------------------|------------------|
| `token` or `access_token` | "Save auth token" |
| `id` or `userId` | "Save ID" |
| Array fields | "Filter {field}" |
| Pagination fields | "Handle pagination" |
| Always | "Assert status 200", "Validate schema" |

---

## Script Validation

Generated scripts are validated before insertion:

### Syntax Validation
- Parsed without execution
- Reports line numbers for errors

### Security Checks

| Pattern | Blocked |
|---------|---------|
| `eval()` | Yes |
| `Function()` | Yes |
| `fetch()` | Yes |
| `require()` | Yes |
| `import` | Yes |
| `process.` | Yes |
| `window.` | Yes |

### API Usage Validation

- Pre-request scripts cannot use `pm.response`
- Warns if `pm.test` used in pre-request scripts

---

## UI Components

### AI Script Assistant Panel

Access via the "AI Generate" button in the Scripts tab:

1. **Provider Selector** - Choose LLM provider
2. **Prompt Input** - Describe what you want
3. **Generate Button** - For test or pre-request script
4. **Generated Script** - Monaco editor with result
5. **Explanation** - What the script does
6. **Actions** - Insert, Copy, Refine

### AI Settings Modal

Configure LLM providers:

1. **Add Provider** - Select type, enter API key, choose model
2. **Test Connection** - Verify API key works
3. **Set Default** - Choose default provider
4. **Edit/Delete** - Manage existing providers

---

## Example Generated Scripts

### Filter and Save

**Prompt:** "Filter offers under $100 and save the cheapest"

```javascript
const response = pm.response.json();

const affordableOffers = response.offers
  .filter(offer => offer.price < 100)
  .sort((a, b) => a.price - b.price);

if (affordableOffers.length > 0) {
  pm.environment.set("bestDeal", JSON.stringify(affordableOffers[0]));
  
  pm.test("Found affordable offer", () => {
    pm.expect(affordableOffers[0].price).to.be.below(100);
  });
}
```

### Validate Emails

**Prompt:** "Verify all users have valid email addresses"

```javascript
const response = pm.response.json();
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

pm.test("All users have valid emails", () => {
  const invalidEmails = response.users.filter(
    user => !emailRegex.test(user.email)
  );
  pm.expect(invalidEmails).to.have.lengthOf(0);
});
```

---

## API Endpoint

### POST /api/ai/generate

Proxies requests to LLM providers to avoid CORS issues.

**Request:**
```typescript
{
  provider: "openai" | "anthropic" | "gemini" | "ollama" | "custom";
  apiKey: string;
  model: string;
  messages: Message[];
  baseUrl: string;
}
```

**Response:**
```typescript
{
  script: string;
  explanation: string;
}
```

---

## Security Considerations

1. **API Key Storage** - Keys stored in IndexedDB, never sent to Sendr servers
2. **Response Privacy** - Response samples truncated and sanitized before sending to LLM
3. **Script Safety** - All scripts validated before insertion
4. **Local Option** - Ollama support for fully local generation

---

## Files

| File | Purpose |
|------|---------|
| `src/components/AIScriptAssistant.tsx` | AI generation panel |
| `src/components/AISettingsModal.tsx` | Provider configuration |
| `src/components/QuickActions.tsx` | Quick action suggestions |
| `src/lib/ai/adapters/base.ts` | LLM adapter interface |
| `src/lib/ai/adapters/openai.ts` | OpenAI adapter |
| `src/lib/ai/adapters/gemini.ts` | Gemini adapter |
| `src/lib/ai/adapters/index.ts` | Adapter registry |
| `src/lib/ai/contextBuilder.ts` | Context building |
| `src/lib/ai/systemPrompt.ts` | System prompts |
| `src/lib/ai/types.ts` | Type definitions |
| `src/store/aiStore.ts` | AI settings store |
| `src/app/api/ai/generate/route.ts` | LLM proxy endpoint |

---

## Implementation Phases

### Phase 19: AI Foundation ✅
- [x] Create AISettings store with IndexedDB persistence
- [x] Implement LLM adapter interface
- [x] Create OpenAI, Gemini, Anthropic, Ollama adapters
- [x] Build secure API key storage

### Phase 20: Script Generation ✅
- [x] Design system prompt
- [x] Build context builder
- [x] Create AI Script Assistant panel
- [x] Implement conversation history

### Phase 21: Smart Context ✅
- [x] JSON schema inference
- [x] Response sanitization
- [x] Environment variables in context

### Phase 22: Quick Actions ✅
- [x] Response analysis
- [x] Suggestion engine
- [x] Quick action UI

### Phase 23: Advanced Features (Partial)
- [ ] Explain Script feature
- [ ] Fix Script for error recovery
- [ ] Auto-generate assertions option
