import type { Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import {
  registerVariableCompletionProvider,
  type VariableInfo,
  type GetVariablesFunction,
} from "./variableCompletionProvider";
import {
  registerVariableHoverProvider,
  type IsVariableDefinedFunction,
} from "./variableHoverProvider";
import {
  createDecorationUpdater,
  injectDecorationStyles,
} from "./variableDecorationProvider";

export type { VariableInfo, GetVariablesFunction, IsVariableDefinedFunction };

export {
  registerVariableCompletionProvider,
  registerVariableHoverProvider,
  createDecorationUpdater,
  injectDecorationStyles,
};

// Track if providers have been registered (they should only be registered once)
let providersRegistered = false;

/**
 * Register all variable-related Monaco providers
 * This should be called once when Monaco is first loaded
 */
export function registerVariableProviders(
  monaco: Monaco,
  getVariables: GetVariablesFunction,
  isVariableDefined: IsVariableDefinedFunction,
  languages: string[] = ["json", "xml", "javascript", "typescript", "plaintext"]
): void {
  if (providersRegistered) {
    return;
  }

  // Inject CSS styles for decorations
  injectDecorationStyles();

  // Register completion provider
  registerVariableCompletionProvider(monaco, getVariables, languages);

  // Register hover provider
  registerVariableHoverProvider(monaco, getVariables, isVariableDefined, languages);

  providersRegistered = true;
}

/**
 * Setup decorations for a specific editor instance
 * Returns cleanup function
 */
export function setupEditorDecorations(
  editorInstance: editor.IStandaloneCodeEditor,
  isVariableDefined: IsVariableDefinedFunction
): () => void {
  const { update, dispose } = createDecorationUpdater(editorInstance, isVariableDefined);

  // Initial update
  update();

  // Listen for content changes
  const disposable = editorInstance.onDidChangeModelContent(() => {
    update();
  });

  // Return cleanup function
  return () => {
    disposable.dispose();
    dispose();
  };
}

/**
 * Hook-friendly setup for Monaco editor with variable support
 * Use this in the onMount callback of the Editor component
 */
export function setupMonacoVariableSupport(
  monaco: Monaco,
  editorInstance: editor.IStandaloneCodeEditor,
  getVariables: GetVariablesFunction,
  isVariableDefined: IsVariableDefinedFunction
): () => void {
  // Register global providers (only once)
  registerVariableProviders(monaco, getVariables, isVariableDefined);

  // Setup decorations for this editor instance
  const cleanupDecorations = setupEditorDecorations(editorInstance, isVariableDefined);

  return cleanupDecorations;
}
