"use client";

import { useState } from "react";
import { useCollections, createRequest } from "@/hooks/useCollections";
import type { KeyValuePair } from "@/components/KeyValueEditor";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

interface RequestData {
  method: HttpMethod;
  url: string;
  headers: KeyValuePair[];
  params: KeyValuePair[];
  body: string;
  preRequestScript: string;
  testScript: string;
}

interface SaveRequestModalProps {
  requestData: RequestData;
  onClose: () => void;
  onSaved: (requestId: string) => void;
}

export function SaveRequestModal({
  requestData,
  onClose,
  onSaved,
}: SaveRequestModalProps) {
  const collections = useCollections();
  const [name, setName] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !collectionId) return;
    setLoading(true);
    try {
      const id = await createRequest(collectionId, {
        name: name.trim(),
        method: requestData.method,
        url: requestData.url,
        headers: requestData.headers,
        params: requestData.params,
        body: requestData.body,
        preRequestScript: requestData.preRequestScript,
        testScript: requestData.testScript,
      });
      onSaved(id);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">Save Request</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">
              Request Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Get User Profile"
              className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">
              Collection
            </label>
            {collections.length === 0 ? (
              <div className="text-sm text-zinc-500">
                No collections. Create one first.
              </div>
            ) : (
              <select
                value={collectionId}
                onChange={(e) => setCollectionId(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm"
              >
                <option value="">Select a collection</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !name.trim() || !collectionId}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 rounded"
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
