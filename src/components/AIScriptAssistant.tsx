"use client";

import { useState, useEffect } from "react";
import { useAIStore } from "@/store/aiStore";
import {
  buildScriptContext,
  buildSystemPrompt,
  validateScript,
  getAdapter,
  suggestQuickActions,
} from "@/lib/ai";
import { ScriptType, ConversationMessage, QuickAction } from "@/lib/ai/types";
import AISettingsModal from "./AISettingsModal";

interface AIScriptAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertScript: (script: string, scriptType: ScriptType) => void;
  response: unknown;
  environmentVariables: Record<string, string>;
  requestDetails: { method: string; url: string; isGrpc?: boolean };
  existingPreRequestScript?: string;
  existingTestScript?: string;
}

export default function AIScriptAssistant({
  isOpen,
  onClose,
  onInsertScript,
  response,
  environmentVariables,
  requestDetails,
  existingPreRequestScript,
  existingTestScript,
}: AIScriptAssistantProps) {
  const { settings, getDefaultProvider, initialize, isInitialized } = useAIStore();

  const [prompt, setPrompt] = useState("");
  const [scriptType, setScriptType] = useState<ScriptType>("test");
  const [generatedScript, setGeneratedScript] = useState("");
  const [explanation, setExplanation] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);

  // Initialize AI store
  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [initialize, isInitialized]);

  // Generate quick actions when response changes
  useEffect(() => {
    if (response && settings.enableAutoSuggestions) {
      const actions = suggestQuickActions(response);
      setQuickActions(actions);
    } else {
      setQuickActions([]);
    }
  }, [response, settings.enableAutoSuggestions]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    const provider = getDefaultProvider();
    if (!provider) {
      setError("No AI provider configured. Please add a provider in settings.");
      setShowSettings(true);
      return;
    }

    const adapter = getAdapter(provider.type);
    if (!adapter) {
      setError(`No adapter available for provider type: ${provider.type}`);
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedScript("");
    setExplanation("");
    setValidationWarnings([]);

    try {
      // Build context
      const existingScript = scriptType === "test" ? existingTestScript : existingPreRequestScript;
      const context = buildScriptContext(
        response,
        environmentVariables,
        requestDetails,
        existingScript,
        settings.includeResponseSample
      );

      // Build system prompt
      const systemPrompt = buildSystemPrompt(scriptType, context);

      // Generate script
      const result = await adapter.generateScript(
        {
          prompt,
          scriptType,
          context,
          conversationHistory,
        },
        provider,
        systemPrompt
      );

      setGeneratedScript(result.script);
      setExplanation(result.explanation);

      // Validate the generated script
      const validation = validateScript(result.script, scriptType);
      if (!validation.valid) {
        setError(`Script has errors:\n${validation.errors.join("\n")}`);
      }
      if (validation.warnings.length > 0) {
        setValidationWarnings(validation.warnings);
      }

      // Update conversation history for refinement
      setConversationHistory([
        ...conversationHistory,
        { role: "user", content: prompt },
        { role: "assistant", content: `\`\`\`javascript\n${result.script}\n\`\`\`\n\n${result.explanation}` },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate script");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleQuickAction = (action: QuickAction) => {
    setPrompt(action.prompt);
    setScriptType(action.scriptType);
  };

  const handleInsert = () => {
    if (generatedScript) {
      onInsertScript(generatedScript, scriptType);
      // Clear state after insert
      setPrompt("");
      setGeneratedScript("");
      setExplanation("");
      setConversationHistory([]);
    }
  };

  const handleCopy = async () => {
    if (generatedScript) {
      await navigator.clipboard.writeText(generatedScript);
    }
  };

  const handleClear = () => {
    setPrompt("");
    setGeneratedScript("");
    setExplanation("");
    setError(null);
    setValidationWarnings([]);
    setConversationHistory([]);
  };

  if (!isOpen) return null;

  const defaultProvider = getDefaultProvider();

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-[#1e1e1e] rounded-lg w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <span className="text-xl">✨</span>
              <h2 className="text-lg font-semibold">AI Script Assistant</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSettings(true)}
                className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded"
              >
                Settings
              </button>
              <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">
                ✕
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Provider Status */}
            {!defaultProvider ? (
              <div className="bg-yellow-900/30 border border-yellow-700 rounded p-3 text-sm">
                <strong>No AI provider configured.</strong> Click Settings to add an OpenAI or
                Gemini provider.
              </div>
            ) : (
              <div className="text-sm text-gray-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                Using: {defaultProvider.name} ({defaultProvider.model})
              </div>
            )}

            {/* Quick Actions */}
            {quickActions.length > 0 && !generatedScript && (
              <div>
                <div className="text-sm text-gray-400 mb-2">Quick Actions:</div>
                <div className="flex flex-wrap gap-2">
                  {quickActions.slice(0, 6).map((action) => (
                    <button
                      key={action.id}
                      onClick={() => handleQuickAction(action)}
                      className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded-full flex items-center gap-1.5"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Script Type Toggle */}
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-400">Generate:</span>
              <div className="flex rounded overflow-hidden">
                <button
                  onClick={() => setScriptType("test")}
                  className={`px-4 py-1.5 text-sm ${
                    scriptType === "test" ? "bg-blue-600" : "bg-gray-700 hover:bg-gray-600"
                  }`}
                >
                  Test Script
                </button>
                <button
                  onClick={() => setScriptType("pre-request")}
                  className={`px-4 py-1.5 text-sm ${
                    scriptType === "pre-request" ? "bg-blue-600" : "bg-gray-700 hover:bg-gray-600"
                  }`}
                >
                  Pre-Request Script
                </button>
              </div>
            </div>

            {/* Prompt Input */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Describe what you want the script to do:
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  scriptType === "test"
                    ? 'e.g., "Extract the auth token from response and save it as authToken variable"'
                    : 'e.g., "Set a timestamp header with the current time"'
                }
                className="w-full h-24 bg-gray-800 rounded p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    handleGenerate();
                  }
                }}
              />
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-gray-500">Press ⌘+Enter to generate</span>
                <button
                  onClick={handleGenerate}
                  disabled={!prompt.trim() || isGenerating || !defaultProvider}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <span className="animate-spin">⟳</span>
                      Generating...
                    </>
                  ) : (
                    <>
                      <span>✨</span>
                      Generate Script
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-900/30 border border-red-700 rounded p-3 text-sm text-red-300">
                {error}
              </div>
            )}

            {/* Generated Script */}
            {generatedScript && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Generated Script:</span>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCopy}
                      className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded"
                    >
                      Copy
                    </button>
                    <button
                      onClick={handleClear}
                      className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <pre className="bg-gray-900 rounded p-4 overflow-x-auto text-sm">
                  <code className="text-green-300">{generatedScript}</code>
                </pre>

                {/* Explanation */}
                {explanation && (
                  <div className="text-sm text-gray-300 bg-gray-800 rounded p-3">
                    <strong>Explanation:</strong> {explanation}
                  </div>
                )}

                {/* Validation Warnings */}
                {validationWarnings.length > 0 && (
                  <div className="bg-yellow-900/30 border border-yellow-700 rounded p-3 text-sm">
                    <strong>Warnings:</strong>
                    <ul className="list-disc ml-4 mt-1 text-yellow-200">
                      {validationWarnings.map((warning, i) => (
                        <li key={i}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Refinement Input */}
                {conversationHistory.length > 0 && (
                  <div className="mt-4">
                    <label className="block text-sm text-gray-400 mb-2">
                      Refine the script (optional):
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder='e.g., "Also add a null check" or "Use a different variable name"'
                        className="flex-1 bg-gray-800 rounded px-3 py-2 text-sm"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const input = e.currentTarget;
                            if (input.value.trim()) {
                              setPrompt(input.value);
                              input.value = "";
                              handleGenerate();
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Insert Button */}
                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleInsert}
                    className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded font-medium"
                  >
                    Insert into {scriptType === "test" ? "Test" : "Pre-Request"} Script
                  </button>
                </div>
              </div>
            )}

            {/* Context Info */}
            {!generatedScript && response !== null && response !== undefined && (
              <div className="text-xs text-gray-500 mt-4">
                <strong>Context available:</strong> Response data{" "}
                {settings.includeResponseSample ? "(sample included)" : "(schema only)"},{" "}
                {Object.keys(environmentVariables).length} environment variables
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      <AISettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </>
  );
}
