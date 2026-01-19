/**
 * Replaces {{variable}} tokens in a string with values from the variables object.
 * If a variable is not found, the token is left as-is.
 * Supports variable names with letters, numbers, underscores, hyphens, and dots.
 */
export function interpolate(
  text: string | null | undefined,
  variables: Record<string, string> | null | undefined
): string {
  // Handle null/undefined inputs
  if (!text) return text ?? "";
  if (!variables || Object.keys(variables).length === 0) return text;

  // Match {{variableName}} where variableName can contain word chars, hyphens, and dots
  // Also handle optional whitespace inside braces: {{ variable }}
  return text.replace(/\{\{\s*([\w.\-]+)\s*\}\}/g, (match, key) => {
    return key in variables ? variables[key] : match;
  });
}
