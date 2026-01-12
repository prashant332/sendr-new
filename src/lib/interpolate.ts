/**
 * Replaces {{variable}} tokens in a string with values from the variables object.
 * If a variable is not found, the token is left as-is.
 */
export function interpolate(
  text: string,
  variables: Record<string, string>
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return key in variables ? variables[key] : match;
  });
}
