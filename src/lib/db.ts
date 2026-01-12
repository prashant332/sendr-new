import Dexie, { type EntityTable } from "dexie";

export interface Collection {
  id: string;
  name: string;
  createdAt: number;
}

export interface SavedRequest {
  id: string;
  collectionId: string;
  name: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  url: string;
  headers: { key: string; value: string; active: boolean }[];
  params: { key: string; value: string; active: boolean }[];
  body: string;
  preRequestScript: string;
  testScript: string;
}

const db = new Dexie("SendrDB") as Dexie & {
  collections: EntityTable<Collection, "id">;
  requests: EntityTable<SavedRequest, "id">;
};

db.version(1).stores({
  collections: "id, name, createdAt",
  requests: "id, collectionId, name",
});

export { db };
