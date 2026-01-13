import { LLMProvider } from "@/lib/db";
import { ScriptGenerationRequest, ScriptGenerationResult } from "../types";
import { LLMAdapter, parseScriptResponse, buildChatMessages } from "./base";
import { buildUserPrompt } from "../systemPrompt";

export class OpenAIAdapter implements LLMAdapter {
  name = "OpenAI";
  type = "openai" as const;

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
        provider: "openai",
        apiKey: provider.apiKey,
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
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "openai",
          apiKey: provider.apiKey,
          model: provider.model,
          baseUrl: provider.baseUrl,
          messages: [
            { role: "system", content: "You are a helpful assistant." },
            { role: "user", content: "Say 'OK' if you can read this." },
          ],
          maxTokens: 10,
          temperature: 0,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.error || "Connection failed" };
      }

      const data = await response.json();

      if (data.error) {
        return { success: false, error: data.error };
      }

      return { success: true, model: provider.model };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Connection failed",
      };
    }
  }
}

export const openaiAdapter = new OpenAIAdapter();
