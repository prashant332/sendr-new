"use client";

import { useCallback, useRef, useState } from "react";
import Editor, { type Monaco, type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { KeyValueEditor, KeyValuePair } from "@/components/KeyValueEditor";
import { CreateVariableModal } from "@/components/CreateVariableModal";
import { BodyMode, RequestBody } from "@/lib/db";
import { useEnvironmentStore } from "@/store/environmentStore";
import { setupMonacoVariableSupport } from "@/lib/monaco";

interface BodyEditorProps {
  body: RequestBody;
  onChange: (body: RequestBody) => void;
}

const BODY_MODES: { value: BodyMode; label: string }[] = [
  { value: "none", label: "None" },
  { value: "json", label: "JSON" },
  { value: "xml", label: "XML" },
  { value: "form-data", label: "Form Data" },
  { value: "x-www-form-urlencoded", label: "x-www-form-urlencoded" },
  { value: "raw", label: "Raw" },
];

export function BodyEditor({ body, onChange }: BodyEditorProps) {
  const cleanupRef = useRef<(() => void) | null>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [showCreateVariableModal, setShowCreateVariableModal] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [selectionRange, setSelectionRange] = useState<{
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  } | null>(null);

  const getActiveVariables = useEnvironmentStore((state) => state.getActiveVariables);
  const activeEnvironmentId = useEnvironmentStore((state) => state.activeEnvironmentId);

  const handleModeChange = (mode: BodyMode) => {
    onChange({ ...body, mode });
  };

  const handleRawChange = (value: string | undefined) => {
    onChange({ ...body, raw: value || "" });
  };

  const handleFormDataChange = (formData: KeyValuePair[]) => {
    onChange({ ...body, formData });
  };

  const getEditorLanguage = () => {
    switch (body.mode) {
      case "json":
        return "json";
      case "xml":
        return "xml";
      default:
        return "plaintext";
    }
  };

  // Get variables for Monaco providers
  const getVariables = useCallback(() => {
    const vars = getActiveVariables();
    return Object.entries(vars).map(([name, value]) => ({ name, value }));
  }, [getActiveVariables]);

  const isVariableDefined = useCallback(
    (name: string) => {
      const vars = getActiveVariables();
      return name in vars;
    },
    [getActiveVariables]
  );

  // Handle variable created - replace selection if needed
  const handleVariableCreated = useCallback(
    (variableName: string, replaceSelection: boolean) => {
      if (replaceSelection && editorRef.current && selectionRange) {
        const replacement = `{{${variableName}}}`;
        editorRef.current.executeEdits("create-variable", [
          {
            range: selectionRange,
            text: replacement,
            forceMoveMarkers: true,
          },
        ]);
        // Update the body state with the new value
        const newValue = editorRef.current.getValue();
        onChange({ ...body, raw: newValue });
      }
      setShowCreateVariableModal(false);
      setSelectedText("");
      setSelectionRange(null);
    },
    [selectionRange, onChange, body]
  );

  // Handle Monaco editor mount
  const handleEditorMount: OnMount = useCallback(
    (editorInstance: editor.IStandaloneCodeEditor, monaco: Monaco) => {
      // Store editor reference
      editorRef.current = editorInstance;

      // Clean up previous instance if any
      if (cleanupRef.current) {
        cleanupRef.current();
      }

      // Setup variable support
      cleanupRef.current = setupMonacoVariableSupport(
        monaco,
        editorInstance,
        getVariables,
        isVariableDefined
      );

      // Add context menu action for creating variables
      editorInstance.addAction({
        id: "create-variable-from-selection",
        label: "Create Variable from Selection",
        keybindings: [
          monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyV,
        ],
        contextMenuGroupId: "1_modification",
        contextMenuOrder: 1.5,
        precondition: "editorHasSelection",
        run: () => {
          const selection = editorInstance.getSelection();
          if (!selection || selection.isEmpty()) return;

          const model = editorInstance.getModel();
          if (!model) return;

          const text = model.getValueInRange(selection);
          if (!text.trim()) return;

          setSelectedText(text);
          setSelectionRange({
            startLineNumber: selection.startLineNumber,
            startColumn: selection.startColumn,
            endLineNumber: selection.endLineNumber,
            endColumn: selection.endColumn,
          });
          setShowCreateVariableModal(true);
        },
      });
    },
    [getVariables, isVariableDefined]
  );

  return (
    <div className="space-y-3">
      {/* Mode Selector */}
      <div className="flex items-center gap-2">
        {BODY_MODES.map((mode) => (
          <button
            key={mode.value}
            onClick={() => handleModeChange(mode.value)}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              body.mode === mode.value
                ? "bg-blue-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {/* Body Content */}
      {body.mode === "none" && (
        <div className="text-zinc-500 text-sm py-4 text-center">
          This request does not have a body
        </div>
      )}

      {(body.mode === "json" || body.mode === "xml" || body.mode === "raw") && (
        <div className="min-h-[200px] h-[40vh] max-h-[500px] border border-zinc-700 rounded overflow-hidden">
          <Editor
            key={`body-editor-${activeEnvironmentId}`}
            height="100%"
            language={getEditorLanguage()}
            theme="vs-dark"
            value={body.raw}
            onChange={handleRawChange}
            onMount={handleEditorMount}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              wordWrap: "on",
              quickSuggestions: {
                strings: true,
                comments: true,
                other: true,
              },
            }}
          />
        </div>
      )}

      {(body.mode === "form-data" || body.mode === "x-www-form-urlencoded") && (
        <div>
          <KeyValueEditor
            pairs={body.formData}
            onChange={handleFormDataChange}
            keyPlaceholder="Key"
            valuePlaceholder="Value"
          />
          <div className="text-xs text-zinc-500 mt-2">
            {body.mode === "form-data"
              ? "Data will be sent as multipart/form-data"
              : "Data will be sent as application/x-www-form-urlencoded"}
          </div>
        </div>
      )}

      {/* Create Variable Modal */}
      <CreateVariableModal
        isOpen={showCreateVariableModal}
        onClose={() => {
          setShowCreateVariableModal(false);
          setSelectedText("");
          setSelectionRange(null);
        }}
        selectedValue={selectedText}
        onVariableCreated={handleVariableCreated}
      />
    </div>
  );
}

// Helper to create a default body
export function createDefaultBody(): RequestBody {
  return {
    mode: "none",
    raw: "{\n  \n}",
    formData: [{ key: "", value: "", active: true }],
  };
}

// Helper to get content type for body mode
export function getContentTypeForBody(body: RequestBody): string | null {
  switch (body.mode) {
    case "json":
      return "application/json";
    case "xml":
      return "application/xml";
    case "form-data":
      return "multipart/form-data";
    case "x-www-form-urlencoded":
      return "application/x-www-form-urlencoded";
    case "raw":
      return "text/plain";
    default:
      return null;
  }
}
