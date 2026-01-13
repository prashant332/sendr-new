import { AIProviderType } from "@/lib/db";
import { LLMAdapter } from "./base";
import { openaiAdapter } from "./openai";
import { geminiAdapter } from "./gemini";

const adapters: Record<string, LLMAdapter> = {
  openai: openaiAdapter,
  gemini: geminiAdapter,
};

export function getAdapter(type: AIProviderType): LLMAdapter | null {
  return adapters[type] || null;
}

export { openaiAdapter, geminiAdapter };
export type { LLMAdapter };
