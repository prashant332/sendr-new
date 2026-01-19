import type { Monaco } from "@monaco-editor/react";
import type { editor, languages, Position, CancellationToken } from "monaco-editor";

export interface VariableInfo {
  name: string;
  value: string;
}

export type GetVariablesFunction = () => VariableInfo[];

/**
 * Creates a completion provider for {{variable}} syntax
 */
export function createVariableCompletionProvider(
  monaco: Monaco,
  getVariables: GetVariablesFunction
): languages.CompletionItemProvider {
  return {
    triggerCharacters: ["{"],

    provideCompletionItems(
      model: editor.ITextModel,
      position: Position,
      _context: languages.CompletionContext,
      _token: CancellationToken
    ): languages.ProviderResult<languages.CompletionList> {
      const textUntilPosition = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      // Check if we're inside or just after {{
      const match = textUntilPosition.match(/\{\{([\w.\-]*)$/);
      if (!match) {
        return { suggestions: [] };
      }

      const searchQuery = match[1] || "";
      const startColumn = position.column - searchQuery.length;

      // Check if there's a closing }} after the cursor
      const lineContent = model.getLineContent(position.lineNumber);
      const textAfterCursor = lineContent.slice(position.column - 1);
      const hasClosingBraces = textAfterCursor.startsWith("}}");

      const variables = getVariables();
      const filteredVariables = searchQuery
        ? variables.filter((v) =>
            v.name.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : variables;

      const suggestions: languages.CompletionItem[] = filteredVariables.map(
        (variable) => ({
          label: variable.name,
          kind: monaco.languages.CompletionItemKind.Variable,
          detail: variable.value
            ? variable.value.length > 50
              ? variable.value.slice(0, 50) + "..."
              : variable.value
            : "(empty)",
          documentation: {
            value: `**Variable:** \`{{${variable.name}}}\`\n\n**Value:** ${
              variable.value || "(empty)"
            }`,
          },
          insertText: hasClosingBraces ? variable.name : `${variable.name}}}`,
          range: {
            startLineNumber: position.lineNumber,
            startColumn: startColumn,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          },
          sortText: variable.name.toLowerCase().startsWith(searchQuery.toLowerCase())
            ? `0${variable.name}`
            : `1${variable.name}`,
        })
      );

      return {
        suggestions,
        incomplete: false,
      };
    },
  };
}

/**
 * Register the completion provider for multiple languages
 */
export function registerVariableCompletionProvider(
  monaco: Monaco,
  getVariables: GetVariablesFunction,
  languages: string[] = ["json", "xml", "javascript", "typescript", "plaintext"]
): void {
  const provider = createVariableCompletionProvider(monaco, getVariables);

  languages.forEach((language) => {
    monaco.languages.registerCompletionItemProvider(language, provider);
  });
}
