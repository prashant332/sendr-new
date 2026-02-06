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

// ============================================================================
// Virtual Folder Operations
// ============================================================================

/**
 * Rename a virtual folder by updating all request name prefixes.
 * Example: renameFolder(collectionId, "Users/CRUD", "Users/Operations")
 * Changes "Users/CRUD/Create" → "Users/Operations/Create"
 */
export async function renameFolder(
  collectionId: string,
  oldPath: string,
  newPath: string
): Promise<number> {
  const requests = await db.requests
    .where("collectionId")
    .equals(collectionId)
    .toArray();

  const oldPrefix = oldPath + "/";
  const newPrefix = newPath + "/";
  let updatedCount = 0;

  await db.transaction("rw", db.requests, async () => {
    for (const request of requests) {
      if (request.name.startsWith(oldPrefix)) {
        // Request is inside the folder
        const newName = newPrefix + request.name.slice(oldPrefix.length);
        await db.requests.update(request.id, { name: newName });
        updatedCount++;
      } else if (request.name === oldPath) {
        // Request name exactly matches folder path (edge case)
        await db.requests.update(request.id, { name: newPath });
        updatedCount++;
      }
    }
  });

  return updatedCount;
}

/**
 * Delete a virtual folder.
 * @param keepRequests - If true, moves requests to parent folder (removes folder segment).
 *                       If false, deletes all requests in the folder.
 */
export async function deleteFolder(
  collectionId: string,
  folderPath: string,
  keepRequests: boolean
): Promise<number> {
  const requests = await db.requests
    .where("collectionId")
    .equals(collectionId)
    .toArray();

  const folderPrefix = folderPath + "/";
  // Get parent path (everything before the last segment)
  const lastSlash = folderPath.lastIndexOf("/");
  const parentPrefix = lastSlash > 0 ? folderPath.slice(0, lastSlash + 1) : "";
  let affectedCount = 0;

  await db.transaction("rw", db.requests, async () => {
    for (const request of requests) {
      if (request.name.startsWith(folderPrefix)) {
        if (keepRequests) {
          // Move to parent: "folder/subfolder/request" → "folder/request" or "request"
          const nameWithoutFolder = request.name.slice(folderPrefix.length);
          const newName = parentPrefix + nameWithoutFolder;
          await db.requests.update(request.id, { name: newName });
        } else {
          // Delete the request
          await db.requests.delete(request.id);
        }
        affectedCount++;
      }
    }
  });

  return affectedCount;
}

/**
 * Move a request to a different folder by updating its name prefix.
 * @param targetFolder - Target folder path, or empty string for root
 */
export async function moveRequestToFolder(
  requestId: string,
  targetFolder: string
): Promise<void> {
  const request = await db.requests.get(requestId);
  if (!request) return;

  // Extract just the request name (last segment)
  const segments = request.name.split("/");
  const requestName = segments.pop()!;

  // Build new name
  const newName = targetFolder ? `${targetFolder}/${requestName}` : requestName;

  await db.requests.update(requestId, { name: newName });
}

/**
 * Get all requests in a folder (for counting, etc.)
 */
export async function getRequestsInFolder(
  collectionId: string,
  folderPath: string
): Promise<SavedRequest[]> {
  const requests = await db.requests
    .where("collectionId")
    .equals(collectionId)
    .toArray();

  const folderPrefix = folderPath + "/";
  return requests.filter((r) => r.name.startsWith(folderPrefix));
}

export type { Collection, SavedRequest };
