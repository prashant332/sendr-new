import Dexie, { type EntityTable } from "dexie";

export interface Collection {
  id: string;
  name: string;
  createdAt: number;
}

export type BodyMode = "none" | "json" | "xml" | "form-data" | "x-www-form-urlencoded" | "raw";

export interface RequestBody {
  mode: BodyMode;
  raw: string; // For json, xml, raw modes
  formData: { key: string; value: string; active: boolean }[]; // For form-data and x-www-form-urlencoded
}

export type AuthType = "none" | "bearer" | "basic" | "apikey";

export interface RequestAuth {
  type: AuthType;
  bearer: {
    token: string;
    headerKey: string; // Customizable, defaults to "Authorization"
    prefix: string; // Customizable, defaults to "Bearer"
  };
  basic: {
    username: string;
    password: string;
    headerKey: string; // Customizable, defaults to "Authorization"
  };
  apikey: {
    key: string;
    value: string;
    addTo: "header" | "query"; // Where to add the API key
  };
}

// Response template types for auto-generated UI
export type TemplateViewType = "auto" | "table" | "cards" | "list" | "keyvalue";

export interface TemplateColumn {
  key: string;
  label: string;
  visible: boolean;
  type: "string" | "number" | "boolean" | "date" | "url" | "image" | "object";
}

export interface ResponseTemplate {
  enabled: boolean;
  viewType: TemplateViewType;
  rootPath: string; // JSON path to data (e.g., "data.items" or "" for root)
  columns: TemplateColumn[];
  cardTitleField?: string;
  cardSubtitleField?: string;
}

// gRPC specific types
export interface GrpcMetadataEntry {
  key: string; // Lowercase, e.g., "authorization"
  value: string; // Supports {{variables}}
  active: boolean; // Toggle on/off without deleting
}

export interface GrpcConfig {
  protoSchemaId: string; // Reference to stored proto schema
  service: string; // Selected service full name (e.g., "user.v1.UserService")
  method: string; // Selected method name (e.g., "GetUser")
  useTls: boolean;
  insecure: boolean; // Skip TLS verification (dev only)
  timeout: number; // Request timeout in ms
  metadata: GrpcMetadataEntry[]; // Request metadata
}

// HTTP Method - includes GRPC as a "method" type
export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "GRPC";

export interface SavedRequest {
  id: string;
  collectionId: string;
  name: string;
  method: HttpMethod;
  url: string; // For HTTP: full URL, For gRPC: server address (e.g., "localhost:50051")
  headers: { key: string; value: string; active: boolean }[];
  params: { key: string; value: string; active: boolean }[];
  body: RequestBody;
  auth: RequestAuth;
  preRequestScript: string;
  testScript: string;
  responseTemplate?: ResponseTemplate;
  grpcConfig?: GrpcConfig; // Only used when method is "GRPC"
}

export interface Environment {
  id: string;
  name: string;
  variables: Record<string, string>;
}

export interface AppSettings {
  id: string;
  activeEnvironmentId: string | null;
  showInlinePreview?: boolean; // Show resolved variable preview below URL input
}

// AI Provider Types
export type AIProviderType = "openai" | "gemini" | "anthropic" | "ollama" | "custom";

export interface LLMProvider {
  id: string;
  name: string;
  type: AIProviderType;
  baseUrl: string;
  model: string;
  apiKey?: string;
  isDefault: boolean;
  createdAt: number;
}

export interface AISettings {
  id: string;
  providers: LLMProvider[];
  defaultProviderId: string | null;
  enableAutoSuggestions: boolean;
  includeResponseSample: boolean;
  maxTokens: number;
  temperature: number;
}

// Proto Schema for gRPC support
export interface ProtoSchema {
  id: string;
  name: string; // Filename only, e.g., "user_service.proto"
  path: string; // Logical path for import resolution, e.g., "user/v1/user_service.proto"
  content: string; // Raw .proto file content
  imports: string[]; // Resolved proto schema IDs this file depends on
  collectionId?: string; // Optional: associate with collection (null = global)
  createdAt: number;
  updatedAt: number;
}

// Parsed proto information (not stored, derived at runtime)
export interface ParsedService {
  name: string; // "UserService"
  fullName: string; // "myapp.users.v1.UserService"
  methods: ParsedMethod[];
}

export interface ParsedMethod {
  name: string; // "GetUser"
  inputType: string; // "GetUserRequest"
  outputType: string; // "GetUserResponse"
  clientStreaming: boolean;
  serverStreaming: boolean;
}

// gRPC status codes (google.rpc.Code)
export enum GrpcStatusCode {
  OK = 0,
  CANCELLED = 1,
  UNKNOWN = 2,
  INVALID_ARGUMENT = 3,
  DEADLINE_EXCEEDED = 4,
  NOT_FOUND = 5,
  ALREADY_EXISTS = 6,
  PERMISSION_DENIED = 7,
  RESOURCE_EXHAUSTED = 8,
  FAILED_PRECONDITION = 9,
  ABORTED = 10,
  OUT_OF_RANGE = 11,
  UNIMPLEMENTED = 12,
  INTERNAL = 13,
  UNAVAILABLE = 14,
  DATA_LOSS = 15,
  UNAUTHENTICATED = 16,
}

const db = new Dexie("SendrDB") as Dexie & {
  collections: EntityTable<Collection, "id">;
  requests: EntityTable<SavedRequest, "id">;
  environments: EntityTable<Environment, "id">;
  settings: EntityTable<AppSettings, "id">;
  aiSettings: EntityTable<AISettings, "id">;
  protoSchemas: EntityTable<ProtoSchema, "id">;
};

db.version(2).stores({
  collections: "id, name, createdAt",
  requests: "id, collectionId, name",
  environments: "id, name",
  settings: "id",
});

// Version 3: Add AI settings table
db.version(3).stores({
  collections: "id, name, createdAt",
  requests: "id, collectionId, name",
  environments: "id, name",
  settings: "id",
  aiSettings: "id",
});

// Version 4: Add proto schemas table for gRPC support
db.version(4).stores({
  collections: "id, name, createdAt",
  requests: "id, collectionId, name",
  environments: "id, name",
  settings: "id",
  aiSettings: "id",
  protoSchemas: "id, name, path, collectionId, createdAt",
});

export { db };
