"use client";

import { useState, useEffect, useCallback } from "react";
import { useEnvironmentStore } from "@/store/environmentStore";

interface CreateVariableModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedValue: string;
  onVariableCreated: (variableName: string, replaceSelection: boolean) => void;
}

export function CreateVariableModal({
  isOpen,
  onClose,
  selectedValue,
  onVariableCreated,
}: CreateVariableModalProps) {
  const [variableName, setVariableName] = useState("");
  const [replaceSelection, setReplaceSelection] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const activeEnvironmentId = useEnvironmentStore((state) => state.activeEnvironmentId);
  const environments = useEnvironmentStore((state) => state.environments);
  const setVariable = useEnvironmentStore((state) => state.setVariable);

  const activeEnvironment = environments.find((env) => env.id === activeEnvironmentId);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setVariableName("");
      setReplaceSelection(true);
      setError(null);
      setIsCreating(false);
    }
  }, [isOpen]);

  // Validate variable name
  const validateVariableName = useCallback((name: string): string | null => {
    if (!name.trim()) {
      return "Variable name is required";
    }
    if (!/^[\w.\-]+$/.test(name)) {
      return "Variable name can only contain letters, numbers, underscores, hyphens, and dots";
    }
    if (activeEnvironment && name in activeEnvironment.variables) {
      return `Variable "${name}" already exists in ${activeEnvironment.name}`;
    }
    return null;
  }, [activeEnvironment]);

  const handleCreate = async () => {
    const validationError = validateVariableName(variableName);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!activeEnvironmentId) {
      setError("No environment selected");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      await setVariable(variableName.trim(), selectedValue);
      onVariableCreated(variableName.trim(), replaceSelection);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create variable");
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isCreating) {
      handleCreate();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  if (!isOpen) return null;

  // Truncate long values for display
  const displayValue = selectedValue.length > 100
    ? selectedValue.slice(0, 100) + "..."
    : selectedValue;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl w-full max-w-md mx-4"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
          <h2 className="text-lg font-semibold">Create Variable</h2>
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

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* No environment warning */}
          {!activeEnvironmentId && (
            <div className="bg-yellow-600/20 border border-yellow-600/50 rounded px-3 py-2 text-sm text-yellow-400">
              No environment is selected. Please select an environment first.
            </div>
          )}

          {/* Selected Value Preview */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Value</label>
            <div className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm font-mono break-all max-h-24 overflow-y-auto">
              {displayValue}
            </div>
          </div>

          {/* Variable Name Input */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Variable Name</label>
            <input
              type="text"
              value={variableName}
              onChange={(e) => {
                setVariableName(e.target.value);
                setError(null);
              }}
              placeholder="e.g., API_KEY, baseUrl, userId"
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              autoFocus
              disabled={!activeEnvironmentId}
            />
            {error && (
              <p className="text-red-400 text-xs mt-1">{error}</p>
            )}
          </div>

          {/* Preview */}
          {variableName && !validateVariableName(variableName) && (
            <div className="bg-zinc-800/50 border border-zinc-700 rounded px-3 py-2">
              <div className="text-xs text-zinc-500 mb-1">Preview</div>
              <div className="text-sm">
                <span className="text-zinc-400">{activeEnvironment?.name}.</span>
                <span className="text-blue-400 font-mono">{variableName}</span>
                <span className="text-zinc-500"> = </span>
                <span className="text-green-400 font-mono">&quot;{displayValue}&quot;</span>
              </div>
            </div>
          )}

          {/* Replace Selection Option */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={replaceSelection}
              onChange={(e) => setReplaceSelection(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-zinc-900"
              disabled={!activeEnvironmentId}
            />
            <span className="text-sm text-zinc-300">
              Replace selection with <code className="text-blue-400">{`{{${variableName || "variableName"}}}`}</code>
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-zinc-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!activeEnvironmentId || isCreating || !variableName.trim()}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 rounded font-medium transition-colors"
          >
            {isCreating ? "Creating..." : "Create Variable"}
          </button>
        </div>
      </div>
    </div>
  );
}
