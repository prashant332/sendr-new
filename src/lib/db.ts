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

export interface SavedRequest {
  id: string;
  collectionId: string;
  name: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  url: string;
  headers: { key: string; value: string; active: boolean }[];
  params: { key: string; value: string; active: boolean }[];
  body: RequestBody;
  auth: RequestAuth;
  preRequestScript: string;
  testScript: string;
}

export interface Environment {
  id: string;
  name: string;
  variables: Record<string, string>;
}

export interface AppSettings {
  id: string;
  activeEnvironmentId: string | null;
}

const db = new Dexie("SendrDB") as Dexie & {
  collections: EntityTable<Collection, "id">;
  requests: EntityTable<SavedRequest, "id">;
  environments: EntityTable<Environment, "id">;
  settings: EntityTable<AppSettings, "id">;
};

db.version(2).stores({
  collections: "id, name, createdAt",
  requests: "id, collectionId, name",
  environments: "id, name",
  settings: "id",
});

export { db };
