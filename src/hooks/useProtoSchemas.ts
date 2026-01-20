import { useLiveQuery } from "dexie-react-hooks";
import { db, ProtoSchema } from "@/lib/db";
import { generateUUID } from "@/lib/uuid";

/**
 * Hook to get all proto schemas
 */
export function useProtoSchemas() {
  const schemas = useLiveQuery(() =>
    db.protoSchemas.orderBy("createdAt").reverse().toArray()
  );
  return schemas ?? [];
}

/**
 * Hook to get proto schemas for a specific collection (or global)
 */
export function useCollectionProtoSchemas(collectionId: string | null) {
  const schemas = useLiveQuery(
    () => {
      if (collectionId === null) {
        // Get global schemas (no collection association)
        return db.protoSchemas
          .filter((s) => !s.collectionId)
          .toArray();
      }
      // Get schemas for specific collection
      return db.protoSchemas
        .where("collectionId")
        .equals(collectionId)
        .toArray();
    },
    [collectionId]
  );
  return schemas ?? [];
}

/**
 * Hook to get a single proto schema by ID
 */
export function useProtoSchema(schemaId: string | null) {
  const schema = useLiveQuery(
    () => {
      if (!schemaId) return undefined;
      return db.protoSchemas.get(schemaId);
    },
    [schemaId]
  );
  return schema ?? null;
}

/**
 * Create a new proto schema
 */
export async function createProtoSchema(
  data: Omit<ProtoSchema, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const id = generateUUID();
  const now = Date.now();
  await db.protoSchemas.add({
    id,
    ...data,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

/**
 * Update an existing proto schema
 */
export async function updateProtoSchema(
  id: string,
  updates: Partial<Omit<ProtoSchema, "id" | "createdAt">>
): Promise<void> {
  await db.protoSchemas.update(id, {
    ...updates,
    updatedAt: Date.now(),
  });
}

/**
 * Delete a proto schema
 */
export async function deleteProtoSchema(id: string): Promise<void> {
  await db.protoSchemas.delete(id);
}

/**
 * Get a proto schema by its path (for import resolution)
 */
export async function getProtoSchemaByPath(
  path: string
): Promise<ProtoSchema | undefined> {
  return db.protoSchemas.where("path").equals(path).first();
}

/**
 * Get all proto schemas (non-hook version for import resolution)
 */
export async function getAllProtoSchemas(): Promise<ProtoSchema[]> {
  return db.protoSchemas.toArray();
}

export type { ProtoSchema };
