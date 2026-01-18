"use client";

import { useState, useEffect } from "react";
import { useEnvironmentStore } from "@/store/environmentStore";

interface EnvironmentManagerProps {
  onClose: () => void;
}

export function EnvironmentManager({ onClose }: EnvironmentManagerProps) {
  const { environments, addEnvironment, updateEnvironment, deleteEnvironment, initialize, isLoaded } =
    useEnvironmentStore();

  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(null);
  const [newEnvName, setNewEnvName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ensure store is initialized
  useEffect(() => {
    const init = async () => {
      if (!isLoaded) {
        try {
          await initialize();
        } catch (err) {
          console.error("Failed to initialize environment store:", err);
          setError("Failed to load environments. Please refresh the page.");
        }
      }
    };
    init();
  }, [isLoaded, initialize]);

  // Update selected environment when environments load
  useEffect(() => {
    if (isLoaded && environments.length > 0 && selectedEnvId === null) {
      setSelectedEnvId(environments[0].id);
    }
  }, [isLoaded, environments, selectedEnvId]);

  const selectedEnv = environments.find((env) => env.id === selectedEnvId);

  const handleAddEnvironment = async () => {
    const trimmedName = newEnvName.trim();
    if (!trimmedName || isAdding) return;

    setIsAdding(true);
    setError(null);

    try {
      await addEnvironment(trimmedName);
      setNewEnvName("");
      // Select the newly added environment
      const newEnv = useEnvironmentStore.getState().environments.find(
        (env) => env.name === trimmedName
      );
      if (newEnv) {
        setSelectedEnvId(newEnv.id);
      }
    } catch (err) {
      console.error("Failed to add environment:", err);
      setError(`Failed to add environment: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsAdding(false);
    }
  };

  const handleAddVariable = () => {
    if (!selectedEnv) return;
    const key = `VAR_${Object.keys(selectedEnv.variables).length + 1}`;
    updateEnvironment(selectedEnv.id, {
      variables: { ...selectedEnv.variables, [key]: "" },
    });
  };

  const handleUpdateVariable = (oldKey: string, newKey: string, value: string) => {
    if (!selectedEnv) return;
    const newVariables = { ...selectedEnv.variables };
    if (oldKey !== newKey) {
      delete newVariables[oldKey];
    }
    newVariables[newKey] = value;
    updateEnvironment(selectedEnv.id, { variables: newVariables });
  };

  const handleDeleteVariable = (key: string) => {
    if (!selectedEnv) return;
    const newVariables = { ...selectedEnv.variables };
    delete newVariables[key];
    updateEnvironment(selectedEnv.id, { variables: newVariables });
  };

  const handleDeleteEnvironment = (id: string) => {
    deleteEnvironment(id);
    if (selectedEnvId === id) {
      setSelectedEnvId(environments.find((e) => e.id !== id)?.id ?? null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
          <h2 className="text-lg font-semibold">Manage Environments</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 text-xl"
          >
            ×
          </button>
        </div>

        {/* Error display */}
        {error && (
          <div className="px-4 py-2 bg-red-900/30 border-b border-red-800 text-red-400 text-sm">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 text-red-300 hover:text-red-100"
            >
              ×
            </button>
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          {/* Environment List */}
          <div className="w-52 border-r border-zinc-700 p-3 flex flex-col">
            <div className="mb-3 space-y-2">
              <input
                type="text"
                value={newEnvName}
                onChange={(e) => setNewEnvName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddEnvironment()}
                placeholder="New environment name..."
                disabled={!isLoaded || isAdding}
                className="w-full bg-zinc-800 border border-zinc-600 rounded px-2 py-1.5 text-sm disabled:opacity-50"
              />
              <button
                onClick={handleAddEnvironment}
                disabled={!isLoaded || isAdding || !newEnvName.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:cursor-not-allowed px-2 py-1.5 rounded text-sm font-medium"
              >
                {isAdding ? "Adding..." : "+ Add Environment"}
              </button>
            </div>
            <div className="flex-1 overflow-auto space-y-1">
              {!isLoaded ? (
                <div className="text-zinc-500 text-sm text-center py-4">
                  Loading...
                </div>
              ) : environments.length === 0 ? (
                <div className="text-zinc-500 text-sm text-center py-4">
                  No environments
                </div>
              ) : (
                environments.map((env) => (
                  <div
                    key={env.id}
                    className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer ${
                      selectedEnvId === env.id
                        ? "bg-zinc-700"
                        : "hover:bg-zinc-800"
                    }`}
                    onClick={() => setSelectedEnvId(env.id)}
                  >
                    <span className="text-sm truncate">{env.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteEnvironment(env.id);
                      }}
                      className="text-zinc-500 hover:text-red-400 text-sm"
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Variables Editor */}
          <div className="flex-1 p-4 overflow-auto">
            {selectedEnv ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <input
                    type="text"
                    value={selectedEnv.name}
                    onChange={(e) =>
                      updateEnvironment(selectedEnv.id, { name: e.target.value })
                    }
                    className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-sm font-medium"
                  />
                  <button
                    onClick={handleAddVariable}
                    className="text-sm text-blue-400 hover:text-blue-300"
                  >
                    + Add Variable
                  </button>
                </div>

                <div className="space-y-2">
                  {Object.entries(selectedEnv.variables).map(([key, value]) => (
                    <VariableRow
                      key={key}
                      variableKey={key}
                      value={value}
                      onUpdate={(newKey, newValue) =>
                        handleUpdateVariable(key, newKey, newValue)
                      }
                      onDelete={() => handleDeleteVariable(key)}
                    />
                  ))}
                  {Object.keys(selectedEnv.variables).length === 0 && (
                    <div className="text-zinc-500 text-sm text-center py-8">
                      No variables. Click &quot;Add Variable&quot; to create one.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-zinc-500 text-center py-8">
                Select or create an environment
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface VariableRowProps {
  variableKey: string;
  value: string;
  onUpdate: (key: string, value: string) => void;
  onDelete: () => void;
}

function VariableRow({ variableKey, value, onUpdate, onDelete }: VariableRowProps) {
  const [editKey, setEditKey] = useState(variableKey);
  const [editValue, setEditValue] = useState(value);

  const handleBlur = () => {
    if (editKey !== variableKey || editValue !== value) {
      onUpdate(editKey, editValue);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={editKey}
        onChange={(e) => setEditKey(e.target.value)}
        onBlur={handleBlur}
        placeholder="Variable name"
        className="flex-1 bg-zinc-800 border border-zinc-600 rounded px-2 py-1.5 text-sm font-mono"
      />
      <input
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleBlur}
        placeholder="Value"
        className="flex-1 bg-zinc-800 border border-zinc-600 rounded px-2 py-1.5 text-sm"
      />
      <button
        onClick={onDelete}
        className="text-zinc-500 hover:text-red-400 px-2 py-1"
      >
        ×
      </button>
    </div>
  );
}
