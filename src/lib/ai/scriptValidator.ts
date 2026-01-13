import { ScriptType, ValidationResult } from "./types";

interface DangerousPattern {
  pattern: RegExp;
  message: string;
}

const DANGEROUS_PATTERNS: DangerousPattern[] = [
  { pattern: /\beval\s*\(/, message: "eval() is not allowed for security reasons" },
  { pattern: /\bFunction\s*\(/, message: "Function constructor is not allowed" },
  { pattern: /\bfetch\s*\(/, message: "fetch() is not available in scripts. Use pre-request variables instead." },
  { pattern: /\brequire\s*\(/, message: "require() is not available in the script sandbox" },
  { pattern: /\bimport\s+/, message: "ES imports are not available in the script sandbox" },
  { pattern: /\bprocess\./, message: "process is not available in the script sandbox" },
  { pattern: /\bwindow\./, message: "window is not available in the script sandbox" },
  { pattern: /\bdocument\./, message: "document is not available in the script sandbox" },
  { pattern: /\bglobal\./, message: "global is not available in the script sandbox" },
  { pattern: /\bglobalThis\./, message: "globalThis is not available in the script sandbox" },
  { pattern: /\bsetTimeout\s*\(/, message: "setTimeout is not available in the script sandbox" },
  { pattern: /\bsetInterval\s*\(/, message: "setInterval is not available in the script sandbox" },
  { pattern: /\bXMLHttpRequest/, message: "XMLHttpRequest is not available in the script sandbox" },
  { pattern: /\bWebSocket\s*\(/, message: "WebSocket is not available in the script sandbox" },
];

/**
 * Validate generated script for syntax errors and security issues
 */
export function validateScript(
  script: string,
  scriptType: ScriptType
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Skip validation if script is empty
  if (!script || !script.trim()) {
    return { valid: true, errors: [], warnings: [] };
  }

  // 1. Syntax validation
  try {
    // Use Function constructor to check syntax without executing
    new Function(script);
  } catch (e) {
    const error = e as Error;
    errors.push(`Syntax error: ${error.message}`);
  }

  // 2. Security checks
  for (const { pattern, message } of DANGEROUS_PATTERNS) {
    if (pattern.test(script)) {
      errors.push(message);
    }
  }

  // 3. Script type specific validation
  if (scriptType === "pre-request") {
    if (/pm\.response/.test(script)) {
      errors.push("pm.response is not available in pre-request scripts (response hasn't been received yet)");
    }
    if (/pm\.test\s*\(/.test(script)) {
      warnings.push("pm.test() is typically used in test scripts, not pre-request scripts");
    }
    if (/pm\.expect\s*\(/.test(script)) {
      warnings.push("pm.expect() is typically used in test scripts, not pre-request scripts");
    }
  }

  // 4. Best practice warnings
  if (/\bvar\s+/.test(script)) {
    warnings.push("Consider using 'const' or 'let' instead of 'var' for better scoping");
  }

  if (/console\.log\s*\(/.test(script)) {
    warnings.push("console.log output won't be visible in the UI. Consider using pm.test() for validation.");
  }

  if (/console\.(warn|error|info|debug)\s*\(/.test(script)) {
    warnings.push("Console methods output won't be visible. Consider using pm.test() instead.");
  }

  // 5. Check for common mistakes
  if (scriptType === "test" && !/pm\.(test|expect)/.test(script) && !/pm\.environment\.set/.test(script)) {
    warnings.push(
      "This test script doesn't appear to have any assertions (pm.test/pm.expect) or side effects (pm.environment.set). Consider adding some."
    );
  }

  // Check for JSON.parse without try-catch on pm.response.json()
  if (/JSON\.parse\s*\(\s*pm\.response/.test(script)) {
    warnings.push("Use pm.response.json() directly instead of JSON.parse(pm.response.text())");
  }

  // Check for direct response access without null checks on arrays
  const arrayAccessPattern = /\.filter\s*\(|\.map\s*\(|\.forEach\s*\(|\.find\s*\(|\.some\s*\(|\.every\s*\(/;
  if (arrayAccessPattern.test(script) && !/Array\.isArray/.test(script) && !/\.length/.test(script)) {
    warnings.push(
      "Consider adding null/undefined checks before array operations to handle edge cases"
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Format validation result as a readable message
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];

  if (result.errors.length > 0) {
    lines.push("Errors:");
    result.errors.forEach((e) => lines.push(`  - ${e}`));
  }

  if (result.warnings.length > 0) {
    lines.push("Warnings:");
    result.warnings.forEach((w) => lines.push(`  - ${w}`));
  }

  if (result.valid && result.warnings.length === 0) {
    return "Script validation passed.";
  }

  return lines.join("\n");
}
