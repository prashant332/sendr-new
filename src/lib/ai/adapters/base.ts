import { LLMProvider, AIProviderType } from "@/lib/db";
import { ScriptGenerationRequest, ScriptGenerationResult } from "../types";

export interface LLMAdapter {
  name: string;
  type: AIProviderType;

  generateScript(
    request: ScriptGenerationRequest,
    provider: LLMProvider,
    systemPrompt: string
  ): Promise<ScriptGenerationResult>;

  testConnection(provider: LLMProvider): Promise<{ success: boolean; error?: string; model?: string }>;
}

// Helper to parse the generated script from LLM response
export function parseScriptResponse(content: string): ScriptGenerationResult {
  // Extract code block
  const codeBlockMatch = content.match(/```(?:javascript|js)?\s*([\s\S]*?)```/);

  let script = "";
  let explanation = "";

  if (codeBlockMatch) {
    script = codeBlockMatch[1].trim();
    // Get text after the code block as explanation
    const afterCodeBlock = content.substring(content.lastIndexOf("```") + 3).trim();
    explanation = afterCodeBlock || "Script generated successfully.";
  } else {
    // Try to extract any code-like content
    const lines = content.split("\n");
    const codeLines: string[] = [];
    const explanationLines: string[] = [];
    let inCode = false;

    for (const line of lines) {
      // Heuristic: lines starting with common JS patterns are code
      if (
        line.trim().startsWith("const ") ||
        line.trim().startsWith("let ") ||
        line.trim().startsWith("var ") ||
        line.trim().startsWith("pm.") ||
        line.trim().startsWith("//") ||
        line.trim().startsWith("if ") ||
        line.trim().startsWith("for ") ||
        line.trim().startsWith("}") ||
        line.trim().startsWith("{") ||
        inCode
      ) {
        codeLines.push(line);
        inCode = line.trim().endsWith("{") || (inCode && !line.trim().startsWith("}"));
      } else if (line.trim()) {
        explanationLines.push(line);
      }
    }

    script = codeLines.join("\n").trim();
    explanation = explanationLines.join(" ").trim() || "Script generated successfully.";
  }

  return {
    script,
    explanation,
  };
}

// Build messages array for chat-based APIs
export function buildChatMessages(
  systemPrompt: string,
  userPrompt: string,
  conversationHistory?: Array<{ role: string; content: string }>
): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = [];

  // Add system prompt
  messages.push({
    role: "system",
    content: systemPrompt,
  });

  // Add conversation history if any
  if (conversationHistory && conversationHistory.length > 0) {
    messages.push(...conversationHistory);
  }

  // Add the current user prompt
  messages.push({
    role: "user",
    content: userPrompt,
  });

  return messages;
}
