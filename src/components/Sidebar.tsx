"use client";

import { useState, useMemo } from "react";
import {
  useCollections,
  useCollectionRequests,
  deleteCollection,
  deleteRequest,
  type SavedRequest,
} from "@/hooks/useCollections";

// ============================================================================
// Tree Types and Utilities
// ============================================================================

interface FolderTreeNode {
  type: "folder";
  name: string;
  path: string; // Full path like "Users/CRUD"
  children: TreeNode[];
}

interface RequestTreeNode {
  type: "request";
  request: SavedRequest;
  displayName: string; // Just the last segment of the name
}

type TreeNode = FolderTreeNode | RequestTreeNode;

/**
 * Build a hierarchical folder tree from flat requests.
 * Requests with "/" in names are organized into virtual folders.
 * Example: "Users/CRUD/Create User" → Users → CRUD → Create User
 */
function buildFolderTree(requests: SavedRequest[]): TreeNode[] {
  const root: TreeNode[] = [];
  const folderMap = new Map<string, FolderTreeNode>();

  // Sort requests: folders first (by path depth), then by name
  const sortedRequests = [...requests].sort((a, b) => {
    const aDepth = (a.name.match(/\//g) || []).length;
    const bDepth = (b.name.match(/\//g) || []).length;
    if (aDepth !== bDepth) return aDepth - bDepth;
    return a.name.localeCompare(b.name);
  });

  for (const request of sortedRequests) {
    const segments = request.name.split("/");

    if (segments.length === 1) {
      // No folder path, add directly to root
      root.push({
        type: "request",
        request,
        displayName: request.name,
      });
    } else {
      // Has folder path
      const requestName = segments.pop()!;
      let currentPath = "";
      let currentChildren = root;

      // Create/find folder hierarchy
      for (const segment of segments) {
        const parentPath = currentPath;
        currentPath = currentPath ? `${currentPath}/${segment}` : segment;

        let folder = folderMap.get(currentPath);
        if (!folder) {
          folder = {
            type: "folder",
            name: segment,
            path: currentPath,
            children: [],
          };
          folderMap.set(currentPath, folder);

          // Add to parent
          if (parentPath) {
            const parentFolder = folderMap.get(parentPath);
            if (parentFolder) {
              parentFolder.children.push(folder);
            }
          } else {
            currentChildren.push(folder);
          }
        }
        currentChildren = folder.children;
      }

      // Add request to deepest folder
      currentChildren.push({
        type: "request",
        request,
        displayName: requestName,
      });
    }
  }

  // Sort each folder's children: folders first (alphabetically), then requests
  const sortChildren = (children: TreeNode[]): TreeNode[] => {
    const folders = children
      .filter((c): c is FolderTreeNode => c.type === "folder")
      .sort((a, b) => a.name.localeCompare(b.name));
    const requests = children
      .filter((c): c is RequestTreeNode => c.type === "request");

    // Recursively sort folder children
    folders.forEach((f) => {
      f.children = sortChildren(f.children);
    });

    return [...folders, ...requests];
  };

  return sortChildren(root);
}

/**
 * Count total requests in a tree (including nested folders)
 */
function countRequests(nodes: TreeNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.type === "request") {
      count++;
    } else {
      count += countRequests(node.children);
    }
  }
  return count;
}

// ============================================================================
// Components
// ============================================================================

interface SidebarProps {
  activeRequestId: string | null;
  onRequestSelect: (request: SavedRequest) => void;
  onNewCollection: () => void;
  onNewRequest: () => void;
  onRunCollection: (collectionId: string, collectionName: string) => void;
  onRunFolder: (collectionId: string, collectionName: string, folderPath: string) => void;
  onImportExport: () => void;
}

export function Sidebar({
  activeRequestId,
  onRequestSelect,
  onNewCollection,
  onNewRequest,
  onRunCollection,
  onRunFolder,
  onImportExport,
}: SidebarProps) {
  const collections = useCollections();
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(
    new Set()
  );
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
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

  const toggleFolder = (collectionId: string, folderPath: string) => {
    const key = `${collectionId}:${folderPath}`;
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const isFolderExpanded = (collectionId: string, folderPath: string) => {
    return expandedFolders.has(`${collectionId}:${folderPath}`);
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
                onRunFolder={(folderPath) => {
                  onRunFolder(collection.id, collection.name, folderPath);
                }}
                activeRequestId={activeRequestId}
                onRequestSelect={onRequestSelect}
                expandedFolders={expandedFolders}
                onToggleFolder={(path) => toggleFolder(collection.id, path)}
                isFolderExpanded={(path) => isFolderExpanded(collection.id, path)}
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
  onRunFolder: (folderPath: string) => void;
  activeRequestId: string | null;
  onRequestSelect: (request: SavedRequest) => void;
  expandedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
  isFolderExpanded: (path: string) => boolean;
}

function CollectionItem({
  collection,
  isExpanded,
  onToggle,
  onDelete,
  onRun,
  onRunFolder,
  activeRequestId,
  onRequestSelect,
  onToggleFolder,
  isFolderExpanded,
}: CollectionItemProps) {
  const requests = useCollectionRequests(isExpanded ? collection.id : null);

  // Build folder tree from flat requests
  const folderTree = useMemo(() => {
    return buildFolderTree(requests);
  }, [requests]);

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
            <TreeNodeList
              nodes={folderTree}
              activeRequestId={activeRequestId}
              onRequestSelect={onRequestSelect}
              onDeleteRequest={handleDeleteRequest}
              onToggleFolder={onToggleFolder}
              onRunFolder={onRunFolder}
              isFolderExpanded={isFolderExpanded}
              depth={0}
            />
          )}
        </div>
      )}
    </div>
  );
}

