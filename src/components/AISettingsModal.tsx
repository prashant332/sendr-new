"use client";

import { useState } from "react";
import { useAIStore, DEFAULT_PROVIDER_CONFIG, PROVIDER_MODELS } from "@/store/aiStore";
import { AIProviderType, LLMProvider } from "@/lib/db";
import { getAdapter } from "@/lib/ai/adapters";

interface AISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ModalView = "main" | "add-provider" | "edit-provider";

export default function AISettingsModal({ isOpen, onClose }: AISettingsModalProps) {
  const {
    settings,
    addProvider,
    updateProvider,
    deleteProvider,
    setDefaultProvider,
    updateSettings,
  } = useAIStore();

  const [view, setView] = useState<ModalView>("main");
  const [editingProvider, setEditingProvider] = useState<LLMProvider | null>(null);
  const [testingConnection, setTestingConnection] = useState<string | null>(null);
  const [connectionResult, setConnectionResult] = useState<{
    id: string;
    success: boolean;
    message: string;
  } | null>(null);

  // Form state for add/edit provider
  const [formData, setFormData] = useState({
    type: "openai" as AIProviderType,
    name: "",
    apiKey: "",
    model: "",
    baseUrl: "",
  });

  const resetForm = () => {
    setFormData({
      type: "openai",
      name: "",
      apiKey: "",
      model: "",
      baseUrl: "",
    });
    setEditingProvider(null);
    setConnectionResult(null);
  };

  const handleAddProvider = () => {
    const defaultConfig = DEFAULT_PROVIDER_CONFIG[formData.type];
    setFormData({
      type: "openai",
      name: "OpenAI",
      apiKey: "",
      model: defaultConfig.model,
      baseUrl: defaultConfig.baseUrl,
    });
    setView("add-provider");
  };

  const handleEditProvider = (provider: LLMProvider) => {
    setEditingProvider(provider);
    setFormData({
      type: provider.type,
      name: provider.name,
      apiKey: provider.apiKey || "",
      model: provider.model,
      baseUrl: provider.baseUrl,
    });
    setView("edit-provider");
  };

  const handleTypeChange = (type: AIProviderType) => {
    const defaultConfig = DEFAULT_PROVIDER_CONFIG[type];
    const defaultName =
      type === "openai"
        ? "OpenAI"
        : type === "gemini"
        ? "Google Gemini"
        : type === "anthropic"
        ? "Anthropic"
        : type === "ollama"
        ? "Ollama (Local)"
        : "Custom API";

    setFormData({
      ...formData,
      type,
      name: editingProvider ? formData.name : defaultName,
      model: defaultConfig.model,
      baseUrl: defaultConfig.baseUrl,
    });
  };

  const handleSaveProvider = async () => {
    if (!formData.name || !formData.apiKey || !formData.model) {
      return;
    }

    if (editingProvider) {
      await updateProvider(editingProvider.id, {
        name: formData.name,
        type: formData.type,
        apiKey: formData.apiKey,
        model: formData.model,
        baseUrl: formData.baseUrl,
      });
    } else {
      await addProvider({
        name: formData.name,
        type: formData.type,
        apiKey: formData.apiKey,
        model: formData.model,
        baseUrl: formData.baseUrl,
        isDefault: settings.providers.length === 0,
      });
    }

    resetForm();
    setView("main");
  };

  const handleTestConnection = async (provider: LLMProvider) => {
    setTestingConnection(provider.id);
    setConnectionResult(null);

    try {
      const adapter = getAdapter(provider.type);
      if (!adapter) {
        setConnectionResult({
          id: provider.id,
          success: false,
          message: `No adapter available for ${provider.type}`,
        });
        return;
      }

      const result = await adapter.testConnection(provider);
      setConnectionResult({
        id: provider.id,
        success: result.success,
        message: result.success
          ? `Connected successfully! Model: ${result.model || provider.model}`
          : result.error || "Connection failed",
      });
    } catch (error) {
      setConnectionResult({
        id: provider.id,
        success: false,
        message: error instanceof Error ? error.message : "Connection failed",
      });
    } finally {
      setTestingConnection(null);
    }
  };

  const handleDeleteProvider = async (id: string) => {
    if (confirm("Are you sure you want to delete this provider?")) {
      await deleteProvider(id);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#1e1e1e] rounded-lg w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold">
            {view === "main"
              ? "AI Assistant Settings"
              : view === "add-provider"
              ? "Add LLM Provider"
              : "Edit Provider"}
          </h2>
          <button
            onClick={() => {
              if (view !== "main") {
                resetForm();
                setView("main");
              } else {
                onClose();
              }
            }}
            className="text-gray-400 hover:text-white"
          >
            {view !== "main" ? "← Back" : "✕"}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {view === "main" ? (
            <div className="space-y-6">
              {/* Providers List */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium">LLM Providers</h3>
                  <button
                    onClick={handleAddProvider}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                  >
                    + Add Provider
                  </button>
                </div>

                {settings.providers.length === 0 ? (
                  <div className="text-gray-400 text-sm bg-gray-800 rounded p-4 text-center">
                    No providers configured. Add an LLM provider to enable AI script generation.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {settings.providers.map((provider) => (
                      <div
                        key={provider.id}
                        className="bg-gray-800 rounded p-3 flex items-start justify-between"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                settings.defaultProviderId === provider.id
                                  ? "bg-green-500"
                                  : "bg-gray-500"
                              }`}
                            />
                            <span className="font-medium">{provider.name}</span>
                            <span className="text-xs text-gray-400 bg-gray-700 px-2 py-0.5 rounded">
                              {provider.type}
                            </span>
                          </div>
                          <div className="text-sm text-gray-400 mt-1">
                            Model: {provider.model}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            API Key: {provider.apiKey ? "••••••••" + provider.apiKey.slice(-4) : "Not set"}
                          </div>

                          {connectionResult?.id === provider.id && (
                            <div
                              className={`text-sm mt-2 ${
                                connectionResult.success ? "text-green-400" : "text-red-400"
                              }`}
                            >
                              {connectionResult.success ? "✓" : "✗"} {connectionResult.message}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleTestConnection(provider)}
                            disabled={testingConnection === provider.id}
                            className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50"
                          >
                            {testingConnection === provider.id ? "Testing..." : "Test"}
                          </button>
                          <button
                            onClick={() => handleEditProvider(provider)}
                            className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded"
                          >
                            Edit
                          </button>
                          {settings.defaultProviderId !== provider.id && (
                            <button
                              onClick={() => setDefaultProvider(provider.id)}
                              className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded"
                            >
                              Set Default
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteProvider(provider.id)}
                            className="text-xs px-2 py-1 bg-red-900 hover:bg-red-800 rounded"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Options */}
              <div>
                <h3 className="font-medium mb-3">Options</h3>
                <div className="space-y-3 bg-gray-800 rounded p-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.enableAutoSuggestions}
                      onChange={(e) =>
                        updateSettings({ enableAutoSuggestions: e.target.checked })
                      }
                      className="rounded"
                    />
                    <span className="text-sm">Enable quick action suggestions based on response</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.includeResponseSample}
                      onChange={(e) =>
                        updateSettings({ includeResponseSample: e.target.checked })
                      }
                      className="rounded"
                    />
                    <span className="text-sm">
                      Include response sample in context (recommended for better results)
                    </span>
                  </label>

                  <div className="flex items-center gap-4 pt-2">
                    <label className="text-sm">
                      Temperature:
                      <input
                        type="number"
                        min="0"
                        max="1"
                        step="0.1"
                        value={settings.temperature}
                        onChange={(e) =>
                          updateSettings({ temperature: parseFloat(e.target.value) || 0.2 })
                        }
                        className="ml-2 w-20 bg-gray-700 rounded px-2 py-1 text-sm"
                      />
                    </label>

                    <label className="text-sm">
                      Max Tokens:
                      <input
                        type="number"
                        min="100"
                        max="4000"
                        step="100"
                        value={settings.maxTokens}
                        onChange={(e) =>
                          updateSettings({ maxTokens: parseInt(e.target.value) || 1500 })
                        }
                        className="ml-2 w-24 bg-gray-700 rounded px-2 py-1 text-sm"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Privacy Note */}
              <div className="text-xs text-gray-400 bg-gray-800/50 rounded p-3">
                <strong>Privacy:</strong> API keys are stored locally in your browser. Response
                data sent to LLMs is truncated and sensitive fields are automatically redacted.
              </div>
            </div>
          ) : (
            /* Add/Edit Provider Form */
            <div className="space-y-4">
              {/* Provider Type */}
              <div>
                <label className="block text-sm font-medium mb-2">Provider Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["openai", "gemini", "anthropic", "ollama", "custom"] as AIProviderType[]).map(
                    (type) => (
                      <button
                        key={type}
                        onClick={() => handleTypeChange(type)}
                        className={`px-3 py-2 rounded text-sm ${
                          formData.type === type
                            ? "bg-blue-600"
                            : "bg-gray-700 hover:bg-gray-600"
                        }`}
                      >
                        {type === "openai"
                          ? "OpenAI"
                          : type === "gemini"
                          ? "Google Gemini"
                          : type === "anthropic"
                          ? "Anthropic"
                          : type === "ollama"
                          ? "Ollama"
                          : "Custom"}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="My OpenAI"
                  className="w-full bg-gray-700 rounded px-3 py-2"
                />
              </div>

              {/* API Key */}
              <div>
                <label className="block text-sm font-medium mb-1">API Key</label>
                <input
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  placeholder={formData.type === "ollama" ? "Not required for local Ollama" : "sk-..."}
                  className="w-full bg-gray-700 rounded px-3 py-2"
                />
                <p className="text-xs text-gray-400 mt-1">
                  {formData.type === "openai" && "Get your API key from platform.openai.com"}
                  {formData.type === "gemini" && "Get your API key from aistudio.google.com"}
                  {formData.type === "anthropic" && "Get your API key from console.anthropic.com"}
                  {formData.type === "ollama" && "Leave empty for local Ollama installation"}
                </p>
              </div>

              {/* Model */}
              <div>
                <label className="block text-sm font-medium mb-1">Model</label>
                {PROVIDER_MODELS[formData.type].length > 0 ? (
                  <select
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="w-full bg-gray-700 rounded px-3 py-2"
                  >
                    {PROVIDER_MODELS[formData.type].map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    placeholder="model-name"
                    className="w-full bg-gray-700 rounded px-3 py-2"
                  />
                )}
              </div>

              {/* Base URL */}
              <div>
                <label className="block text-sm font-medium mb-1">Base URL</label>
                <input
                  type="text"
                  value={formData.baseUrl}
                  onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                  placeholder="https://api.openai.com/v1"
                  className="w-full bg-gray-700 rounded px-3 py-2"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Change this if using a proxy, Azure OpenAI, or custom endpoint
                </p>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={() => {
                    resetForm();
                    setView("main");
                  }}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProvider}
                  disabled={!formData.name || !formData.model || (!formData.apiKey && formData.type !== "ollama")}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingProvider ? "Save Changes" : "Add Provider"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
