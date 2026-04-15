import { LLMProvider } from "@/lib/db";
import { ScriptGenerationRequest, ScriptGenerationResult } from "../types";
import { LLMAdapter, parseScriptResponse, buildChatMessages } from "./base";
import { buildUserPrompt } from "../systemPrompt";

export class OllamaAdapter implements LLMAdapter {
  name = "Ollama (Local)";
  type = "ollama" as const;

  async generateScript(
    request: ScriptGenerationRequest,
    provider: LLMProvider,
    systemPrompt: string
  ): Promise<ScriptGenerationResult> {
    const userPrompt = buildUserPrompt(request.prompt, request.scriptType);

    const messages = buildChatMessages(
      systemPrompt,
      userPrompt,
      request.conversationHistory?.map((m) => ({
        role: m.role,
        content: m.content,
      }))
    );

    const response = await fetch("/api/ai/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "ollama",
        model: provider.model,
        baseUrl: provider.baseUrl,
        messages,
        maxTokens: 1500,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to generate script");
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    return parseScriptResponse(data.content);
  }

  async testConnection(
    provider: LLMProvider
  ): Promise<{ success: boolean; error?: string; model?: string }> {
    try {
      // Hit Ollama's /api/tags endpoint directly — it is a lightweight GET that lists
      // installed models without running inference. Ollama enables permissive CORS by
      // default so a browser-side fetch to localhost works without a server proxy.
      const response = await fetch(`${provider.baseUrl}/api/tags`);

      if (!response.ok) {
        return {
          success: false,
          error: `Ollama returned HTTP ${response.status}. Is it running?`,
        };
      }

      const data = await response.json();
      const installedModels: string[] = (data.models || []).map(
        (m: { name: string }) => m.name
      );

      // Match exactly, or by base name (e.g. "llama3" matches "llama3:8b") but
      // require the colon separator to avoid partial-name false positives.
      const baseName = provider.model.includes(":")
        ? provider.model.split(":")[0] + ":"
        : provider.model + ":";
      const modelInstalled = installedModels.some(
        (m) => m === provider.model || m.startsWith(baseName)
      );

      if (!modelInstalled && installedModels.length > 0) {
        return {
          success: true,
          model: `${provider.model} not found locally. Available: ${installedModels.slice(0, 4).join(", ")}`,
        };
      }

      return { success: true, model: provider.model };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? `Cannot reach Ollama at ${provider.baseUrl}: ${error.message}`
            : "Cannot reach Ollama. Is it running?",
      };
    }
  }
}

export const ollamaAdapter = new OllamaAdapter();
