"use client";

import { useState, useCallback, useRef } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import {
  useProtoSchemas,
  createProtoSchema,
  updateProtoSchema,
  deleteProtoSchema,
} from "@/hooks/useProtoSchemas";
import { useCollections } from "@/hooks/useCollections";
import type { ProtoSchema, ParsedService } from "@/lib/db";
import {
  parseProtoContent,
  getMethodType,
} from "@/lib/grpc/protoParser";
import { isWellKnownType } from "@/lib/grpc/wellKnownProtos";

/**
 * Find all unresolved imports across all schemas
 */
function findAllUnresolvedImports(schemas: ProtoSchema[]): Map<string, string[]> {
  const unresolvedMap = new Map<string, string[]>(); // importPath -> [schemaIds that need it]
  const resolvedPaths = new Set(schemas.map(s => s.path));

  for (const schema of schemas) {
    const result = parseProtoContent(schema.content);
    for (const imp of result.imports) {
      if (!isWellKnownType(imp) && !resolvedPaths.has(imp)) {
        const existing = unresolvedMap.get(imp) || [];
        existing.push(schema.name);
        unresolvedMap.set(imp, existing);
      }
    }
  }

  return unresolvedMap;
}

/**
 * Suggest paths for a file based on imports in other schemas
 */
function suggestPathsForFile(filename: string, schemas: ProtoSchema[]): string[] {
  const suggestions: string[] = [];
  const fileBasename = filename.replace(/\.proto$/, '');

  // Find imports in other schemas that might match this filename
  for (const schema of schemas) {
    const result = parseProtoContent(schema.content);
    for (const imp of result.imports) {
      if (!isWellKnownType(imp)) {
        // Check if the import path ends with this filename
        if (imp.endsWith(filename) || imp.endsWith(`/${filename}`)) {
          suggestions.push(imp);
        }
        // Also check if basename matches (e.g., "user.proto" matches "user/v1/user.proto")
        const impBasename = imp.split('/').pop()?.replace(/\.proto$/, '');
        if (impBasename === fileBasename) {
          suggestions.push(imp);
        }
      }
    }
  }

  return [...new Set(suggestions)]; // Dedupe
}

interface ProtoSchemaManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onSchemaSelect?: (schemaId: string) => void;
}

type ViewMode = "list" | "edit" | "add";

