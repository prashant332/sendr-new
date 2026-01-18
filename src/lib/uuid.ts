/**
 * Generate a UUID v4 with fallback for older browsers.
 * Uses crypto.randomUUID() when available, falls back to Math.random() based generation.
 */
export function generateUUID(): string {
  // Use crypto.randomUUID if available (modern browsers: Chrome 92+, Firefox 95+, Safari 15.4+)
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
