// Re-export types from db.ts
export type { AIProviderType, LLMProvider, AISettings } from "@/lib/db";

// Script Generation
export type ScriptType = "pre-request" | "test";

export interface ScriptGenerationRequest {
  prompt: string;
  scriptType: ScriptType;
  context: ScriptContext;
  conversationHistory?: ConversationMessage[];
}

export interface ScriptContext {
  responseSchema?: JSONSchema;
  responseSample?: unknown;
  environmentVariables: string[];
  existingScript?: string;
  requestDetails: {
    method: string;
    url: string;
    isGrpc: boolean;
  };
}

export interface JSONSchema {
  type: string;
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
}

export interface ScriptGenerationResult {
  script: string;
  explanation: string;
  warnings?: string[];
  suggestions?: string[];
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

// Validation
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Quick Actions
export interface QuickAction {
  id: string;
  label: string;
  prompt: string;
  icon: string;
  scriptType: ScriptType;
}

// LLM Adapter Interface
import type { LLMProvider as LLMProviderType, AIProviderType as AIProviderTypeAlias } from "@/lib/db";

export interface LLMAdapter {
  name: string;
  type: AIProviderTypeAlias;
  generateScript(
    request: ScriptGenerationRequest,
    provider: LLMProviderType,
    systemPrompt: string
  ): Promise<ScriptGenerationResult>;
  testConnection(provider: LLMProviderType): Promise<{ success: boolean; error?: string; model?: string }>;
}

// API Route Types
export interface AIGenerateRequest {
  provider: AIProviderTypeAlias;
  apiKey: string;
  model: string;
  baseUrl: string;
  messages: Array<{ role: string; content: string }>;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIGenerateResponse {
  content: string;
  error?: string;
}

// Default provider configurations
export const DEFAULT_PROVIDERS: Record<AIProviderTypeAlias, Partial<LLMProviderType>> = {
  openai: {
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4-turbo",
  },
  gemini: {
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-2.0-flash",
  },
  anthropic: {
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    model: "claude-3-opus-20240229",
  },
  ollama: {
    name: "Ollama (Local)",
    baseUrl: "http://localhost:11434",
    model: "llama3:8b",
  },
  custom: {
    name: "Custom API",
    baseUrl: "",
    model: "",
  },
};

// Available models per provider
export const PROVIDER_MODELS: Record<AIProviderTypeAlias, string[]> = {
  openai: ["gpt-4-turbo", "gpt-4", "gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"],
  gemini: ["gemini-2.0-flash", "gemini-1.5-pro-latest", "gemini-1.5-flash-latest", "gemini-pro"],
  anthropic: ["claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307"],
  ollama: ["llama3:8b", "llama3:70b", "codellama:7b", "mistral:7b"],
  custom: [],
};
