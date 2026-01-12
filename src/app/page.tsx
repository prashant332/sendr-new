"use client";

import { useState, useEffect, useCallback } from "react";
import Editor from "@monaco-editor/react";
import { KeyValueEditor, KeyValuePair } from "@/components/KeyValueEditor";
import { EnvironmentSelector } from "@/components/EnvironmentSelector";
import { EnvironmentManager } from "@/components/EnvironmentManager";
import { Sidebar } from "@/components/Sidebar";
import { CreateCollectionModal } from "@/components/CreateCollectionModal";
import { SaveRequestModal } from "@/components/SaveRequestModal";
import { WorkflowRunner } from "@/components/WorkflowRunner";
import { useEnvironmentStore } from "@/store/environmentStore";
import { interpolate } from "@/lib/interpolate";
import { runScript, TestResult, ScriptContext } from "@/lib/scriptRunner";
import { updateRequest, type SavedRequest } from "@/hooks/useCollections";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
type RequestTab = "params" | "headers" | "body" | "scripts";

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

  // Request configuration
  const [activeTab, setActiveTab] = useState<RequestTab>("params");
  const [params, setParams] = useState<KeyValuePair[]>([{ key: "", value: "", active: true }]);
  const [headers, setHeaders] = useState<KeyValuePair[]>([{ key: "", value: "", active: true }]);
  const [body, setBody] = useState("{\n  \n}");

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

  // Active request tracking
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved" | null>(null);

  // Get store methods
  const getActiveVariables = useEnvironmentStore((state) => state.getActiveVariables);
  const setVariables = useEnvironmentStore((state) => state.setVariables);

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
        preRequestScript,
        testScript,
      });
      setSaveStatus("saved");
    } catch {
      setSaveStatus("unsaved");
    }
  }, [activeRequestId, method, url, headers, params, body, preRequestScript, testScript]);

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
  }, [activeRequestId, method, url, headers, params, body, preRequestScript, testScript, saveCurrentRequest]);

  // Load request from sidebar
  const handleRequestSelect = (request: SavedRequest) => {
    setActiveRequestId(request.id);
    setMethod(request.method);
    setUrl(request.url);
    setHeaders(request.headers);
    setParams(request.params);
    setBody(request.body);
    setPreRequestScript(request.preRequestScript);
    setTestScript(request.testScript);
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
    setBody("{\n  \n}");
    setPreRequestScript("");
    setTestScript("");
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
      const headerObj: Record<string, string> = {};
      headers.filter((h) => h.active && h.key).forEach((h) => {
        const key = interpolate(h.key, variables);
        const value = interpolate(h.value, variables);
        headerObj[key] = value;
      });

      // Prepare request body
      let requestBody: unknown = undefined;
      if (["POST", "PUT", "PATCH"].includes(method) && body.trim()) {
        const interpolatedBody = interpolate(body, variables);
        try {
          requestBody = JSON.parse(interpolatedBody);
          if (!headerObj["Content-Type"]) {
            headerObj["Content-Type"] = "application/json";
          }
        } catch {
          requestBody = interpolatedBody;
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

  const tabs: { id: RequestTab; label: string }[] = [
    { id: "params", label: "Params" },
    { id: "headers", label: "Headers" },
    { id: "body", label: "Body" },
    { id: "scripts", label: "Scripts" },
  ];

  const requestData = {
    method,
    url,
    headers,
    params,
    body,
    preRequestScript,
    testScript,
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100">
      {/* Sidebar */}
      <Sidebar
        activeRequestId={activeRequestId}
        onRequestSelect={handleRequestSelect}
        onNewCollection={() => setShowCreateCollection(true)}
        onNewRequest={() => setShowSaveRequest(true)}
        onRunCollection={(id, name) => setRunnerCollection({ id, name })}
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

            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Enter URL (e.g., {{BASE_URL}}/todos/1)"
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm"
            />

            <button
              onClick={handleSend}
              disabled={loading || !url.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:cursor-not-allowed px-6 py-2 rounded font-medium text-sm transition-colors"
            >
              {loading ? "Sending..." : "Send"}
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

              {activeTab === "body" && (
                <div className="h-48 border border-zinc-700 rounded overflow-hidden">
                  <Editor
                    height="100%"
                    defaultLanguage="json"
                    theme="vs-dark"
                    value={body}
                    onChange={(value) => setBody(value || "")}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      lineNumbers: "on",
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                    }}
                  />
                </div>
              )}

              {activeTab === "scripts" && (
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-zinc-400 mb-2">Pre-request Script</div>
                    <div className="h-32 border border-zinc-700 rounded overflow-hidden">
                      <Editor
                        height="100%"
                        defaultLanguage="javascript"
                        theme="vs-dark"
                        value={preRequestScript}
                        onChange={(value) => setPreRequestScript(value || "")}
                        options={{
                          minimap: { enabled: false },
                          fontSize: 13,
                          lineNumbers: "on",
                          scrollBeyondLastLine: false,
                          automaticLayout: true,
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-zinc-400 mb-2">Test Script</div>
                    <div className="h-32 border border-zinc-700 rounded overflow-hidden">
                      <Editor
                        height="100%"
                        defaultLanguage="javascript"
                        theme="vs-dark"
                        value={testScript}
                        onChange={(value) => setTestScript(value || "")}
                        options={{
                          minimap: { enabled: false },
                          fontSize: 13,
                          lineNumbers: "on",
                          scrollBeyondLastLine: false,
                          automaticLayout: true,
                        }}
                      />
                    </div>
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
                  <div className="h-80">
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
    </div>
  );
}
