"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Editor, { type Monaco, type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { KeyValueEditor, KeyValuePair } from "@/components/KeyValueEditor";
import { setupMonacoVariableSupport } from "@/lib/monaco";
import { BodyEditor, createDefaultBody, getContentTypeForBody } from "@/components/BodyEditor";
import { AuthEditor, createDefaultAuth, applyAuth } from "@/components/AuthEditor";
import { ResponseVisualizer } from "@/components/ResponseVisualizer";
import { EnvironmentSelector } from "@/components/EnvironmentSelector";
import { EnvironmentManager } from "@/components/EnvironmentManager";
import { Sidebar } from "@/components/Sidebar";
import { CreateCollectionModal } from "@/components/CreateCollectionModal";
import { SaveRequestModal } from "@/components/SaveRequestModal";
import { WorkflowRunner } from "@/components/WorkflowRunner";
import { ImportExportModal } from "@/components/ImportExportModal";
import AIScriptAssistant from "@/components/AIScriptAssistant";
import QuickActions from "@/components/QuickActions";
import { VariableContextProvider, VariableInput, VariableInlinePreview } from "@/components/variable-preview";
import { useEnvironmentStore } from "@/store/environmentStore";
import { useAIStore } from "@/store/aiStore";
import { interpolate } from "@/lib/interpolate";
import { runScript, TestResult, ScriptContext } from "@/lib/scriptRunner";
import { updateRequest, type SavedRequest } from "@/hooks/useCollections";
import { RequestBody, RequestAuth, ResponseTemplate } from "@/lib/db";
import { ScriptType } from "@/lib/ai/types";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
type RequestTab = "params" | "headers" | "auth" | "body" | "scripts";
type ResponseTab = "rendered" | "body" | "headers" | "cookies" | "raw";

interface ApiResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: unknown;
  time: number;
  size: number;
}

interface ErrorResponse {
  error: string;
  code?: string;
}

