// @ts-check
/// <reference types="@cloudflare/workers-types" />

import {
  Env as StripeflareEnv,
  stripeBalanceMiddleware,
  type StripeUser,
} from "stripeflare";
export { DORM } from "stripeflare";
//@ts-ignore
import homepageHtml from "./homepage.html";
//@ts-ignore
import resultHtml from "./result.html";

/**
 * Extended environment interface including both stripeflare and original env variables
 */
interface Env extends StripeflareEnv {
  RESULTS: KVNamespace; // KV namespace for storing results
  LMPIFY_DO: DurableObjectNamespace; // Durable Object namespace
  ANTHROPIC_SECRET: string;
  FREE_SECRET: string;
}

/**
 * Extended user interface that includes stripeflare user properties
 */
interface User extends StripeUser {
  // Add any additional user properties here
}

/**
 * KV data structure for storing request/result data
 */
interface KVData {
  prompt: string;
  model: string;
  context?: string;
  result: string;
  error?: string;
  timestamp: number;
}

/**
 * SSE Event types
 */
interface SSEEvent {
  type: "init" | "token" | "update" | "complete" | "error";
  data: any;
  timestamp: number;
}

/**
 * Model configuration
 */
interface ModelConfig {
  model: string;
  basePath: string;
  apiKey: string;
  premium?: boolean;
}

/**
 * Persistent state stored in Durable Object storage
 */
interface StoredState {
  pathname: string | null;
  prompt: string | null;
  modelConfig: ModelConfig | null;
  context: string | null;
  accumulatedData: string;
  streamComplete: boolean;
  error: string | null;
  isProcessing: boolean;
  initialized: boolean;
}

/**
 * Durable Object for handling streaming LLM responses
 */
