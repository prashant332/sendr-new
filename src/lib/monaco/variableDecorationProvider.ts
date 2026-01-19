import type { editor } from "monaco-editor";

export type IsVariableDefinedFunction = (name: string) => boolean;

// Regex to match {{variable}} patterns
const VARIABLE_PATTERN = /\{\{([\w.\-]+)\}\}/g;

/**
 * Decoration types for variables
 */
export const DECORATION_CLASSES = {
  definedVariable: "variable-decoration-defined",
  undefinedVariable: "variable-decoration-undefined",
};

/**
 * CSS styles for variable decorations
 * These should be injected into the page
 */
export const DECORATION_STYLES = `
  .variable-decoration-defined {
    color: #4fc3f7 !important;
    font-weight: 500;
  }
  .variable-decoration-undefined {
    color: #ffb74d !important;
    text-decoration: wavy underline #ff9800;
    font-weight: 500;
  }
`;

export interface VariableDecoration {
  range: {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  };
  options: editor.IModelDecorationOptions;
}

/**
 * Find all variables in the editor and create decorations
 */
export function getVariableDecorations(
  model: editor.ITextModel,
  isVariableDefined: IsVariableDefinedFunction
): VariableDecoration[] {
  const decorations: VariableDecoration[] = [];
  const lineCount = model.getLineCount();

  for (let lineNumber = 1; lineNumber <= lineCount; lineNumber++) {
    const lineContent = model.getLineContent(lineNumber);
    const regex = new RegExp(VARIABLE_PATTERN.source, "g");
    let match: RegExpExecArray | null;

    while ((match = regex.exec(lineContent)) !== null) {
      const variableName = match[1];
      const isDefined = isVariableDefined(variableName);
      const startColumn = match.index + 1; // 1-based
      const endColumn = startColumn + match[0].length;

      decorations.push({
        range: {
          startLineNumber: lineNumber,
          startColumn,
          endLineNumber: lineNumber,
          endColumn,
        },
        options: {
          inlineClassName: isDefined
            ? DECORATION_CLASSES.definedVariable
            : DECORATION_CLASSES.undefinedVariable,
          hoverMessage: isDefined
            ? undefined
            : { value: `⚠️ Variable \`${variableName}\` is not defined` },
        },
      });
    }
  }

  return decorations;
}

/**
 * Apply variable decorations to an editor instance
 * Returns a function to clear the decorations
 */
export function applyVariableDecorations(
  editor: editor.IStandaloneCodeEditor,
  isVariableDefined: IsVariableDefinedFunction
): string[] {
  const model = editor.getModel();
  if (!model) return [];

  const decorations = getVariableDecorations(model, isVariableDefined);

  return editor.deltaDecorations(
    [],
    decorations.map((d) => ({
      range: d.range,
      options: d.options,
    }))
  );
}

/**
 * Update decorations when content changes
 */
export function createDecorationUpdater(
  editor: editor.IStandaloneCodeEditor,
  isVariableDefined: IsVariableDefinedFunction
): {
  update: () => void;
  dispose: () => void;
} {
  let currentDecorations: string[] = [];
  let updateTimeout: NodeJS.Timeout | null = null;

  const update = () => {
    // Debounce updates
    if (updateTimeout) {
      clearTimeout(updateTimeout);
    }

    updateTimeout = setTimeout(() => {
      const model = editor.getModel();
      if (!model) return;

      const decorations = getVariableDecorations(model, isVariableDefined);
      currentDecorations = editor.deltaDecorations(
        currentDecorations,
        decorations.map((d) => ({
          range: d.range,
          options: d.options,
        }))
      );
    }, 100);
  };

  const dispose = () => {
    if (updateTimeout) {
      clearTimeout(updateTimeout);
    }
    if (currentDecorations.length > 0) {
      editor.deltaDecorations(currentDecorations, []);
    }
  };

  return { update, dispose };
}

/**
 * Inject decoration styles into the document
 */
export function injectDecorationStyles(): void {
  const styleId = "monaco-variable-decorations";

  // Check if styles already exist
  if (document.getElementById(styleId)) {
    return;
  }

  const styleElement = document.createElement("style");
  styleElement.id = styleId;
  styleElement.textContent = DECORATION_STYLES;
  document.head.appendChild(styleElement);
}
