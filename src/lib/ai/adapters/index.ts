import { AIProviderType } from "@/lib/db";
import { LLMAdapter } from "./base";
import { openaiAdapter } from "./openai";
import { geminiAdapter } from "./gemini";
import { anthropicAdapter } from "./anthropic";
import { ollamaAdapter } from "./ollama";

const adapters: Record<string, LLMAdapter> = {
  openai: openaiAdapter,
  gemini: geminiAdapter,
  anthropic: anthropicAdapter,
  ollama: ollamaAdapter,
};

export function getAdapter(type: AIProviderType): LLMAdapter | null {
  return adapters[type] || null;
}

export { openaiAdapter, geminiAdapter, anthropicAdapter, ollamaAdapter };
export type { LLMAdapter };
