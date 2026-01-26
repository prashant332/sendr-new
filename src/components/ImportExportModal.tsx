"use client";

import { useState, useRef, useCallback } from "react";
import { useCollections } from "@/hooks/useCollections";
import { useEnvironmentStore } from "@/store/environmentStore";
import {
  exportToJson,
  downloadJson,
  importFromJson,
  ImportResult,
} from "@/lib/importExport";

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = "import" | "export";

export function ImportExportModal({ isOpen, onClose }: ImportExportModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>("import");
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedCollections, setSelectedCollections] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const collections = useCollections();
  const refreshEnvironments = useEnvironmentStore((state) => state.refreshEnvironments);

  // Handle file selection
  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.name.endsWith(".json")) {
      setImportResult({
        success: false,
        collectionsImported: 0,
        requestsImported: 0,
        environmentsImported: 0,
        errors: ["Please select a JSON file"],
        warnings: [],
      });
      return;
    }

    setImporting(true);
    setImportResult(null);

    try {
      const text = await file.text();
      const result = await importFromJson(text);
      setImportResult(result);

      // Refresh environments in the store if any were imported
      if (result.environmentsImported > 0) {
        await refreshEnvironments();
      }
    } catch (err) {
      setImportResult({
        success: false,
        collectionsImported: 0,
        requestsImported: 0,
        environmentsImported: 0,
        errors: [`Failed to read file: ${err}`],
        warnings: [],
      });
    } finally {
      setImporting(false);
    }
  }, [refreshEnvironments]);

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Handle export
  const handleExport = async () => {
    setExporting(true);
    try {
      const collectionIds = selectedCollections.size > 0
        ? Array.from(selectedCollections)
        : undefined;
      const data = await exportToJson(collectionIds);
      downloadJson(data);
    } finally {
      setExporting(false);
    }
  };

  // Toggle collection selection
  const toggleCollectionSelection = (id: string) => {
    setSelectedCollections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select/deselect all
  const toggleSelectAll = () => {
    if (selectedCollections.size === collections.length) {
      setSelectedCollections(new Set());
    } else {
      setSelectedCollections(new Set(collections.map((c) => c.id)));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
          <h2 className="text-lg font-semibold">Import / Export</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-700">
          <button
            onClick={() => {
              setActiveTab("import");
              setImportResult(null);
            }}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "import"
                ? "text-blue-400 border-b-2 border-blue-400 bg-zinc-800/50"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Import
          </button>
          <button
            onClick={() => setActiveTab("export")}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "export"
                ? "text-blue-400 border-b-2 border-blue-400 bg-zinc-800/50"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Export
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {activeTab === "import" && (
            <div className="space-y-4">
              {/* Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  dragOver
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-zinc-700 hover:border-zinc-500"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                <div className="text-4xl mb-2">📁</div>
                <div className="text-sm text-zinc-300 mb-1">
                  {importing ? "Importing..." : "Drop a file here or click to browse"}
                </div>
                <div className="text-xs text-zinc-500">
                  Supports Postman Collection v2.1 and Sendr JSON
                </div>
              </div>

              {/* Import Result */}
              {importResult && (
                <div
                  className={`rounded-lg p-4 ${
                    importResult.success
                      ? "bg-green-600/20 border border-green-600/50"
                      : "bg-red-600/20 border border-red-600/50"
                  }`}
                >
                  <div className="font-medium mb-2">
                    {importResult.success ? "Import Successful" : "Import Failed"}
                  </div>
                  {importResult.success && (
                    <div className="text-sm text-zinc-300">
                      <div>
                        Imported {importResult.collectionsImported} collection(s) with{" "}
                        {importResult.requestsImported} request(s)
                      </div>
                      {importResult.environmentsImported > 0 && (
                        <div className="mt-1">
                          Imported {importResult.environmentsImported} environment(s)
                        </div>
                      )}
                    </div>
                  )}
                  {importResult.errors.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {importResult.errors.map((error, i) => (
                        <div key={i} className="text-sm text-red-400">
                          {error}
                        </div>
                      ))}
                    </div>
                  )}
                  {importResult.warnings.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {importResult.warnings.map((warning, i) => (
                        <div key={i} className="text-sm text-yellow-400">
                          {warning}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "export" && (
            <div className="space-y-4">
              {/* Collection Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-zinc-400">
                    Select collections to export
                  </label>
                  <button
                    onClick={toggleSelectAll}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    {selectedCollections.size === collections.length
                      ? "Deselect All"
                      : "Select All"}
                  </button>
                </div>

                {collections.length === 0 ? (
                  <div className="text-sm text-zinc-500 text-center py-4 bg-zinc-800 rounded">
                    No collections to export
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto bg-zinc-800 rounded border border-zinc-700">
                    {collections.map((collection) => (
                      <label
                        key={collection.id}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-zinc-700/50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedCollections.has(collection.id)}
                          onChange={() => toggleCollectionSelection(collection.id)}
                          className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-zinc-900"
                        />
                        <span className="text-sm text-zinc-300">{collection.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Export Info */}
              <div className="text-xs text-zinc-500">
                {selectedCollections.size === 0
                  ? "All collections and environments will be exported"
                  : `${selectedCollections.size} collection(s) selected (all environments included)`}
              </div>

              {/* Export Button */}
              <button
                onClick={handleExport}
                disabled={exporting || collections.length === 0}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 rounded font-medium text-sm transition-colors"
              >
                {exporting ? "Exporting..." : "Export to JSON"}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-zinc-700 text-xs text-zinc-500">
          <strong>Tip:</strong> Export your collections regularly to back up your work.
        </div>
      </div>
    </div>
  );
}
