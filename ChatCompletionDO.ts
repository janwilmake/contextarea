import { DurableObject } from "cloudflare:workers";
//@ts-ignore
import providers from "./providers.json";

/**
 * Model configuration
 */
interface ModelConfig {
  providerSlug: string;
  pricePerMillionInput: number;
  pricePerMillionOutput: number;
  model: string;
  basePath: string;
  maxTokens: number;
  premium?: boolean;
}

/**
 * Chat completion request body
 */
interface ChatCompletionRequest {
  model: string;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  stream?: boolean;
  max_tokens?: number;
  temperature?: number;
  [key: string]: any;
}

/**
 * Extended environment interface
 */
interface Env {
  ANTHROPIC_SECRET: string;
  OPENAI_SECRET: string;
  CHAT_COMPLETION_DO: DurableObjectNamespace;
  RESULTS: KVNamespace;
  [key: string]: any;
}

/**
 * Get model configuration by model name
 */
function getModelConfig(modelName: string): ModelConfig | null {
  return providers.find((m: ModelConfig) => m.model === modelName) || null;
}

/**
 * Generate a deterministic request ID based on the provider and request body
 */
function generateRequestId(requestBody: ChatCompletionRequest): string {
  const modelConfig = getModelConfig(requestBody.model);
  if (!modelConfig) {
    throw new Error(`Model ${requestBody.model} not found`);
  }

  const content = JSON.stringify({
    provider: modelConfig.providerSlug,
    model: requestBody.model,
    messages: requestBody.messages,
    max_tokens: requestBody.max_tokens,
    temperature: requestBody.temperature,
  });

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Durable Object for handling chat completions with streaming support
 */
export class ChatCompletionStreamDO extends DurableObject<Env> {
  private state: DurableObjectState;
  public env: Env;
  private activeRequest: Promise<Response> | null = null;
  private streamedChunks: string[] = [];
  private isComplete: boolean = false;
  private finalResult: any = null;
  private sql: any;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.state = state;
    this.env = env;
    this.sql = state.storage.sql;

    // Initialize the storage
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS _kv (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);
  }

  private set(key: string, value: any): void {
    const jsonValue = JSON.stringify(value);
    this.sql.exec(
      `INSERT OR REPLACE INTO _kv (key, value) VALUES (?, ?)`,
      key,
      jsonValue
    );
  }

  private get<T = any>(key: string): T | null {
    const result = this.sql
      .exec(`SELECT value FROM _kv WHERE key = ?`, key)
      .toArray();

    if (result.length === 0) {
      return null;
    }

    try {
      return JSON.parse(result[0].value);
    } catch (e) {
      return result[0].value;
    }
  }

  private async processChatCompletion(
    requestBody: ChatCompletionRequest
  ): Promise<Response> {
    const modelConfig = getModelConfig(requestBody.model);
    if (!modelConfig) {
      throw new Error(`Model ${requestBody.model} not found`);
    }

    const envVariableName = `${modelConfig.providerSlug.toUpperCase()}_SECRET`;
    const apiKey = this.env[envVariableName];
    if (!apiKey) {
      throw new Error(
        `Missing API Key for ${modelConfig.model}: ${envVariableName}`
      );
    }

    const providerResponse = await fetch(
      `${modelConfig.basePath}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!providerResponse.ok) {
      const errorText = await providerResponse.text();
      throw new Error(
        `Provider error: ${providerResponse.status} ${errorText}`
      );
    }

    return providerResponse;
  }

  private async scheduleDestruction(): Promise<void> {
    // Schedule self-destruction after 1 minute
    setTimeout(() => {
      this.state.storage.deleteAll();
    }, 60000);
  }

  async fetch(request: Request): Promise<Response> {
    try {
      if (request.method === "POST") {
        const requestBody: ChatCompletionRequest = await request.json();

        // If we already have an active request, handle streaming connection
        if (this.activeRequest) {
          if (requestBody.stream) {
            return this.createStreamResponse();
          } else {
            // For non-streaming, wait for completion
            const result = await this.activeRequest;
            return result;
          }
        }

        // Store the request body
        this.set("requestBody", requestBody);

        // Start new request
        this.activeRequest = this.processChatCompletion(requestBody);

        if (requestBody.stream) {
          // Handle streaming response
          this.handleStreamingResponse(requestBody);
          return this.createStreamResponse();
        } else {
          // Handle non-streaming response
          const result = await this.activeRequest;
          const resultData = await result.json();
          this.finalResult = resultData;
          this.isComplete = true;

          // Store in KV and schedule destruction
          await this.env.RESULTS.put(
            this.get<string>("requestId") || `req-${Date.now()}`,
            JSON.stringify(resultData),
            { expirationTtl: 3600 }
          );
          await this.scheduleDestruction();

          return new Response(JSON.stringify(resultData), {
            headers: { "Content-Type": "application/json" },
          });
        }
      }

      if (request.method === "GET") {
        if (this.isComplete && this.finalResult) {
          return new Response(JSON.stringify(this.finalResult), {
            headers: { "Content-Type": "application/json" },
          });
        }

        if (this.activeRequest) {
          const result = await this.activeRequest;
          return result;
        }

        return new Response(
          JSON.stringify({
            error: {
              message: "No active or completed request found",
              type: "not_found",
            },
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      return new Response("Method Not Allowed", { status: 405 });
    } catch (error: any) {
      console.error("Error in ChatCompletionStreamDO:", error);
      return new Response(
        JSON.stringify({
          error: {
            message: error.message,
            type: "internal_error",
          },
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  private async handleStreamingResponse(
    requestBody: ChatCompletionRequest
  ): Promise<void> {
    try {
      const response = await this.activeRequest!;
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") {
              this.isComplete = true;
              // Store final result in KV
              await this.env.RESULTS.put(
                this.get<string>("requestId") || `req-${Date.now()}`,
                JSON.stringify({
                  streaming: true,
                  chunks: this.streamedChunks,
                  fullResponse,
                }),
                { expirationTtl: 3600 }
              );
              await this.scheduleDestruction();
              break;
            }

            this.streamedChunks.push(line);

            // Extract content for full response
            try {
              const parsed = JSON.parse(data);
              if (parsed.choices?.[0]?.delta?.content) {
                fullResponse += parsed.choices[0].delta.content;
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      console.error("Error handling streaming response:", error);
      this.isComplete = true;
    }
  }

  private createStreamResponse(): Response {
    const stream = new ReadableStream({
      start: async (controller) => {
        try {
          // First, send any existing chunks
          for (const chunk of this.streamedChunks) {
            controller.enqueue(new TextEncoder().encode(chunk + "\n"));
          }

          // If already complete, send [DONE] and close
          if (this.isComplete) {
            controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
            controller.close();
            return;
          }

          // Otherwise, continue streaming new chunks
          const checkForNewChunks = async () => {
            let lastChunkIndex = this.streamedChunks.length;

            const intervalId = setInterval(() => {
              // Send any new chunks
              for (
                let i = lastChunkIndex;
                i < this.streamedChunks.length;
                i++
              ) {
                controller.enqueue(
                  new TextEncoder().encode(this.streamedChunks[i] + "\n")
                );
              }
              lastChunkIndex = this.streamedChunks.length;

              // If complete, send [DONE] and cleanup
              if (this.isComplete) {
                controller.enqueue(
                  new TextEncoder().encode("data: [DONE]\n\n")
                );
                controller.close();
                clearInterval(intervalId);
              }
            }, 100);

            // Safety timeout
            setTimeout(() => {
              clearInterval(intervalId);
              if (!this.isComplete) {
                controller.enqueue(
                  new TextEncoder().encode("data: [DONE]\n\n")
                );
                controller.close();
              }
            }, 300000); // 5 minutes timeout
          };

          await checkForNewChunks();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    try {
      // Handle POST /chat/completions
      if (request.method === "POST" && url.pathname === "/chat/completions") {
        const requestBody: ChatCompletionRequest = await request.json();
        const requestId = generateRequestId(requestBody);

        // Check if result already exists in KV
        const existingResult = await env.RESULTS.get(requestId);
        if (existingResult) {
          const result = JSON.parse(existingResult);
          if (result.streaming && requestBody.stream) {
            // Return streaming response from stored chunks
            const stream = new ReadableStream({
              start(controller) {
                for (const chunk of result.chunks) {
                  controller.enqueue(new TextEncoder().encode(chunk + "\n"));
                }
                controller.enqueue(
                  new TextEncoder().encode("data: [DONE]\n\n")
                );
                controller.close();
              },
            });

            return new Response(stream, {
              headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
                "X-ID": requestId,
              },
            });
          } else if (!result.streaming && !requestBody.stream) {
            return new Response(JSON.stringify(result), {
              headers: {
                "Content-Type": "application/json",
                "X-ID": requestId,
              },
            });
          }
        }

        // Get the Durable Object for this request ID
        const doId = env.CHAT_COMPLETION_DO.idFromName(requestId);
        const doStub = env.CHAT_COMPLETION_DO.get(doId);

        // Store request ID in DO
        await doStub.fetch(request.url, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId }),
        });

        const response = await doStub.fetch(request.url, {
          method: "POST",
          headers: request.headers,
          body: JSON.stringify(requestBody),
        });

        // Add X-ID header to response
        const newHeaders = new Headers(response.headers);
        newHeaders.set("X-ID", requestId);

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        });
      }

      // Handle GET /chat/completions/{id}
      if (
        request.method === "GET" &&
        url.pathname.startsWith("/chat/completions/")
      ) {
        const requestId = url.pathname.split("/chat/completions/")[1];

        if (!requestId) {
          return new Response(
            JSON.stringify({
              error: {
                message: "Request ID is required",
                type: "invalid_request_error",
              },
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        // Check KV first
        const kvResult = await env.RESULTS.get(requestId);
        if (kvResult) {
          return new Response(kvResult, {
            headers: {
              "Content-Type": "application/json",
              "X-ID": requestId,
            },
          });
        }

        // Fallback to DO
        const doId = env.CHAT_COMPLETION_DO.idFromName(requestId);
        const doStub = env.CHAT_COMPLETION_DO.get(doId);

        const response = await doStub.fetch(request.url, {
          method: "GET",
          headers: request.headers,
        });

        const newHeaders = new Headers(response.headers);
        newHeaders.set("X-ID", requestId);

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        });
      }

      return new Response("Not Found", { status: 404 });
    } catch (error: any) {
      console.error("Error in main fetch handler:", error);
      return new Response(
        JSON.stringify({
          error: {
            message: error.message,
            type: "internal_error",
          },
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  },
};
