"use client";

import { useState } from "react";
import {
  useCollections,
  useCollectionRequests,
  deleteCollection,
  deleteRequest,
  type SavedRequest,
} from "@/hooks/useCollections";

interface SidebarProps {
  activeRequestId: string | null;
  onRequestSelect: (request: SavedRequest) => void;
  onNewCollection: () => void;
  onNewRequest: () => void;
  onRunCollection: (collectionId: string, collectionName: string) => void;
  onImportExport: () => void;
}

export function Sidebar({
  activeRequestId,
  onRequestSelect,
  onNewCollection,
  onNewRequest,
  onRunCollection,
  onImportExport,
}: SidebarProps) {
  const collections = useCollections();
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(
    new Set()
  );

  const toggleCollection = (id: string) => {
    setExpandedCollections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDeleteCollection = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Delete this collection and all its requests?")) {
      await deleteCollection(id);
    }
  };

  return (
    <div className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-zinc-300">Collections</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onImportExport}
              className="text-xs text-zinc-400 hover:text-zinc-200"
              title="Import / Export"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </button>
            <button
              onClick={onNewCollection}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              + New
            </button>
          </div>
        </div>
        <button
          onClick={onNewRequest}
          className="w-full text-left text-sm text-zinc-400 hover:text-zinc-200 py-1"
        >
          + Save Current Request
        </button>
      </div>

      {/* Collections List */}
      <div className="flex-1 overflow-auto p-2">
        {collections.length === 0 ? (
          <div className="text-zinc-500 text-sm text-center py-4">
            No collections yet
          </div>
        ) : (
          <div className="space-y-1">
            {collections.map((collection) => (
              <CollectionItem
                key={collection.id}
                collection={collection}
                isExpanded={expandedCollections.has(collection.id)}
                onToggle={() => toggleCollection(collection.id)}
                onDelete={(e) => handleDeleteCollection(e, collection.id)}
                onRun={(e) => {
                  e.stopPropagation();
                  onRunCollection(collection.id, collection.name);
                }}
                activeRequestId={activeRequestId}
                onRequestSelect={onRequestSelect}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface CollectionItemProps {
  collection: { id: string; name: string };
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onRun: (e: React.MouseEvent) => void;
  activeRequestId: string | null;
  onRequestSelect: (request: SavedRequest) => void;
}

function CollectionItem({
  collection,
  isExpanded,
  onToggle,
  onDelete,
  onRun,
  activeRequestId,
  onRequestSelect,
}: CollectionItemProps) {
  const requests = useCollectionRequests(isExpanded ? collection.id : null);

  const handleDeleteRequest = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Delete this request?")) {
      await deleteRequest(id);
    }
  };

  return (
    <div>
      <div
        onClick={onToggle}
        className="flex items-center justify-between px-2 py-1.5 rounded cursor-pointer hover:bg-zinc-800 group"
      >
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-500 text-xs">{isExpanded ? "▼" : "▶"}</span>
          <span className="text-sm text-zinc-300 truncate">{collection.name}</span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
          <button
            onClick={onRun}
            className="text-zinc-600 hover:text-green-400 text-xs"
            title="Run Collection"
          >
            ▶
          </button>
          <button
            onClick={onDelete}
            className="text-zinc-600 hover:text-red-400 text-xs"
            title="Delete Collection"
          >
            ×
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="ml-4 border-l border-zinc-800 pl-2 mt-1 space-y-0.5">
          {requests.length === 0 ? (
            <div className="text-zinc-600 text-xs py-1 px-2">No requests</div>
          ) : (
            requests.map((request) => (
              <RequestItem
                key={request.id}
                request={request}
                isActive={activeRequestId === request.id}
                onSelect={() => onRequestSelect(request)}
                onDelete={(e) => handleDeleteRequest(e, request.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

interface RequestItemProps {
  request: SavedRequest;
  isActive: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

function RequestItem({ request, isActive, onSelect, onDelete }: RequestItemProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect();
  };

  return (
    <div
      onClick={handleClick}
      className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer group ${
        isActive ? "bg-zinc-700" : "hover:bg-zinc-800"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={`text-xs font-medium ${
            request.method === "GET"
              ? "text-green-400"
              : request.method === "POST"
              ? "text-yellow-400"
              : request.method === "PUT"
              ? "text-blue-400"
              : request.method === "DELETE"
              ? "text-red-400"
              : "text-purple-400"
          }`}
        >
          {request.method.slice(0, 3)}
        </span>
        <span className="text-sm text-zinc-300 truncate">{request.name}</span>
      </div>
      <button
        onClick={onDelete}
        className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 text-xs"
      >
        ×
      </button>
    </div>
  );
}