export function ProtoSchemaManager({
  isOpen,
  onClose,
  onSchemaSelect,
}: ProtoSchemaManagerProps) {
  const schemas = useProtoSchemas();
  const collections = useCollections();

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedSchema, setSelectedSchema] = useState<ProtoSchema | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editName, setEditName] = useState("");
  const [editPath, setEditPath] = useState("");
  const [editCollectionId, setEditCollectionId] = useState<string>("");
  const [parsedServices, setParsedServices] = useState<ParsedService[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [pathSuggestions, setPathSuggestions] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get all unresolved imports across schemas
  const unresolvedImports = findAllUnresolvedImports(schemas);

  // Reset state when closing
  const handleClose = () => {
    setViewMode("list");
    setSelectedSchema(null);
    setEditContent("");
    setEditName("");
    setEditPath("");
    setEditCollectionId("");
    setParsedServices([]);
    setParseErrors([]);
    setPathSuggestions([]);
    onClose();
  };

  // Parse proto content and update state
  const parseAndValidate = useCallback((content: string) => {
    const result = parseProtoContent(content);
    setParsedServices(result.services);
    setParseErrors(result.errors);

    // Check for unresolved imports (excluding well-known types)
    const unresolvedImports = result.imports.filter(
      (imp) => !isWellKnownType(imp) && !schemas.some((s) => s.path === imp)
    );
    if (unresolvedImports.length > 0) {
      setParseErrors((prev) => [
        ...prev,
        ...unresolvedImports.map((imp) => `Unresolved import: ${imp}`),
      ]);
    }

    return result;
  }, [schemas]);

  // Handle file upload
  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      const file = files[0];
      const reader = new FileReader();

      reader.onload = (e) => {
        const content = e.target?.result as string;
        setEditContent(content);
        setEditName(file.name);

        // Find path suggestions based on imports in other schemas
        const suggestions = suggestPathsForFile(file.name, schemas);
        setPathSuggestions(suggestions);

        // If there's exactly one suggestion, use it as the default path
        // Otherwise, default to just the filename
        if (suggestions.length === 1) {
          setEditPath(suggestions[0]);
        } else {
          setEditPath(file.name);
        }

        parseAndValidate(content);
        setViewMode("add");
      };

      reader.readAsText(file);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [parseAndValidate, schemas]
  );

  // Handle editor mount
  const handleEditorMount: OnMount = useCallback(
    (editorInstance: editor.IStandaloneCodeEditor) => {
      editorRef.current = editorInstance;
    },
    []
  );

  // Handle content change in editor
  const handleContentChange = useCallback(
    (value: string | undefined) => {
      const content = value || "";
      setEditContent(content);
      parseAndValidate(content);
    },
    [parseAndValidate]
  );

  // Handle viewing/editing a schema
  const handleEditSchema = useCallback(
    (schema: ProtoSchema) => {
      setSelectedSchema(schema);
      setEditContent(schema.content);
      setEditName(schema.name);
      setEditPath(schema.path);
      setEditCollectionId(schema.collectionId || "");
      parseAndValidate(schema.content);
      setViewMode("edit");
    },
    [parseAndValidate]
  );

  // Handle save (create or update)
  const handleSave = async () => {
    if (!editName.trim() || !editPath.trim() || !editContent.trim()) {
      return;
    }

    setIsSaving(true);
    try {
      const result = parseProtoContent(editContent);

      // Resolve import IDs
      const importIds: string[] = [];
      for (const imp of result.imports) {
        if (!isWellKnownType(imp)) {
          const existingSchema = schemas.find((s) => s.path === imp);
          if (existingSchema) {
            importIds.push(existingSchema.id);
          }
        }
      }

      if (viewMode === "add") {
        await createProtoSchema({
          name: editName.trim(),
          path: editPath.trim(),
          content: editContent,
          imports: importIds,
          collectionId: editCollectionId || undefined,
        });
      } else if (selectedSchema) {
        await updateProtoSchema(selectedSchema.id, {
          name: editName.trim(),
          path: editPath.trim(),
          content: editContent,
          imports: importIds,
          collectionId: editCollectionId || undefined,
        });
      }

      setViewMode("list");
      setSelectedSchema(null);
      setEditContent("");
      setEditName("");
      setEditPath("");
      setEditCollectionId("");
      setParsedServices([]);
      setParseErrors([]);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async (schemaId: string) => {
    if (confirm("Are you sure you want to delete this proto schema?")) {
      await deleteProtoSchema(schemaId);
      if (selectedSchema?.id === schemaId) {
        setViewMode("list");
        setSelectedSchema(null);
      }
    }
  };

  // Handle create new (empty)
  const handleCreateNew = () => {
    setSelectedSchema(null);
    setEditContent(`syntax = "proto3";

package mypackage;

// Define your messages here
message MyRequest {
  string id = 1;
}

message MyResponse {
  string result = 1;
}

// Define your service here
service MyService {
  rpc MyMethod (MyRequest) returns (MyResponse);
}
`);
    setEditName("new.proto");
    setEditPath("new.proto");
    setEditCollectionId("");
    parseAndValidate(editContent);
    setViewMode("add");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-700">
          <h2 className="text-lg font-semibold">
            {viewMode === "list" && "Proto Schemas"}
            {viewMode === "add" && "Add Proto Schema"}
            {viewMode === "edit" && `Edit: ${selectedSchema?.name}`}
          </h2>
          <button
            onClick={handleClose}
            className="text-zinc-400 hover:text-zinc-200 text-xl"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {/* List View */}
          {viewMode === "list" && (
            <div className="p-4 space-y-4 overflow-y-auto max-h-[70vh]">
              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCreateNew}
                  className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 rounded"
                >
                  + New Schema
                </button>
                <label className="px-3 py-1.5 text-sm bg-zinc-700 hover:bg-zinc-600 rounded cursor-pointer">
                  Upload .proto
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".proto"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Schema List */}
              {schemas.length === 0 ? (
                <div className="text-zinc-500 text-sm py-8 text-center">
                  No proto schemas yet. Upload a .proto file or create a new one.
                </div>
              ) : (
                <div className="space-y-2">
                  {schemas.map((schema) => {
                    const result = parseProtoContent(schema.content);
                    return (
                      <div
                        key={schema.id}
                        className="bg-zinc-800 border border-zinc-700 rounded p-3"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-blue-400">&#128196;</span>
                              <span className="font-medium">{schema.name}</span>
                              {schema.path !== schema.name && (
                                <span className="text-xs text-zinc-500">
                                  ({schema.path})
                                </span>
                              )}
                            </div>
                            {result.services.length > 0 && (
                              <div className="text-xs text-zinc-400 mt-1">
                                Services:{" "}
                                {result.services
                                  .map((s) => `${s.name} (${s.methods.length} methods)`)
                                  .join(", ")}
                              </div>
                            )}
                            {result.messages.length > 0 && (
                              <div className="text-xs text-zinc-500 mt-0.5">
                                Messages: {result.messages.join(", ")}
                              </div>
                            )}
                            {schema.collectionId && (
                              <div className="text-xs text-zinc-500 mt-0.5">
                                Collection:{" "}
                                {collections.find((c) => c.id === schema.collectionId)
                                  ?.name || "Unknown"}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {onSchemaSelect && (
                              <button
                                onClick={() => onSchemaSelect(schema.id)}
                                className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 rounded"
                              >
                                Select
                              </button>
                            )}
                            <button
                              onClick={() => handleEditSchema(schema)}
                              className="px-2 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 rounded"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(schema.id)}
                              className="px-2 py-1 text-xs text-red-400 hover:text-red-300"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Unresolved imports section */}
              {unresolvedImports.size > 0 && (
                <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-700/50 rounded">
                  <h3 className="text-sm font-semibold text-yellow-400 mb-2">
                    Unresolved Imports ({unresolvedImports.size})
                  </h3>
                  <p className="text-xs text-zinc-400 mb-2">
                    The following imports are referenced but no proto file with a matching path exists.
                    Upload the missing files and set their path to match the import statement.
                  </p>
                  <div className="space-y-1">
                    {Array.from(unresolvedImports.entries()).map(([importPath, neededBy]) => (
                      <div key={importPath} className="text-xs bg-zinc-800 px-2 py-1.5 rounded">
                        <span className="text-yellow-300 font-mono">{importPath}</span>
                        <span className="text-zinc-500 ml-2">
                          (needed by: {neededBy.join(', ')})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Add/Edit View */}
          {(viewMode === "add" || viewMode === "edit") && (
            <div className="flex h-[70vh]">
              {/* Editor Panel */}
              <div className="flex-1 flex flex-col border-r border-zinc-700">
                {/* Schema Metadata */}
                <div className="p-3 border-b border-zinc-700 space-y-2">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-xs text-zinc-400 mb-1">
                        Name
                      </label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="user_service.proto"
                        className="w-full bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-sm"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-zinc-400 mb-1">
                        Path (for imports)
                      </label>
                      <input
                        type="text"
                        value={editPath}
                        onChange={(e) => setEditPath(e.target.value)}
                        placeholder="user/v1/user_service.proto"
                        className="w-full bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-sm"
                      />
                      {/* Path suggestions */}
                      {pathSuggestions.length > 0 && editPath !== pathSuggestions[0] && (
                        <div className="mt-1">
                          <span className="text-xs text-yellow-400">Suggested: </span>
                          {pathSuggestions.map((suggestion, i) => (
                            <button
                              key={i}
                              onClick={() => setEditPath(suggestion)}
                              className="text-xs text-blue-400 hover:text-blue-300 mr-2 underline"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Info about path matching */}
                  <div className="text-xs text-zinc-500 bg-zinc-800/50 px-2 py-1.5 rounded">
                    The path must match exactly how other proto files import this file.
                    {unresolvedImports.size > 0 && (
                      <span className="text-yellow-400 ml-1">
                        ({unresolvedImports.size} unresolved import{unresolvedImports.size > 1 ? 's' : ''} in other files)
                      </span>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">
                      Collection (optional)
                    </label>
                    <select
                      value={editCollectionId}
                      onChange={(e) => setEditCollectionId(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-sm"
                    >
                      <option value="">Global (available to all)</option>
                      {collections.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Monaco Editor */}
                <div className="flex-1">
                  <Editor
                    height="100%"
                    language="protobuf"
                    theme="vs-dark"
                    value={editContent}
                    onChange={handleContentChange}
                    onMount={handleEditorMount}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      lineNumbers: "on",
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      tabSize: 2,
                      wordWrap: "on",
                    }}
                  />
                </div>
              </div>

              {/* Info Panel */}
              <div className="w-72 flex flex-col overflow-y-auto">
                {/* Errors */}
                {parseErrors.length > 0 && (
                  <div className="p-3 border-b border-zinc-700">
                    <h3 className="text-xs font-semibold text-red-400 mb-2">
                      Errors
                    </h3>
                    <div className="space-y-1">
                      {parseErrors.map((error, i) => (
                        <div key={i} className="text-xs text-red-400 bg-red-900/20 px-2 py-1 rounded">
                          {error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Parsed Services */}
                {parsedServices.length > 0 && (
                  <div className="p-3 border-b border-zinc-700">
                    <h3 className="text-xs font-semibold text-zinc-400 mb-2">
                      Services
                    </h3>
                    <div className="space-y-2">
                      {parsedServices.map((service) => (
                        <div key={service.fullName}>
                          <div className="text-sm font-medium text-blue-400">
                            {service.name}
                          </div>
                          <div className="text-xs text-zinc-500 mb-1">
                            {service.fullName}
                          </div>
                          <div className="ml-2 space-y-0.5">
                            {service.methods.map((method) => (
                              <div
                                key={method.name}
                                className="text-xs flex items-center gap-1"
                              >
                                <span
                                  className={`px-1 rounded text-[10px] ${
                                    method.clientStreaming || method.serverStreaming
                                      ? "bg-yellow-600/30 text-yellow-400"
                                      : "bg-green-600/30 text-green-400"
                                  }`}
                                >
                                  {getMethodType(method)}
                                </span>
                                <span className="text-zinc-300">{method.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Validation Status */}
                <div className="p-3">
                  <h3 className="text-xs font-semibold text-zinc-400 mb-2">
                    Validation
                  </h3>
                  {parseErrors.length === 0 ? (
                    <div className="text-xs text-green-400 bg-green-900/20 px-2 py-1 rounded">
                      Valid proto syntax
                    </div>
                  ) : (
                    <div className="text-xs text-yellow-400 bg-yellow-900/20 px-2 py-1 rounded">
                      {parseErrors.length} error(s) found
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-4 border-t border-zinc-700">
          {viewMode === "list" ? (
            <div className="text-xs text-zinc-500">
              {schemas.length} schema(s)
            </div>
          ) : (
            <button
              onClick={() => {
                setViewMode("list");
                setSelectedSchema(null);
              }}
              className="text-sm text-zinc-400 hover:text-zinc-200"
            >
              &larr; Back to list
            </button>
          )}

          <div className="flex gap-2">
            {viewMode !== "list" && (
              <>
                <button
                  onClick={() => {
                    setViewMode("list");
                    setSelectedSchema(null);
                  }}
                  className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={
                    isSaving ||
                    !editName.trim() ||
                    !editPath.trim() ||
                    !editContent.trim() ||
                    parseErrors.some((e) => e.startsWith("Parse error:"))
                  }
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 rounded"
                >
                  {isSaving ? "Saving..." : viewMode === "add" ? "Add Schema" : "Save Changes"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