export class LmpifyDO {
  private state: DurableObjectState;
  private env: Env;
  private activeControllers: ReadableStreamDefaultController<Uint8Array>[] = [];
  private encoder = new TextEncoder();

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    try {
      // Handle initial setup from POST request
      if (request.method === "POST" && url.pathname === "/setup") {
        const data = await request.json();

        // Store the data in the Durable Object storage
        const storedState: StoredState = {
          pathname: data.pathname,
          prompt: data.prompt,
          modelConfig: data.model,
          initialized: true,
          accumulatedData: "",
          streamComplete: false,
          error: null,
          isProcessing: false,
          context: null,
        };

        // Save each field to storage
        await this.state.storage.put("pathname", storedState.pathname);
        await this.state.storage.put("prompt", storedState.prompt);
        await this.state.storage.put("modelConfig", storedState.modelConfig);
        await this.state.storage.put("initialized", storedState.initialized);
        await this.state.storage.put(
          "accumulatedData",
          storedState.accumulatedData,
        );
        await this.state.storage.put(
          "streamComplete",
          storedState.streamComplete,
        );
        await this.state.storage.put("error", storedState.error);
        await this.state.storage.put("isProcessing", storedState.isProcessing);
        await this.state.storage.put("context", storedState.context);

        console.log("Setup complete:", {
          pathname: storedState.pathname,
          prompt: storedState.prompt,
          model: storedState.modelConfig?.model,
        });

        return new Response(JSON.stringify({ success: true }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      // Handle SSE stream requests
      if (request.method === "GET" && url.pathname === "/stream") {
        const initialized = await this.state.storage.get<boolean>(
          "initialized",
        );

        if (!initialized) {
          console.log("NOT INITIALIZED");
          return new Response("Not initialized", { status: 400 });
        }

        // Get stored state
        const [
          pathname,
          prompt,
          modelConfig,
          context,
          accumulatedData,
          streamComplete,
          error,
          isProcessing,
        ] = await Promise.all([
          this.state.storage.get<string>("pathname"),
          this.state.storage.get<string>("prompt"),
          this.state.storage.get<ModelConfig>("modelConfig"),
          this.state.storage.get<string>("context"),
          this.state.storage.get<string>("accumulatedData") || "",
          this.state.storage.get<boolean>("streamComplete") || false,
          this.state.storage.get<string>("error"),
          this.state.storage.get<boolean>("isProcessing") || false,
        ]);

        console.log(
          "Starting SSE stream for:",
          pathname,
          prompt,
          modelConfig?.model,
        );

        // Create SSE stream
        const stream = new ReadableStream({
          start: async (controller) => {
            this.activeControllers.push(controller);

            // Send initial state
            await this.sendEvent(controller, "init", {
              prompt,
              model: modelConfig!.model,
              context,
              status: error ? "error" : streamComplete ? "complete" : "pending",
              result: accumulatedData,
              error,
            });

            // If already complete or error, close
            if (streamComplete || error) {
              controller.close();
              return;
            }

            // If not already processing, start the stream
            if (!isProcessing) {
              await this.state.storage.put("isProcessing", true);
              const user = await request.json().catch(() => ({}));
              this.processRequest(user);
            }
          },
          cancel: (controller) => {
            // Remove controller when canceled
            const index = this.activeControllers.indexOf(controller);
            if (index > -1) {
              this.activeControllers.splice(index, 1);
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
          },
        });
      }

      return new Response("Not Found", { status: 404 });
    } catch (error) {
      console.error("Error in DO fetch:", error);
      return new Response("Internal server error", { status: 500 });
    }
  }

  private async processRequest(user: any) {
    try {
      // Get stored state
      const prompt = await this.state.storage.get<string>("prompt");
      const modelConfig = await this.state.storage.get<ModelConfig>(
        "modelConfig",
      );
      const pathname = await this.state.storage.get<string>("pathname");
      let accumulatedData =
        (await this.state.storage.get<string>("accumulatedData")) || "";

      if (!prompt || !modelConfig) {
        throw new Error("Missing required state");
      }

      // Extract URLs from prompt
      const urlRegex =
        /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
      const urls = prompt.match(urlRegex) || [];

      let context: string | null = null;
      let updatedPrompt = prompt;

      // Fetch all URLs in parallel
      if (urls.length > 0) {
        const urlResults = await Promise.all(
          urls.map(async (url) => {
            try {
              const response = await fetch(url);
              const text = await response.text();
              const tokens = Math.round(text.length / 5);
              return { url, text, tokens };
            } catch (error: any) {
              return {
                url,
                text: `Failed to fetch: ${error.message}`,
                tokens: 0,
                failed: true,
              };
            }
          }),
        );

        // Construct context
        context = urlResults
          .map(
            ({ url, text, tokens }) =>
              `${url} (${tokens} tokens) \n${text}\n------\n`,
          )
          .join("\n");

        await this.state.storage.put("context", context);
        console.log({ context });

        // Update prompt with token counts
        urlResults.forEach(({ url, tokens, failed }) => {
          if (!failed) {
            updatedPrompt = updatedPrompt.replace(
              url,
              `${url} (${tokens} tokens)`,
            );
          }
        });
        await this.state.storage.put("prompt", updatedPrompt);

        // Send context update
        this.broadcastEvent("update", {
          field: "context",
          value: context,
        });
      }

      // Prepare LLM request
      const messages = [
        ...(context ? [{ role: "system", content: context }] : []),
        { role: "user", content: updatedPrompt },
      ];

      const isAnthropic = modelConfig.model.includes("claude");

      const llmResponse = await fetch(
        isAnthropic
          ? `${modelConfig.basePath}/v1/messages`
          : `${modelConfig.basePath}/chat/completions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(isAnthropic
              ? {
                  "x-api-key": modelConfig.apiKey,
                  "anthropic-version": "2023-06-01",
                }
              : {
                  Authorization: `Bearer ${modelConfig.apiKey}`,
                }),
          },
          body: JSON.stringify({
            model: modelConfig.model,
            messages,
            stream: true,
            ...(isAnthropic && { max_tokens: 4096 }),
          }),
        },
      );

      if (!llmResponse.ok) {
        throw new Error(
          `LLM API error: ${llmResponse.status} ${await llmResponse.text()}`,
        );
      }

      // Process SSE stream
      const reader = llmResponse.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let position = 0;

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();

            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              let token = "";

              if (isAnthropic) {
                if (
                  parsed.type === "content_block_delta" &&
                  parsed.delta?.text
                ) {
                  token = parsed.delta.text;
                }
              } else {
                if (parsed.choices?.[0]?.delta?.content) {
                  token = parsed.choices[0].delta.content;
                }
              }

              if (token) {
                accumulatedData += token;
                await this.state.storage.put(
                  "accumulatedData",
                  accumulatedData,
                );
                this.broadcastEvent("token", {
                  text: token,
                  position: position++,
                });
              }
            } catch (e) {
              console.error("Error parsing SSE data:", e);
            }
          }
        }
      }

      await this.handleStreamComplete();
    } catch (error: any) {
      console.error("Error processing request:", error);
      await this.state.storage.put("error", error.message);

      // Send error to all connected clients
      this.broadcastEvent("error", {
        message: error.message,
        stack: error.stack,
      });

      // Store error state in KV
      const pathname = await this.state.storage.get<string>("pathname");
      const prompt = await this.state.storage.get<string>("prompt");
      const modelConfig = await this.state.storage.get<ModelConfig>(
        "modelConfig",
      );
      const context = await this.state.storage.get<string>("context");

      if (pathname && prompt && modelConfig) {
        const errorData: KVData = {
          prompt,
          model: modelConfig.model,
          context: context || undefined,
          result: "",
          error: error.message,
          timestamp: Date.now(),
        };
        await this.env.RESULTS.put(pathname, JSON.stringify(errorData));
      }

      // Close all connections
      for (const controller of this.activeControllers) {
        try {
          controller.close();
        } catch (e) {
          // Controller might already be closed
        }
      }
      this.activeControllers = [];
    }
  }

  private async handleStreamComplete() {
    await this.state.storage.put("streamComplete", true);

    const accumulatedData =
      (await this.state.storage.get<string>("accumulatedData")) || "";

    // Send complete event
    this.broadcastEvent("complete", {
      result: accumulatedData,
    });

    // Store in KV
    const pathname = await this.state.storage.get<string>("pathname");
    const prompt = await this.state.storage.get<string>("prompt");
    const modelConfig = await this.state.storage.get<ModelConfig>(
      "modelConfig",
    );
    const context = await this.state.storage.get<string>("context");

    if (pathname && prompt && modelConfig) {
      const kvData: KVData = {
        prompt,
        model: modelConfig.model,
        context: context || undefined,
        result: accumulatedData,
        timestamp: Date.now(),
      };
      await this.env.RESULTS.put(pathname, JSON.stringify(kvData));
    }

    // Close all controllers
    for (const controller of this.activeControllers) {
      try {
        controller.close();
      } catch (e) {
        // Controller might already be closed
      }
    }
    this.activeControllers = [];
  }

  private async sendEvent(
    controller: ReadableStreamDefaultController<Uint8Array>,
    type: string,
    data: any,
  ) {
    const event: SSEEvent = {
      type: type as any,
      data,
      timestamp: Date.now(),
    };

    const message = `data: ${JSON.stringify(event)}\n\n`;
    try {
      controller.enqueue(this.encoder.encode(message));
    } catch (e) {
      // Controller might be closed
    }
  }

  private broadcastEvent(type: string, data: any) {
    for (const controller of this.activeControllers) {
      this.sendEvent(controller, type, data);
    }
  }
}

export const migrations = {
  1: [
    `CREATE TABLE users (
      access_token TEXT PRIMARY KEY,
      balance INTEGER DEFAULT 0,
      email TEXT,
      client_reference_id TEXT
    )`,
    `CREATE INDEX idx_users_balance ON users(balance)`,
    `CREATE INDEX idx_users_email ON users(email)`,
    `CREATE INDEX idx_users_client_reference_id ON users(client_reference_id)`,
  ],
};

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const acceptHeader = request.headers.get("Accept");

    const t = Date.now();
    // Apply stripeflare middleware
    const result = await stripeBalanceMiddleware<User>(
      request,
      env,
      ctx,
      migrations,
    );

    console.log({ stripeMiddlewareMs: Date.now() - t });

    // If middleware returned a response, return it directly
    if (result.response) {
      return result.response;
    }

    // Get user data from stripeflare
    const { access_token, ...user } = (result.user || {}) as Partial<User>;
    const headers = result.headers || new Headers();

    // Only accept POST and GET methods
    if (!["POST", "GET"].includes(request.method)) {
      return new Response("Method not allowed", { status: 405, headers });
    }

    try {
      const t = Date.now();
      // Check if result already exists in KV
      const existingData =
        pathname === "/"
          ? null
          : ((await env.RESULTS.get(pathname, "json")) as KVData | null);
      console.log({ kvRequestMs: Date.now() - t });

      if (existingData) {
        // For API calls, return JSON
        if (request.headers.get("Accept")?.includes("application/json")) {
          headers.set("Content-Type", "application/json");
          return new Response(
            JSON.stringify({
              ...existingData,
              user,
              status: "complete",
            }),
            { headers },
          );
        }

        // For browser, return HTML
        let html = resultHtml;
        const scriptData = {
          ...existingData,
          user,
          status: "complete",
          streaming: false,
        };
        html = html.replace(
          "</head>",
          `<script>window.data = ${JSON.stringify(
            scriptData,
          )};</script></head>`,
        );

        headers.set("Content-Type", "text/html");
        return new Response(html, { headers });
      }

      const isEventStream = acceptHeader?.includes("text/event-stream");

      // If no existing data and it's a GET request, show the form
      if (request.method === "GET" && !isEventStream) {
        let html = homepageHtml;
        html = html.replace(
          "</head>",
          `<script>window.data = ${JSON.stringify({ user })};</script></head>`,
        );

        headers.set("Content-Type", "text/html");
        return new Response(html, { headers });
      }

      // Handle EventSource GET requests
      if (request.method === "GET" && isEventStream) {
        const doId = env.LMPIFY_DO.idFromName(pathname);
        const doStub = env.LMPIFY_DO.get(doId);

        // Connect to the Durable Object SSE stream
        const doRequest = new Request("https://do/stream", {
          method: "GET",
          headers: { Accept: "text/event-stream" },
        });

        const response = await doStub.fetch(doRequest);

        // Forward the SSE response with CORS headers
        const sseHeaders = new Headers(response.headers);
        sseHeaders.set("Access-Control-Allow-Origin", "*");
        sseHeaders.set("Access-Control-Allow-Headers", "*");

        return new Response(response.body, {
          status: response.status,
          headers: sseHeaders,
        });
      }

      // Process POST request
      const formData = await request.formData();
      const prompt = formData.get("prompt")?.toString();
      const modelName = formData.get("model")?.toString();

      if (!prompt) {
        console.log("missing prompt");
        return new Response("Missing prompt", { status: 400, headers });
      }

      // Get model configuration
      const models: ModelConfig[] = [
        {
          model: "gpt-4.1-mini",
          basePath: "https://api.openai.com/v1",
          apiKey: env.FREE_SECRET,
        },
        {
          model: "claude-3.7-sonnet",
          basePath: "https://api.anthropic.com",
          apiKey: env.ANTHROPIC_SECRET,
          premium: true,
        },
      ];

      const modelConfig =
        models.find((m) => m.model === modelName) || models[0];

      // Check balance for premium models
      if (modelConfig.premium && (!user.balance || user.balance <= 0)) {
        return new Response("Payment required", { status: 402, headers });
      }

      // Get or create Durable Object
      const doId = env.LMPIFY_DO.idFromName(pathname);
      const doStub = env.LMPIFY_DO.get(doId);

      // Setup the Durable Object with the request data
      const setupRequest = new Request("https://do/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pathname,
          prompt,
          model: modelConfig,
          user,
        }),
      });

      await doStub.fetch(setupRequest);

      // Return HTML that will connect via EventSource
      let html = resultHtml;
      const scriptData = {
        pathname,
        prompt,
        model: modelConfig.model,
        user,
        status: "pending",
        streaming: true,
      };
      html = html.replace(
        "</head>",
        `<script>window.data = ${JSON.stringify(scriptData)};</script></head>`,
      );

      headers.set("Content-Type", "text/html");
      return new Response(html, { headers });
    } catch (error) {
      console.error("Error in fetch handler:", error);
      return new Response("Internal server error", { status: 500, headers });
    }
  },
};