interface TreeNodeListProps {
  nodes: TreeNode[];
  activeRequestId: string | null;
  onRequestSelect: (request: SavedRequest) => void;
  onDeleteRequest: (e: React.MouseEvent, id: string) => void;
  onToggleFolder: (path: string) => void;
  onRunFolder: (folderPath: string) => void;
  isFolderExpanded: (path: string) => boolean;
  depth: number;
}

function TreeNodeList({
  nodes,
  activeRequestId,
  onRequestSelect,
  onDeleteRequest,
  onToggleFolder,
  onRunFolder,
  isFolderExpanded,
  depth,
}: TreeNodeListProps) {
  return (
    <>
      {nodes.map((node) => {
        if (node.type === "folder") {
          return (
            <FolderItem
              key={`folder-${node.path}`}
              folder={node}
              isExpanded={isFolderExpanded(node.path)}
              onToggle={() => onToggleFolder(node.path)}
              onRun={() => onRunFolder(node.path)}
              activeRequestId={activeRequestId}
              onRequestSelect={onRequestSelect}
              onDeleteRequest={onDeleteRequest}
              onToggleFolder={onToggleFolder}
              onRunFolder={onRunFolder}
              isFolderExpanded={isFolderExpanded}
              depth={depth}
            />
          );
        } else {
          return (
            <RequestItem
              key={node.request.id}
              request={node.request}
              displayName={node.displayName}
              isActive={activeRequestId === node.request.id}
              onSelect={() => onRequestSelect(node.request)}
              onDelete={(e) => onDeleteRequest(e, node.request.id)}
            />
          );
        }
      })}
    </>
  );
}

interface FolderItemProps {
  folder: FolderTreeNode;
  isExpanded: boolean;
  onToggle: () => void;
  onRun: () => void;
  activeRequestId: string | null;
  onRequestSelect: (request: SavedRequest) => void;
  onDeleteRequest: (e: React.MouseEvent, id: string) => void;
  onToggleFolder: (path: string) => void;
  onRunFolder: (folderPath: string) => void;
  isFolderExpanded: (path: string) => boolean;
  depth: number;
}

function FolderItem({
  folder,
  isExpanded,
  onToggle,
  onRun,
  activeRequestId,
  onRequestSelect,
  onDeleteRequest,
  onToggleFolder,
  onRunFolder,
  isFolderExpanded,
  depth,
}: FolderItemProps) {
  const requestCount = countRequests(folder.children);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle();
  };

  const handleRun = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRun();
  };

  return (
    <div>
      <div
        onClick={handleClick}
        className="flex items-center justify-between px-2 py-1 rounded cursor-pointer hover:bg-zinc-800 group"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-zinc-500 text-xs">{isExpanded ? "▼" : "▶"}</span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-amber-500 flex-shrink-0"
          >
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <span className="text-sm text-zinc-300 truncate" title={folder.path}>
            {folder.name}
          </span>
          <span className="text-xs text-zinc-600 flex-shrink-0">({requestCount})</span>
        </div>
        <button
          onClick={handleRun}
          className="text-zinc-600 hover:text-green-400 text-xs opacity-0 group-hover:opacity-100"
          title="Run Folder"
        >
          ▶
        </button>
      </div>

      {isExpanded && (
        <div className="ml-4 border-l border-zinc-700 pl-2 mt-0.5 space-y-0.5">
          <TreeNodeList
            nodes={folder.children}
            activeRequestId={activeRequestId}
            onRequestSelect={onRequestSelect}
            onDeleteRequest={onDeleteRequest}
            onToggleFolder={onToggleFolder}
            onRunFolder={onRunFolder}
            isFolderExpanded={isFolderExpanded}
            depth={depth + 1}
          />
        </div>
      )}
    </div>
  );
}

interface RequestItemProps {
  request: SavedRequest;
  displayName: string;
  isActive: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

function RequestItem({ request, displayName, isActive, onSelect, onDelete }: RequestItemProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect();
  };

  const methodColor =
    request.method === "GET"
      ? "text-green-400"
      : request.method === "POST"
      ? "text-yellow-400"
      : request.method === "PUT"
      ? "text-blue-400"
      : request.method === "DELETE"
      ? "text-red-400"
      : request.method === "GRPC"
      ? "text-purple-400"
      : "text-zinc-400";

  const methodLabel = request.method === "GRPC" ? "gRPC" : request.method.slice(0, 3);

  return (
    <div
      onClick={handleClick}
      className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer group ${
        isActive ? "bg-zinc-700" : "hover:bg-zinc-800"
      }`}
      title={request.name}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className={`text-xs font-medium flex-shrink-0 ${methodColor}`}>
          {methodLabel}
        </span>
        <span className="text-sm text-zinc-300 truncate">{displayName}</span>
      </div>
      <button
        onClick={onDelete}
        className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 text-xs flex-shrink-0"
      >
        ×
      </button>
    </div>
  );
}
