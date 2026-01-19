import { useMemo } from "react";

export interface VariableMatch {
  name: string;
  start: number; // Start index of {{
  end: number; // End index after }}
  fullMatch: string; // The full {{variable}} string
}

export interface AutocompleteContext {
  isActive: boolean; // Should autocomplete be shown
  searchQuery: string; // Text after {{ for filtering
  replaceStart: number; // Start position for replacement (position of {{)
  replaceEnd: number; // End position for replacement (current cursor or }})
}

// Regex to match {{variable}} patterns
// Supports: letters, numbers, underscores, hyphens, dots
// Also handles partial matches like {{partial
const VARIABLE_PATTERN = /\{\{([\w.\-]*)\}\}/g;
const PARTIAL_VARIABLE_PATTERN = /\{\{([\w.\-]*)$/;

/**
 * Find all complete {{variable}} matches in text
 */
export function findAllVariables(text: string): VariableMatch[] {
  const matches: VariableMatch[] = [];
  const regex = new RegExp(VARIABLE_PATTERN.source, "g");
  let match;

  while ((match = regex.exec(text)) !== null) {
    matches.push({
      name: match[1],
      start: match.index,
      end: match.index + match[0].length,
      fullMatch: match[0],
    });
  }

  return matches;
}

/**
 * Find variable at a specific cursor position
 */
export function findVariableAtPosition(
  text: string,
  cursorPosition: number
): VariableMatch | null {
  const matches = findAllVariables(text);
  return matches.find(
    (match) => cursorPosition >= match.start && cursorPosition <= match.end
  ) ?? null;
}

/**
 * Determine autocomplete context based on text and cursor position
 */
export function getAutocompleteContext(
  text: string,
  cursorPosition: number
): AutocompleteContext {
  // Get text up to cursor
  const textBeforeCursor = text.slice(0, cursorPosition);

  // Check if we're in the middle of typing a variable (after {{ but before }})
  const partialMatch = textBeforeCursor.match(PARTIAL_VARIABLE_PATTERN);

  if (partialMatch) {
    const searchQuery = partialMatch[1] || "";
    const replaceStart = textBeforeCursor.lastIndexOf("{{");

    // Check if there's a closing }} after cursor
    const textAfterCursor = text.slice(cursorPosition);
    const closingBraces = textAfterCursor.indexOf("}}");

    // Determine end position
    let replaceEnd = cursorPosition;
    if (closingBraces === 0) {
      // Cursor is right before }}
      replaceEnd = cursorPosition + 2;
    } else if (closingBraces > 0) {
      // Check if there's only variable chars between cursor and }}
      const betweenText = textAfterCursor.slice(0, closingBraces);
      if (/^[\w.\-]*$/.test(betweenText)) {
        replaceEnd = cursorPosition + closingBraces + 2;
      }
    }

    return {
      isActive: true,
      searchQuery,
      replaceStart,
      replaceEnd,
    };
  }

  return {
    isActive: false,
    searchQuery: "",
    replaceStart: cursorPosition,
    replaceEnd: cursorPosition,
  };
}

/**
 * Hook to detect variables and autocomplete context in text
 */
export function useVariableDetection(text: string, cursorPosition: number) {
  const variables = useMemo(() => findAllVariables(text), [text]);

  const autocompleteContext = useMemo(
    () => getAutocompleteContext(text, cursorPosition),
    [text, cursorPosition]
  );

  const variableAtCursor = useMemo(
    () => findVariableAtPosition(text, cursorPosition),
    [text, cursorPosition]
  );

  return {
    variables,
    autocompleteContext,
    variableAtCursor,
  };
}

/**
 * Insert a variable name at the autocomplete position
 */
export function insertVariable(
  text: string,
  variableName: string,
  context: AutocompleteContext
): { newText: string; newCursorPosition: number } {
  const before = text.slice(0, context.replaceStart);
  const after = text.slice(context.replaceEnd);
  const insertion = `{{${variableName}}}`;

  return {
    newText: before + insertion + after,
    newCursorPosition: before.length + insertion.length,
  };
}
