"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useProtoSchemas, useProtoSchema } from "@/hooks/useProtoSchemas";
import { KeyValueEditor, KeyValuePair } from "@/components/KeyValueEditor";
import { ProtoSchemaManager } from "@/components/ProtoSchemaManager";
import type { GrpcConfig, GrpcMetadataEntry } from "@/lib/db";
import { parseProtoContent, generateSampleMessage, getMethodType } from "@/lib/grpc/protoParser";

interface GrpcRequestEditorProps {
  config: GrpcConfig | undefined;
  onChange: (config: GrpcConfig) => void;
  serverAddress: string;
  onServerAddressChange: (address: string) => void;
  requestMessage: string;
  onRequestMessageChange: (message: string) => void;
}

// Default gRPC config
export function createDefaultGrpcConfig(): GrpcConfig {
  return {
    protoSchemaId: "",
    service: "",
    method: "",
    useTls: false,
    insecure: false,
    timeout: 30000,
    metadata: [{ key: "", value: "", active: true }],
  };
}

export function GrpcRequestEditor({
  config,
  onChange,
  serverAddress,
  onServerAddressChange,
  requestMessage,
  onRequestMessageChange,
}: GrpcRequestEditorProps) {
  const schemas = useProtoSchemas();
  const selectedSchema = useProtoSchema(config?.protoSchemaId || null);

  const [showProtoManager, setShowProtoManager] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<"message" | "metadata" | "options">("message");

  const editorRef = useState<editor.IStandaloneCodeEditor | null>(null);

  // Parse schema - derived state using useMemo
  const parsedServices = useMemo(() => {
    if (selectedSchema) {
      const result = parseProtoContent(selectedSchema.content);
      return result.services;
    }
    return [];
  }, [selectedSchema]);

  // Auto-select first service and method when schema changes
  useEffect(() => {
    if (selectedSchema && parsedServices.length > 0 && !config?.service) {
      const firstService = parsedServices[0];
      const firstMethod = firstService.methods[0];
      onChange({
        ...createDefaultGrpcConfig(),
        ...config,
        protoSchemaId: selectedSchema.id,
        service: firstService.fullName,
        method: firstMethod?.name || "",
      });

      // Generate sample message for the method
      if (firstMethod) {
        const sample = generateSampleMessage(selectedSchema.content, firstMethod.inputType);
        if (sample) {
          onRequestMessageChange(JSON.stringify(sample, null, 2));
        }
      }
    }
  }, [selectedSchema, parsedServices, config, onChange, onRequestMessageChange]);

  // Get current service object
  const currentService = useMemo(() => {
    return parsedServices.find((s) => s.fullName === config?.service);
  }, [parsedServices, config?.service]);

  // Get current method object
  const currentMethod = useMemo(() => {
    return currentService?.methods.find((m) => m.name === config?.method);
  }, [currentService, config?.method]);

  // Handle schema selection
  const handleSchemaSelect = useCallback(
    (schemaId: string) => {
      onChange({
        ...createDefaultGrpcConfig(),
        ...config,
        protoSchemaId: schemaId,
        service: "",
        method: "",
      });
      setShowProtoManager(false);
    },
    [config, onChange]
  );

  // Handle service change
  const handleServiceChange = useCallback(
    (serviceFullName: string) => {
      const service = parsedServices.find((s) => s.fullName === serviceFullName);
      const firstMethod = service?.methods[0];

      onChange({
        ...createDefaultGrpcConfig(),
        ...config,
        service: serviceFullName,
        method: firstMethod?.name || "",
      });

      // Generate sample message for the method
      if (firstMethod && selectedSchema) {
        const sample = generateSampleMessage(selectedSchema.content, firstMethod.inputType);
        if (sample) {
          onRequestMessageChange(JSON.stringify(sample, null, 2));
        }
      }
    },
    [config, onChange, parsedServices, selectedSchema, onRequestMessageChange]
  );

  // Handle method change
  const handleMethodChange = useCallback(
    (methodName: string) => {
      onChange({
        ...createDefaultGrpcConfig(),
        ...config,
        method: methodName,
      });

      // Generate sample message for the method
      const method = currentService?.methods.find((m) => m.name === methodName);
      if (method && selectedSchema) {
        const sample = generateSampleMessage(selectedSchema.content, method.inputType);
        if (sample) {
          onRequestMessageChange(JSON.stringify(sample, null, 2));
        }
      }
    },
    [config, onChange, currentService, selectedSchema, onRequestMessageChange]
  );

  // Handle metadata change
  const handleMetadataChange = useCallback(
    (pairs: KeyValuePair[]) => {
      const metadata: GrpcMetadataEntry[] = pairs.map((p) => ({
        key: p.key.toLowerCase(), // gRPC metadata keys must be lowercase
        value: p.value,
        active: p.active,
      }));
      onChange({
        ...createDefaultGrpcConfig(),
        ...config,
        metadata,
      });
    },
    [config, onChange]
  );

  // Convert metadata to KeyValuePair for editor
  const metadataPairs: KeyValuePair[] = useMemo(() => {
    return (
      config?.metadata?.map((m) => ({
        key: m.key,
        value: m.value,
        active: m.active,
      })) || [{ key: "", value: "", active: true }]
    );
  }, [config?.metadata]);

  // Handle editor mount
  const handleEditorMount: OnMount = useCallback(
    (editorInstance: editor.IStandaloneCodeEditor) => {
      editorRef[1](editorInstance);
    },
    [editorRef]
  );

  return (
    <div className="space-y-4">
      {/* Server Address */}
      <div>
        <label className="block text-xs text-zinc-400 mb-1">Server Address</label>
        <input
          type="text"
          value={serverAddress}
          onChange={(e) => onServerAddressChange(e.target.value)}
          placeholder="localhost:50051"
          className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm"
        />
      </div>

      {/* Proto Schema Selection */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs text-zinc-400 mb-1">Proto Schema</label>
          <div className="flex gap-2">
            <select
              value={config?.protoSchemaId || ""}
              onChange={(e) => handleSchemaSelect(e.target.value)}
              className="flex-1 bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm"
            >
              <option value="">Select a proto schema...</option>
              {schemas.map((schema) => (
                <option key={schema.id} value={schema.id}>
                  {schema.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowProtoManager(true)}
              className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded text-sm"
              title="Manage Proto Schemas"
            >
              Manage
            </button>
          </div>
        </div>
      </div>

      {/* Service and Method Selection */}
      {selectedSchema && parsedServices.length > 0 && (
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs text-zinc-400 mb-1">Service</label>
            <select
              value={config?.service || ""}
              onChange={(e) => handleServiceChange(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm"
            >
              <option value="">Select a service...</option>
              {parsedServices.map((service) => (
                <option key={service.fullName} value={service.fullName}>
                  {service.name} ({service.methods.length} methods)
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-zinc-400 mb-1">Method</label>
            <select
              value={config?.method || ""}
              onChange={(e) => handleMethodChange(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm"
              disabled={!currentService}
            >
              <option value="">Select a method...</option>
              {currentService?.methods.map((method) => (
                <option key={method.name} value={method.name}>
                  {method.name} ({getMethodType(method)})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Method Info */}
      {currentMethod && (
        <div className="text-xs text-zinc-500 bg-zinc-800 rounded px-3 py-2">
          <span className="text-zinc-400">{currentMethod.inputType}</span>
          <span className="mx-2">→</span>
          <span className="text-zinc-400">{currentMethod.outputType}</span>
          <span
            className={`ml-2 px-1.5 py-0.5 rounded ${
              currentMethod.clientStreaming || currentMethod.serverStreaming
                ? "bg-yellow-600/30 text-yellow-400"
                : "bg-green-600/30 text-green-400"
            }`}
          >
            {getMethodType(currentMethod)}
          </span>
        </div>
      )}

      {/* Sub Tabs */}
      <div className="border-b border-zinc-700">
        <div className="flex gap-1">
          {(["message", "metadata", "options"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveSubTab(tab)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                activeSubTab === tab
                  ? "text-purple-400 border-b-2 border-purple-400"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Message Editor */}
      {activeSubTab === "message" && (
        <div>
          {currentMethod ? (
            <>
              <div className="text-xs text-zinc-400 mb-2">
                Request Message ({currentMethod.inputType})
              </div>
              <div className="h-48 border border-zinc-700 rounded overflow-hidden">
                <Editor
                  height="100%"
                  language="json"
                  theme="vs-dark"
                  value={requestMessage}
                  onChange={(value) => onRequestMessageChange(value || "{}")}
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
            </>
          ) : (
            <div className="text-zinc-500 text-sm py-4 text-center">
              Select a proto schema, service, and method to edit the request message
            </div>
          )}
        </div>
      )}

      {/* Metadata Editor */}
      {activeSubTab === "metadata" && (
        <div>
          <div className="text-xs text-zinc-400 mb-2">
            Request Metadata (gRPC Headers)
          </div>
          <KeyValueEditor
            pairs={metadataPairs}
            onChange={handleMetadataChange}
            keyPlaceholder="key (lowercase)"
            valuePlaceholder="value"
          />
          <div className="text-xs text-zinc-500 mt-2">
            Keys must be lowercase. Keys ending in &quot;-bin&quot; are treated as binary (base64).
          </div>
        </div>
      )}

      {/* Options */}
      {activeSubTab === "options" && (
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={config?.useTls || false}
                onChange={(e) =>
                  onChange({
                    ...createDefaultGrpcConfig(),
                    ...config,
                    useTls: e.target.checked,
                  })
                }
                className="rounded bg-zinc-800 border-zinc-600"
              />
              Use TLS
            </label>
            {config?.useTls && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={config?.insecure || false}
                  onChange={(e) =>
                    onChange({
                      ...createDefaultGrpcConfig(),
                      ...config,
                      insecure: e.target.checked,
                    })
                  }
                  className="rounded bg-zinc-800 border-zinc-600"
                />
                Skip certificate verification (insecure)
              </label>
            )}
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">
              Timeout (ms)
            </label>
            <input
              type="number"
              value={config?.timeout || 30000}
              onChange={(e) =>
                onChange({
                  ...createDefaultGrpcConfig(),
                  ...config,
                  timeout: parseInt(e.target.value) || 30000,
                })
              }
              className="w-32 bg-zinc-800 border border-zinc-600 rounded px-3 py-1.5 text-sm"
            />
          </div>
        </div>
      )}

      {/* Proto Schema Manager Modal */}
      <ProtoSchemaManager
        isOpen={showProtoManager}
        onClose={() => setShowProtoManager(false)}
        onSchemaSelect={handleSchemaSelect}
      />
    </div>
  );
}

