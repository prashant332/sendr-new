import { NextRequest, NextResponse } from "next/server";

interface OpenAIMessage {
  role: string;
  content: string;
}

interface GeminiContent {
  role: string;
  parts: Array<{ text: string }>;
}

interface RequestBody {
  provider: "openai" | "gemini" | "anthropic" | "ollama" | "custom";
  apiKey: string;
  model: string;
  baseUrl: string;
  messages?: OpenAIMessage[];
  contents?: GeminiContent[];
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const {
      provider,
      apiKey,
      model,
      baseUrl,
      messages,
      contents,
      systemPrompt,
      maxTokens = 1500,
      temperature = 0.2,
    } = body;

    if (!apiKey) {
      return NextResponse.json({ error: "API key is required" }, { status: 400 });
    }

    let response: Response;
    let content: string;

    switch (provider) {
      case "openai": {
        if (!messages) {
          return NextResponse.json({ error: "Messages are required for OpenAI" }, { status: 400 });
        }

        response = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages,
            max_tokens: maxTokens,
            temperature,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = errorData.error?.message || `OpenAI API error: ${response.status}`;
          return NextResponse.json({ error: errorMessage }, { status: response.status });
        }

        const openaiData = await response.json();
        content = openaiData.choices?.[0]?.message?.content || "";
        break;
      }

      case "gemini": {
        if (!contents) {
          return NextResponse.json({ error: "Contents are required for Gemini" }, { status: 400 });
        }

        // Gemini API URL format: https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
        const geminiUrl = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;

        const geminiBody: {
          contents: GeminiContent[];
          generationConfig: { maxOutputTokens: number; temperature: number };
          systemInstruction?: { parts: Array<{ text: string }> };
        } = {
          contents,
          generationConfig: {
            maxOutputTokens: maxTokens,
            temperature,
          },
        };

        // Add system instruction if provided
        if (systemPrompt) {
          geminiBody.systemInstruction = {
            parts: [{ text: systemPrompt }],
          };
        }

        response = await fetch(geminiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(geminiBody),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage =
            errorData.error?.message || `Gemini API error: ${response.status}`;
          return NextResponse.json({ error: errorMessage }, { status: response.status });
        }

        const geminiData = await response.json();
        content = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
        break;
      }

      case "anthropic": {
        if (!messages) {
          return NextResponse.json({ error: "Messages are required for Anthropic" }, { status: 400 });
        }

        // Extract system message and convert to Anthropic format
        const systemMessage = messages.find((m) => m.role === "system")?.content || "";
        const anthropicMessages = messages
          .filter((m) => m.role !== "system")
          .map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }));

        response = await fetch(`${baseUrl}/messages`, {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            system: systemMessage,
            messages: anthropicMessages,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage =
            errorData.error?.message || `Anthropic API error: ${response.status}`;
          return NextResponse.json({ error: errorMessage }, { status: response.status });
        }

        const anthropicData = await response.json();
        content = anthropicData.content?.[0]?.text || "";
        break;
      }

      case "ollama": {
        if (!messages) {
          return NextResponse.json({ error: "Messages are required for Ollama" }, { status: 400 });
        }

        response = await fetch(`${baseUrl}/api/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            stream: false,
            options: {
              temperature,
              num_predict: maxTokens,
            },
          }),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          return NextResponse.json(
            { error: `Ollama API error: ${response.status} - ${errorText}` },
            { status: response.status }
          );
        }

        const ollamaData = await response.json();
        content = ollamaData.message?.content || "";
        break;
      }

      case "custom":
      default: {
        // Assume OpenAI-compatible API for custom providers
        if (!messages) {
          return NextResponse.json({ error: "Messages are required" }, { status: 400 });
        }

        response = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages,
            max_tokens: maxTokens,
            temperature,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = errorData.error?.message || `API error: ${response.status}`;
          return NextResponse.json({ error: errorMessage }, { status: response.status });
        }

        const customData = await response.json();
        content = customData.choices?.[0]?.message?.content || "";
        break;
      }
    }

    return NextResponse.json({ content });
  } catch (error) {
    console.error("AI generate error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate response",
      },
      { status: 500 }
    );
  }
}
