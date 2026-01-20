/**
 * Replaces {{variable}} tokens in a string with values from the variables object.
 * If a variable is not found, the token is left as-is.
 * Supports variable names with letters, numbers, underscores, hyphens, and dots.
 * Supports nested variable interpolation (variables that contain other variables).
 *
 * @param text - The string containing {{variable}} tokens
 * @param variables - Object mapping variable names to their values
 * @param maxDepth - Maximum recursion depth to prevent infinite loops (default: 10)
 */
export function interpolate(
  text: string | null | undefined,
  variables: Record<string, string> | null | undefined,
  maxDepth: number = 10
): string {
  // Handle null/undefined inputs
  if (!text) return text ?? "";
  if (!variables || Object.keys(variables).length === 0) return text;

  const variablePattern = /\{\{\s*([\w.\-]+)\s*\}\}/g;
  // Create a local const to satisfy TypeScript's narrowing
  const vars = variables;

  // Recursive interpolation with depth limit
  function resolveVariables(str: string, depth: number): string {
    if (depth <= 0) return str;

    // Check if there are any variables to replace
    if (!variablePattern.test(str)) return str;

    // Reset regex lastIndex since we're reusing it
    variablePattern.lastIndex = 0;

    let hasChanges = false;
    const result = str.replace(variablePattern, (match, key) => {
      if (key in vars) {
        hasChanges = true;
        return vars[key];
      }
      return match;
    });

    // If changes were made and result still contains variables, recurse
    if (hasChanges && variablePattern.test(result)) {
      variablePattern.lastIndex = 0;
      return resolveVariables(result, depth - 1);
    }

    return result;
  }

  return resolveVariables(text, maxDepth);
}