export default function Home() {
  // Request state
  const [method, setMethod] = useState<HttpMethod>("GET");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ApiResponse | ErrorResponse | null>(null);
  const [responseTab, setResponseTab] = useState<ResponseTab>("rendered");

  // Request configuration
  const [activeTab, setActiveTab] = useState<RequestTab>("params");
  const [params, setParams] = useState<KeyValuePair[]>([{ key: "", value: "", active: true }]);
  const [headers, setHeaders] = useState<KeyValuePair[]>([{ key: "", value: "", active: true }]);
  const [body, setBody] = useState<RequestBody>(createDefaultBody());
  const [auth, setAuth] = useState<RequestAuth>(createDefaultAuth());
  const [responseTemplate, setResponseTemplate] = useState<ResponseTemplate | undefined>(undefined);

  // Scripts
  const [preRequestScript, setPreRequestScript] = useState("");
  const [testScript, setTestScript] = useState("");
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [scriptError, setScriptError] = useState<string | null>(null);

  // Modals
  const [showEnvManager, setShowEnvManager] = useState(false);
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [showSaveRequest, setShowSaveRequest] = useState(false);
  const [runnerCollection, setRunnerCollection] = useState<{ id: string; name: string } | null>(null);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);
  const [, setActiveScriptTab] = useState<ScriptType>("test");

  // Active request tracking
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved" | null>(null);

  // Get store methods
  const getActiveVariables = useEnvironmentStore((state) => state.getActiveVariables);
  const setVariables = useEnvironmentStore((state) => state.setVariables);
  const initializeEnv = useEnvironmentStore((state) => state.initialize);
  const isEnvLoaded = useEnvironmentStore((state) => state.isLoaded);
  const activeEnvironmentId = useEnvironmentStore((state) => state.activeEnvironmentId);
  const showInlinePreview = useEnvironmentStore((state) => state.showInlinePreview);
  const setShowInlinePreview = useEnvironmentStore((state) => state.setShowInlinePreview);

  // Monaco editor cleanup refs
  const preRequestEditorCleanupRef = useRef<(() => void) | null>(null);
  const testEditorCleanupRef = useRef<(() => void) | null>(null);

  // Get variables for Monaco providers
  const getVariablesForMonaco = useCallback(() => {
    const vars = getActiveVariables();
    return Object.entries(vars).map(([name, value]) => ({ name, value }));
  }, [getActiveVariables]);

  const isVariableDefinedForMonaco = useCallback(
    (name: string) => {
      const vars = getActiveVariables();
      return name in vars;
    },
    [getActiveVariables]
  );

  // Handle script editor mount
  const handlePreRequestEditorMount: OnMount = useCallback(
    (editorInstance: editor.IStandaloneCodeEditor, monaco: Monaco) => {
      if (preRequestEditorCleanupRef.current) {
        preRequestEditorCleanupRef.current();
      }
      preRequestEditorCleanupRef.current = setupMonacoVariableSupport(
        monaco,
        editorInstance,
        getVariablesForMonaco,
        isVariableDefinedForMonaco
      );
    },
    [getVariablesForMonaco, isVariableDefinedForMonaco]
  );

  const handleTestEditorMount: OnMount = useCallback(
    (editorInstance: editor.IStandaloneCodeEditor, monaco: Monaco) => {
      if (testEditorCleanupRef.current) {
        testEditorCleanupRef.current();
      }
      testEditorCleanupRef.current = setupMonacoVariableSupport(
        monaco,
        editorInstance,
        getVariablesForMonaco,
        isVariableDefinedForMonaco
      );
    },
    [getVariablesForMonaco, isVariableDefinedForMonaco]
  );

  // Initialize AI store
  const { initialize: initializeAI, isInitialized: isAIInitialized } = useAIStore();

  // Initialize stores on mount
  useEffect(() => {
    if (!isEnvLoaded) {
      initializeEnv();
    }
  }, [isEnvLoaded, initializeEnv]);

  useEffect(() => {
    if (!isAIInitialized) {
      initializeAI();
    }
  }, [isAIInitialized, initializeAI]);

  // Handle AI-generated script insertion
  const handleInsertScript = (script: string, scriptType: ScriptType) => {
    if (scriptType === "test") {
      setTestScript((prev) => (prev ? `${prev}\n\n${script}` : script));
    } else {
      setPreRequestScript((prev) => (prev ? `${prev}\n\n${script}` : script));
    }
    setShowAIAssistant(false);
  };

  // Handle quick action selection
  const handleQuickAction = (prompt: string, scriptType: ScriptType) => {
    setActiveScriptTab(scriptType);
    setShowAIAssistant(true);
  };

  // Auto-save for saved requests
  const saveCurrentRequest = useCallback(async () => {
    if (!activeRequestId) return;
    setSaveStatus("saving");
    try {
      await updateRequest(activeRequestId, {
        method,
        url,
        headers,
        params,
        body,
        auth,
        preRequestScript,
        testScript,
        responseTemplate,
      });
      setSaveStatus("saved");
    } catch {
      setSaveStatus("unsaved");
    }
  }, [activeRequestId, method, url, headers, params, body, auth, preRequestScript, testScript, responseTemplate]);

  // Debounced auto-save
  useEffect(() => {
    if (!activeRequestId) {
      setSaveStatus(null);
      return;
    }
    setSaveStatus("unsaved");
    const timeout = setTimeout(() => {
      saveCurrentRequest();
    }, 1000);
    return () => clearTimeout(timeout);
  }, [activeRequestId, method, url, headers, params, body, auth, preRequestScript, testScript, responseTemplate, saveCurrentRequest]);

  // Load request from sidebar
  const handleRequestSelect = (request: SavedRequest) => {
    setActiveRequestId(request.id);
    setMethod(request.method);
    setUrl(request.url);
    setHeaders(request.headers);
    setParams(request.params);
    // Handle backward compatibility: old requests have body as string
    if (typeof request.body === "string") {
      setBody({
        mode: "json",
        raw: request.body,
        formData: [{ key: "", value: "", active: true }],
      });
    } else {
      setBody(request.body);
    }
    // Handle backward compatibility: old requests may not have auth
    if (request.auth) {
      setAuth(request.auth);
    } else {
      setAuth(createDefaultAuth());
    }
    setPreRequestScript(request.preRequestScript);
    setTestScript(request.testScript);
    // Load response template if saved
    setResponseTemplate(request.responseTemplate);
    setResponse(null);
    setTestResults([]);
    setScriptError(null);
    setSaveStatus("saved");
  };

  // Handle new request saved
  const handleRequestSaved = (requestId: string) => {
    setActiveRequestId(requestId);
    setSaveStatus("saved");
  };

  // Clear active request (new request)
  const handleNewRequest = () => {
    setActiveRequestId(null);
    setMethod("GET");
    setUrl("");
    setHeaders([{ key: "", value: "", active: true }]);
    setParams([{ key: "", value: "", active: true }]);
    setBody(createDefaultBody());
    setAuth(createDefaultAuth());
    setPreRequestScript("");
    setTestScript("");
    setResponseTemplate(undefined);
    setResponse(null);
    setTestResults([]);
    setScriptError(null);
    setSaveStatus(null);
  };

  const handleSend = async () => {
    if (!url.trim()) return;

    setLoading(true);
    setResponse(null);
    setTestResults([]);
    setScriptError(null);

    try {
      // Get active environment variables
      let variables = getActiveVariables();

      // Run pre-request script
      if (preRequestScript.trim()) {
        const preResult = runScript(preRequestScript, { variables });
        if (preResult.error) {
          setScriptError(`Pre-request script error: ${preResult.error}`);
          setLoading(false);
          return;
        }
        variables = preResult.updatedVariables;
        setVariables(variables);
      }

      // Interpolate URL
      let finalUrl = interpolate(url, variables);

      // Build URL with query params
      const activeParams = params.filter((p) => p.active && p.key);
      if (activeParams.length > 0) {
        const searchParams = new URLSearchParams();
        activeParams.forEach((p) => {
          const key = interpolate(p.key, variables);
          const value = interpolate(p.value, variables);
          searchParams.append(key, value);
        });
        const separator = finalUrl.includes("?") ? "&" : "?";
        finalUrl = `${finalUrl}${separator}${searchParams.toString()}`;
      }

      // Build headers object
      let headerObj: Record<string, string> = {};
      headers.filter((h) => h.active && h.key).forEach((h) => {
        const key = interpolate(h.key, variables);
        const value = interpolate(h.value, variables);
        headerObj[key] = value;
      });

      // Apply authentication
      const authResult = applyAuth(auth, headerObj, variables, interpolate);
      headerObj = authResult.headers;

      // Add auth query params if any (for API key in query)
      if (authResult.queryParams) {
        const authParams = new URLSearchParams(authResult.queryParams);
        const separator = finalUrl.includes("?") ? "&" : "?";
        finalUrl = `${finalUrl}${separator}${authParams.toString()}`;
      }

      // Prepare request body based on mode
      let requestBody: unknown = undefined;
      if (["POST", "PUT", "PATCH"].includes(method) && body.mode !== "none") {
        // Set content type if not already set
        const contentType = getContentTypeForBody(body);
        if (contentType && !headerObj["Content-Type"] && body.mode !== "form-data") {
          headerObj["Content-Type"] = contentType;
        }

        if (body.mode === "json" || body.mode === "xml" || body.mode === "raw") {
          const interpolatedBody = interpolate(body.raw, variables);
          if (body.mode === "json" && interpolatedBody.trim()) {
            try {
              requestBody = JSON.parse(interpolatedBody);
            } catch {
              requestBody = interpolatedBody;
            }
          } else {
            requestBody = interpolatedBody;
          }
        } else if (body.mode === "form-data" || body.mode === "x-www-form-urlencoded") {
          const formData: Record<string, string> = {};
          body.formData
            .filter((f) => f.active && f.key)
            .forEach((f) => {
              formData[interpolate(f.key, variables)] = interpolate(f.value, variables);
            });
          requestBody = { _formData: formData, _formMode: body.mode };
        }
      }

      const res = await fetch("/api/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method,
          url: finalUrl,
          headers: headerObj,
          body: requestBody,
        }),
      });

      const data = await res.json();
      setResponse(data);

      // Run test script
      if (testScript.trim() && !("error" in data)) {
        const context: ScriptContext = {
          variables,
          response: {
            status: data.status,
            statusText: data.statusText,
            headers: data.headers,
            data: data.data,
          },
        };
        const testResult = runScript(testScript, context);
        if (testResult.error) {
          setScriptError(`Test script error: ${testResult.error}`);
        }
        setTestResults(testResult.testResults);
        if (Object.keys(testResult.updatedVariables).length > 0) {
          setVariables(testResult.updatedVariables);
        }
      }
    } catch {
      setResponse({ error: "Failed to connect to proxy server" });
    } finally {
      setLoading(false);
    }
  };

  const isErrorResponse = (r: ApiResponse | ErrorResponse): r is ErrorResponse => {
    return "error" in r;
  };

  // Parse cookies from response headers
  const parseCookies = (headers: Record<string, string>): { name: string; value: string; attributes: string }[] => {
    const cookies: { name: string; value: string; attributes: string }[] = [];

    // Look for Set-Cookie headers (case-insensitive)
    Object.entries(headers).forEach(([key, value]) => {
      if (key.toLowerCase() === "set-cookie") {
        // Handle multiple cookies (may be comma-separated or single)
        const cookieStrings = value.split(/,(?=\s*[^;=]+=[^;]*)/);
        cookieStrings.forEach((cookieStr) => {
          const parts = cookieStr.trim().split(";");
          if (parts.length > 0) {
            const [nameValue, ...attrs] = parts;
            const eqIndex = nameValue.indexOf("=");
            if (eqIndex > 0) {
              cookies.push({
                name: nameValue.substring(0, eqIndex).trim(),
                value: nameValue.substring(eqIndex + 1).trim(),
                attributes: attrs.map((a) => a.trim()).join("; "),
              });
            }
          }
        });
      }
    });

    return cookies;
  };

  // Get raw response as string
  const getRawResponse = (data: unknown): string => {
    if (typeof data === "string") return data;
    return JSON.stringify(data, null, 2);
  };

  const responseTabs: { id: ResponseTab; label: string }[] = [
    { id: "rendered", label: "Rendered" },
    { id: "body", label: "Body" },
    { id: "headers", label: "Headers" },
    { id: "cookies", label: "Cookies" },
    { id: "raw", label: "Raw" },
  ];

  const tabs: { id: RequestTab; label: string }[] = [
    { id: "params", label: "Params" },
    { id: "headers", label: "Headers" },
    { id: "auth", label: "Auth" },
    { id: "body", label: "Body" },
    { id: "scripts", label: "Scripts" },
  ];

  const requestData = {
    method,
    url,
    headers,
    params,
    body,
    auth,
    preRequestScript,
    testScript,
  };

  return (
    <VariableContextProvider>
    <div className="flex h-screen bg-zinc-950 text-zinc-100">
      {/* Sidebar */}
      <Sidebar
        activeRequestId={activeRequestId}
        onRequestSelect={handleRequestSelect}
        onNewCollection={() => setShowCreateCollection(true)}
        onNewRequest={() => setShowSaveRequest(true)}
        onRunCollection={(id, name) => setRunnerCollection({ id, name })}
        onImportExport={() => setShowImportExport(true)}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">Sendr</h1>
              {saveStatus && (
                <span className="text-xs text-zinc-500">
                  {saveStatus === "saving"
                    ? "Saving..."
                    : saveStatus === "saved"
                    ? "Saved"
                    : "Unsaved"}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleNewRequest}
                className="text-sm text-zinc-400 hover:text-zinc-200"
              >
                New Request
              </button>
              <EnvironmentSelector onManageClick={() => setShowEnvManager(true)} />
            </div>
          </div>

          {/* Request Bar */}
          <div className="flex gap-2 mb-4">
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as HttpMethod)}
              className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm font-medium"
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
              <option value="PATCH">PATCH</option>
            </select>

            <div className="flex-1 flex flex-col">
              <VariableInput
                value={url}
                onChange={setUrl}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Enter URL (e.g., {{BASE_URL}}/todos/1)"
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm"
                onOpenEnvManager={() => setShowEnvManager(true)}
              />
              {showInlinePreview && url && (
                <VariableInlinePreview
                  value={url}
                  className="mt-1 px-1"
                />
              )}
            </div>

            <button
              onClick={handleSend}
              disabled={loading || !url.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:cursor-not-allowed px-6 py-2 rounded font-medium text-sm transition-colors self-start"
            >
              {loading ? "Sending..." : "Send"}
            </button>

            <button
              onClick={() => setShowInlinePreview(!showInlinePreview)}
              className={`p-2 rounded transition-colors self-start ${
                showInlinePreview
                  ? "bg-blue-600/20 text-blue-400 hover:bg-blue-600/30"
                  : "bg-zinc-700 text-zinc-400 hover:bg-zinc-600"
              }`}
              title={showInlinePreview ? "Hide variable preview" : "Show variable preview"}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {showInlinePreview ? (
                  <>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </>
                ) : (
                  <>
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </>
                )}
              </svg>
            </button>
          </div>

          {/* Request Tabs */}
          <div className="bg-zinc-900 border border-zinc-800 rounded mb-6">
            <div className="flex border-b border-zinc-800">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? "text-blue-400 border-b-2 border-blue-400"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-4">
              {activeTab === "params" && (
                <KeyValueEditor
                  pairs={params}
                  onChange={setParams}
                  keyPlaceholder="Parameter"
                  valuePlaceholder="Value"
                />
              )}

              {activeTab === "headers" && (
                <KeyValueEditor
                  pairs={headers}
                  onChange={setHeaders}
                  keyPlaceholder="Header"
                  valuePlaceholder="Value"
                />
              )}

              {activeTab === "auth" && (
                <AuthEditor auth={auth} onChange={setAuth} />
              )}

              {activeTab === "body" && (
                <BodyEditor body={body} onChange={setBody} />
              )}

              {activeTab === "scripts" && (
                <div className="space-y-4">
                  {/* AI Generate Button */}
                  <div className="flex justify-end">
                    <button
                      onClick={() => setShowAIAssistant(true)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded text-sm font-medium transition-colors"
                    >
                      <span>✨</span>
                      AI Generate
                    </button>
                  </div>

                  <div>
                    <div className="text-sm text-zinc-400 mb-2">Pre-request Script</div>
                    <div className="h-32 border border-zinc-700 rounded overflow-hidden">
                      <Editor
                        key={`pre-request-editor-${activeEnvironmentId}`}
                        height="100%"
                        defaultLanguage="javascript"
                        theme="vs-dark"
                        value={preRequestScript}
                        onChange={(value) => setPreRequestScript(value || "")}
                        onMount={handlePreRequestEditorMount}
                        options={{
                          minimap: { enabled: false },
                          fontSize: 13,
                          lineNumbers: "on",
                          scrollBeyondLastLine: false,
                          automaticLayout: true,
                          quickSuggestions: {
                            strings: true,
                            comments: true,
                            other: true,
                          },
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-zinc-400 mb-2">Test Script</div>
                    <div className="h-32 border border-zinc-700 rounded overflow-hidden">
                      <Editor
                        key={`test-editor-${activeEnvironmentId}`}
                        height="100%"
                        defaultLanguage="javascript"
                        theme="vs-dark"
                        value={testScript}
                        onChange={(value) => setTestScript(value || "")}
                        onMount={handleTestEditorMount}
                        options={{
                          minimap: { enabled: false },
                          fontSize: 13,
                          lineNumbers: "on",
                          scrollBeyondLastLine: false,
                          automaticLayout: true,
                          quickSuggestions: {
                            strings: true,
                            comments: true,
                            other: true,
                          },
                        }}
                      />
                    </div>
                    {/* Quick Actions for Test Scripts */}
                    {response && !isErrorResponse(response) && (
                      <QuickActions
                        response={response.data}
                        onSelectAction={handleQuickAction}
                        scriptType="test"
                      />
                    )}
                  </div>
                  <div className="text-xs text-zinc-500">
                    Available: pm.environment.get(key), pm.environment.set(key, value),
                    pm.response.json() (test only), pm.test(name, fn)
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Script Error */}
          {scriptError && (
            <div className="bg-red-900/20 border border-red-800 rounded p-4 mb-6">
              <div className="text-red-400 font-medium">Script Error</div>
              <div className="text-red-300 text-sm mt-1">{scriptError}</div>
            </div>
          )}

          {/* Test Results */}
          {testResults.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded p-4 mb-6">
              <div className="text-sm font-medium mb-3">Test Results</div>
              <div className="space-y-2">
                {testResults.map((result, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <span className={result.passed ? "text-green-400" : "text-red-400"}>
                      {result.passed ? "✓" : "✗"}
                    </span>
                    <span className={result.passed ? "text-zinc-300" : "text-red-300"}>
                      {result.name}
                    </span>
                    {result.error && (
                      <span className="text-red-400 text-xs">({result.error})</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Response Area */}
          {response && (
            <div className="bg-zinc-900 border border-zinc-800 rounded">
              {isErrorResponse(response) ? (
                <div className="p-4">
                  <div className="text-red-400 font-medium mb-2">Error</div>
                  <div className="text-zinc-400">{response.error}</div>
                  {response.code && (
                    <div className="text-zinc-500 text-sm mt-1">Code: {response.code}</div>
                  )}
                </div>
              ) : (
                <>
                  {/* Response Status Bar */}
                  <div className="flex items-center gap-4 px-4 py-3 border-b border-zinc-800 text-sm">
                    <span
                      className={`font-medium ${
                        response.status >= 200 && response.status < 300
                          ? "text-green-400"
                          : response.status >= 400
                          ? "text-red-400"
                          : "text-yellow-400"
                      }`}
                    >
                      {response.status} {response.statusText}
                    </span>
                    <span className="text-zinc-500">{response.time}ms</span>
                    <span className="text-zinc-500">
                      {response.size > 1024
                        ? `${(response.size / 1024).toFixed(2)} KB`
                        : `${response.size} B`}
                    </span>
                  </div>

                  {/* Response Tabs */}
                  <div className="flex border-b border-zinc-800">
                    {responseTabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setResponseTab(tab.id)}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                          responseTab === tab.id
                            ? "text-blue-400 border-b-2 border-blue-400"
                            : "text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        {tab.label}
                        {tab.id === "cookies" && (() => {
                          const cookies = parseCookies(response.headers);
                          return cookies.length > 0 ? ` (${cookies.length})` : "";
                        })()}
                        {tab.id === "headers" && ` (${Object.keys(response.headers).length})`}
                      </button>
                    ))}
                  </div>

                  {/* Response Content */}
                  <div className="h-80">
                    {responseTab === "rendered" && (
                      <ResponseVisualizer
                        data={response.data}
                        template={responseTemplate}
                        onTemplateChange={setResponseTemplate}
                      />
                    )}

                    {responseTab === "body" && (
                      <Editor
                        height="100%"
                        defaultLanguage="json"
                        theme="vs-dark"
                        value={JSON.stringify(response.data, null, 2)}
                        options={{
                          readOnly: true,
                          minimap: { enabled: false },
                          fontSize: 13,
                          lineNumbers: "on",
                          scrollBeyondLastLine: false,
                          automaticLayout: true,
                        }}
                      />
                    )}

                    {responseTab === "headers" && (
                      <div className="p-4 overflow-auto h-full">
                        {Object.keys(response.headers).length === 0 ? (
                          <div className="text-zinc-500 text-sm">No headers in response</div>
                        ) : (
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-zinc-700">
                                <th className="text-left py-2 pr-4 text-zinc-400 font-medium">Header</th>
                                <th className="text-left py-2 text-zinc-400 font-medium">Value</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(response.headers).map(([key, value]) => (
                                <tr key={key} className="border-b border-zinc-800">
                                  <td className="py-2 pr-4 text-blue-400 font-mono">{key}</td>
                                  <td className="py-2 text-zinc-300 font-mono break-all">{value}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}

                    {responseTab === "cookies" && (
                      <div className="p-4 overflow-auto h-full">
                        {(() => {
                          const cookies = parseCookies(response.headers);
                          if (cookies.length === 0) {
                            return <div className="text-zinc-500 text-sm">No cookies in response</div>;
                          }
                          return (
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-zinc-700">
                                  <th className="text-left py-2 pr-4 text-zinc-400 font-medium">Name</th>
                                  <th className="text-left py-2 pr-4 text-zinc-400 font-medium">Value</th>
                                  <th className="text-left py-2 text-zinc-400 font-medium">Attributes</th>
                                </tr>
                              </thead>
                              <tbody>
                                {cookies.map((cookie, index) => (
                                  <tr key={index} className="border-b border-zinc-800">
                                    <td className="py-2 pr-4 text-blue-400 font-mono">{cookie.name}</td>
                                    <td className="py-2 pr-4 text-zinc-300 font-mono break-all">{cookie.value}</td>
                                    <td className="py-2 text-zinc-500 font-mono text-xs">{cookie.attributes || "-"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          );
                        })()}
                      </div>
                    )}

                    {responseTab === "raw" && (
                      <Editor
                        height="100%"
                        defaultLanguage="text"
                        theme="vs-dark"
                        value={getRawResponse(response.data)}
                        options={{
                          readOnly: true,
                          minimap: { enabled: false },
                          fontSize: 13,
                          lineNumbers: "off",
                          scrollBeyondLastLine: false,
                          automaticLayout: true,
                          wordWrap: "on",
                        }}
                      />
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showEnvManager && (
        <EnvironmentManager onClose={() => setShowEnvManager(false)} />
      )}
      {showCreateCollection && (
        <CreateCollectionModal onClose={() => setShowCreateCollection(false)} />
      )}
      {showSaveRequest && (
        <SaveRequestModal
          requestData={requestData}
          onClose={() => setShowSaveRequest(false)}
          onSaved={handleRequestSaved}
        />
      )}
      {runnerCollection && (
        <WorkflowRunner
          collectionId={runnerCollection.id}
          collectionName={runnerCollection.name}
          onClose={() => setRunnerCollection(null)}
        />
      )}
      <AIScriptAssistant
        isOpen={showAIAssistant}
        onClose={() => setShowAIAssistant(false)}
        onInsertScript={handleInsertScript}
        response={response && !isErrorResponse(response) ? response.data : null}
        environmentVariables={getActiveVariables()}
        requestDetails={{ method, url }}
        existingPreRequestScript={preRequestScript}
        existingTestScript={testScript}
      />
      <ImportExportModal
        isOpen={showImportExport}
        onClose={() => setShowImportExport(false)}
      />
    </div>
    </VariableContextProvider>
  );
}
