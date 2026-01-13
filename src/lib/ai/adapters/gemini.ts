import { LLMProvider } from "@/lib/db";
import { ScriptGenerationRequest, ScriptGenerationResult } from "../types";
import { LLMAdapter, parseScriptResponse } from "./base";
import { buildUserPrompt } from "../systemPrompt";

export class GeminiAdapter implements LLMAdapter {
  name = "Google Gemini";
  type = "gemini" as const;

  async generateScript(
    request: ScriptGenerationRequest,
    provider: LLMProvider,
    systemPrompt: string
  ): Promise<ScriptGenerationResult> {
    const userPrompt = buildUserPrompt(request.prompt, request.scriptType);

    // Build contents array for Gemini format
    const contents = [];

    // Add conversation history if any
    if (request.conversationHistory && request.conversationHistory.length > 0) {
      for (const msg of request.conversationHistory) {
        contents.push({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }],
        });
      }
    }

    // Add current user message
    contents.push({
      role: "user",
      parts: [{ text: userPrompt }],
    });

    const response = await fetch("/api/ai/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "gemini",
        apiKey: provider.apiKey,
        model: provider.model,
        baseUrl: provider.baseUrl,
        systemPrompt,
        contents,
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
          provider: "gemini",
          apiKey: provider.apiKey,
          model: provider.model,
          baseUrl: provider.baseUrl,
          systemPrompt: "You are a helpful assistant.",
          contents: [
            {
              role: "user",
              parts: [{ text: "Say 'OK' if you can read this." }],
            },
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

export const geminiAdapter = new GeminiAdapter();
