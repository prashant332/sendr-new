import type { Monaco } from "@monaco-editor/react";
import type { editor, languages, Position, CancellationToken, IMarkdownString } from "monaco-editor";

export interface VariableInfo {
  name: string;
  value: string;
}

export type GetVariablesFunction = () => VariableInfo[];
export type IsVariableDefinedFunction = (name: string) => boolean;

// Regex to match {{variable}} patterns
const VARIABLE_PATTERN = /\{\{([\w.\-]+)\}\}/g;

/**
 * Creates a hover provider for {{variable}} syntax
 */
export function createVariableHoverProvider(
  monaco: Monaco,
  getVariables: GetVariablesFunction,
  isVariableDefined: IsVariableDefinedFunction
): languages.HoverProvider {
  return {
    provideHover(
      model: editor.ITextModel,
      position: Position,
      _token: CancellationToken
    ): languages.ProviderResult<languages.Hover> {
      const line = model.getLineContent(position.lineNumber);
      const column = position.column;

      // Find all variables in the line and check if cursor is on one
      let match: RegExpExecArray | null;
      const regex = new RegExp(VARIABLE_PATTERN.source, "g");

      while ((match = regex.exec(line)) !== null) {
        const start = match.index + 1; // +1 for 1-based column
        const end = start + match[0].length;

        if (column >= start && column <= end) {
          const variableName = match[1];
          const isDefined = isVariableDefined(variableName);
          const variables = getVariables();
          const variable = variables.find((v) => v.name === variableName);

          let contents: IMarkdownString[];

          if (isDefined && variable) {
            const displayValue =
              variable.value.length > 200
                ? variable.value.slice(0, 200) + "..."
                : variable.value || "(empty string)";

            contents = [
              {
                value: `**Variable:** \`{{${variableName}}}\``,
              },
              {
                value: `**Value:**\n\`\`\`\n${displayValue}\n\`\`\``,
              },
            ];
          } else {
            contents = [
              {
                value: `**Variable:** \`{{${variableName}}}\``,
              },
              {
                value: `**Status:** ⚠️ *Undefined*\n\nThis variable is not defined in the current environment.`,
              },
            ];
          }

          return {
            contents,
            range: {
              startLineNumber: position.lineNumber,
              startColumn: start,
              endLineNumber: position.lineNumber,
              endColumn: end,
            },
          };
        }
      }

      return null;
    },
  };
}

/**
 * Register the hover provider for multiple languages
 */
export function registerVariableHoverProvider(
  monaco: Monaco,
  getVariables: GetVariablesFunction,
  isVariableDefined: IsVariableDefinedFunction,
  languages: string[] = ["json", "xml", "javascript", "typescript", "plaintext"]
): void {
  const provider = createVariableHoverProvider(monaco, getVariables, isVariableDefined);

  languages.forEach((language) => {
    monaco.languages.registerHoverProvider(language, provider);
  });
}
