import { useLiveQuery } from "dexie-react-hooks";
import { db, Collection, SavedRequest } from "@/lib/db";
import { generateUUID } from "@/lib/uuid";

export function useCollections() {
  const collections = useLiveQuery(() =>
    db.collections.orderBy("createdAt").toArray()
  );
  return collections ?? [];
}

export function useCollectionRequests(collectionId: string | null) {
  const requests = useLiveQuery(
    () => {
      if (!collectionId) return [];
      return db.requests.where("collectionId").equals(collectionId).toArray();
    },
    [collectionId]
  );
  return requests ?? [];
}

export function useRequest(requestId: string | null) {
  const request = useLiveQuery(
    () => {
      if (!requestId) return undefined;
      return db.requests.get(requestId);
    },
    [requestId]
  );
  return request ?? null;
}

export async function createCollection(name: string): Promise<string> {
  const id = generateUUID();
  await db.collections.add({
    id,
    name,
    createdAt: Date.now(),
  });
  return id;
}

export async function deleteCollection(id: string): Promise<void> {
  await db.transaction("rw", db.collections, db.requests, async () => {
    await db.requests.where("collectionId").equals(id).delete();
    await db.collections.delete(id);
  });
}

export async function createRequest(
  collectionId: string,
  request: Omit<SavedRequest, "id" | "collectionId">
): Promise<string> {
  const id = generateUUID();
  await db.requests.add({
    id,
    collectionId,
    ...request,
  });
  return id;
}

export async function updateRequest(
  id: string,
  updates: Partial<Omit<SavedRequest, "id">>
): Promise<void> {
  await db.requests.update(id, updates);
}

export async function deleteRequest(id: string): Promise<void> {
  await db.requests.delete(id);
}

export type { Collection, SavedRequest };
