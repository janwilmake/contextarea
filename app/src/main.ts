// @ts-check
/// <reference types="@cloudflare/workers-types" />
/// <reference lib="esnext" />
import { studioMiddleware } from "queryable-object";

import { UserContext, withSimplerAuth } from "simplerauth-client";
import {
  createIdpMiddleware,
  fetchUrlContext,
  getAuthorizationForContext,
  createTools,
  type IdpKV,
  type UrlContextResult,
  ClientInfo
} from "./idp-middleware";
import { chatCompletionsProxy } from "./mcp-completions-stateless";
import { ImageResponse } from "workers-og";
import { DurableObject } from "cloudflare:workers";

import {
  Env as StripeflareEnv,
  type StripeUser,
  DORM,
  handleStripeWebhook,
  getStripeflareUser,
  AGGREGATE_NAME
} from "./stripeflare-simple";
import { generateTitleWithAI } from "./generateTitle.js";

//@ts-ignore
import providers from "../public/providers.json";
import { RatelimitDO } from "./ratelimiter.js";
import { getMarkdownResponse } from "./getMarkdownResponse.js";
import { handleMcpRequest } from "./mcp";

export { RatelimitDO };
export { DORM };

const PRICE_MARKUP_FACTOR = 1.5;
const CLIENT_INFO = {
  name: "Context Area",
  title: "Context Area",
  logo_uri: "https://contextarea.com/logo.png",
  uri: "https://contextarea.com",
  version: "1.0.0"
} satisfies ClientInfo;

type LLMSecrets = {
  [key: `${string}_SECRET`]: string;
};

interface Env extends StripeflareEnv, LLMSecrets {
  RESULTS: KVNamespace; // KV namespace for storing results
  PASTES: KVNamespace; // KV namespace for paste storage
  SQL_STREAM_PROMPT_DO: DurableObjectNamespace<SQLStreamPromptDO>; // Durable Object namespace
  ASSETS: Fetcher;
  FETCHER: Fetcher; // Self service binding to avoid 522 on same-domain fetches
  RATELIMIT_DO: DurableObjectNamespace<RatelimitDO>;
  IDP_KV: KVNamespace;
}

function kvFromNamespace(ns: KVNamespace): IdpKV {
  return {
    async get(key) {
      return ns.get(key);
    },
    async set(key, value) {
      await ns.put(key, value);
    },
    async del(key) {
      await ns.delete(key);
    },
    async list(prefix) {
      const keys: string[] = [];
      let cursor: string | undefined;
      do {
        const result = await ns.list({ prefix, cursor });
        for (const key of result.keys) keys.push(key.name);
        cursor = result.list_complete ? undefined : result.cursor;
      } while (cursor);
      return keys;
    }
  };
}

/** Create a fetch function that routes same-domain requests through env.FETCHER to avoid 522 */
function createSelfFetch(env: Env): typeof globalThis.fetch {
  return ((input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    try {
      const parsed = new URL(url);
      if (
        parsed.hostname === "contextarea.com" ||
        parsed.hostname === "www.contextarea.com"
      ) {
        return env.FETCHER.fetch(new Request(url, init));
      }
    } catch {}
    return globalThis.fetch(input, init);
  }) as typeof globalThis.fetch;
}

/**
 * KV data structure for storing request/result data
 */
interface KVData {
  prompt: string;
  model: string;
  headline?: string;
  context?: string | null;
  result?: string;
  error?: string;
  timestamp?: number;
}

export interface SSEEvent {
  type: "init" | "token" | "complete" | "error";
  data: SSEInitData | SSETokenData | SSECompleteData | SSEErrorData;
  timestamp: number;
}

export interface SSEInitData {
  type: "init";
  prompt: string;
  model: string;
  context?: string | null;
  status: "pending" | "streaming" | "complete" | "error";
  result: string;
  error?: string | null;
}

export interface SSETokenData {
  type: "token";
  text: string;
  position: number;
}

export interface SSECompleteData {
  type: "complete";
  result: string;
}

export interface SSEErrorData {
  type: "error";
  message: string;
  stack?: string;
}

interface ModelConfig {
  providerSlug: string;
  pricePerMillionInput: number;
  pricePerMillionOutput: number;
  model: string;
  basePath: string;
  maxTokens: number;
  premium?: boolean;
  extra?: object;
}

/**
 * Durable Object for handling streaming LLM responses
 */
export class SQLStreamPromptDO extends DurableObject<Env> {
  private state: DurableObjectState;
  public env: Env;
  private activeControllers: ReadableStreamDefaultController<Uint8Array>[] = [];
  private encoder = new TextEncoder();
  private sql: any;
  private accumulatedData: string = "";

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.state = state;
    this.env = env;
    this.sql = state.storage.sql;

    // Initialize the KV table
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS _kv (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);
  }

  // Helper function to set a value
  private set(key: string, value: any): void {
    const jsonValue = JSON.stringify(value);
    this.sql.exec(
      `INSERT OR REPLACE INTO _kv (key, value) VALUES (?, ?)`,
      key,
      jsonValue
    );
  }

  // Helper function to get a value
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

  async setup(data: {
    pathname: string;
    prompt: string;
    model: ModelConfig;
    user?: Omit<StripeUser, "charge">;
    store?: boolean;
  }) {
    // Save each field to storage
    this.set("pathname", data.pathname);
    this.set("store", data.store !== false); // Default to true
    const prompt = data.prompt.slice(0, 1024 * 1024);
    this.set("frontMatter", this.parseFrontMatter(prompt).frontMatter);

    // cut prompt at 1mb = 200k tokens - use content without front matter
    this.set("prompt", prompt);
    this.set("modelConfig", data.model);
    this.set("initialized", true);

    // NB: Magic! already get started as soon as it is submitted
    this.state.waitUntil(this.stream(data.user, true));

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  // Helper method to parse front matter from markdown
  private parseFrontMatter(markdownContent: string): {
    frontMatter: any;
    content: string;
  } {
    const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = markdownContent.match(frontMatterRegex);

    if (!match) {
      // No front matter found, return original content
      return { frontMatter: {}, content: markdownContent };
    }

    const frontMatterYaml = match[1];
    const content = match[2];

    try {
      // Parse YAML front matter
      const frontMatter = this.parseYaml(frontMatterYaml);
      return { frontMatter, content };
    } catch (error) {
      console.warn("Failed to parse front matter as YAML:", error);
      // If YAML parsing fails, return original content
      return { frontMatter: {}, content: markdownContent };
    }
  }

  // Simple YAML parser for basic key-value pairs
  private parseYaml(yamlString: string): any {
    const result: any = {};
    const lines = yamlString.split("\n");

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith("#")) {
        continue;
      }

      // Handle key-value pairs
      const colonIndex = trimmedLine.indexOf(":");
      if (colonIndex === -1) {
        continue;
      }

      const key = trimmedLine.substring(0, colonIndex).trim();
      let value = trimmedLine.substring(colonIndex + 1).trim();

      // Remove quotes if present
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      // Try to parse as number or boolean
      if (value === "true") {
        result[key] = true;
      } else if (value === "false") {
        result[key] = false;
      } else if (!isNaN(Number(value)) && value !== "") {
        result[key] = Number(value);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  async details() {
    const modelConfig = this.get<ModelConfig>("modelConfig");
    const prompt = this.get<string>("prompt");
    const context = this.get<string>("context");
    const headline = this.get<string>("headline");
    return { prompt, model: modelConfig?.model, context, headline };
  }

  stream = async (
    user: Omit<StripeUser, "charge"> | undefined,
    isFirstRequest?: boolean
  ) => {
    const initialized = this.get<boolean>("initialized");

    if (!initialized) {
      console.log("NOT INITIALIZED");
      return new Response("Not initialized", { status: 400 });
    }

    // Get stored state
    const pathname = this.get<string>("pathname");
    const prompt = this.get<string>("prompt");
    const modelConfig = this.get<ModelConfig>("modelConfig");
    const context = this.get<string>("context");
    const streamComplete = this.get<boolean>("streamComplete") || false;
    const error = this.get<string>("error");
    const isProcessing = this.get<boolean>("isProcessing") || false;

    console.log(
      "Starting SSE stream for:",
      pathname,
      //  prompt,
      modelConfig?.model
    );

    // Create SSE stream
    const stream = new ReadableStream({
      start: async (controller) => {
        this.activeControllers.push(controller);

        // Send initial state
        await this.sendEvent(controller, "init", {
          type: "init",
          prompt,
          model: modelConfig!.model,
          context,
          status: error ? "error" : streamComplete ? "complete" : "pending",
          result: this.accumulatedData,
          error
        });

        // If already complete or error, close
        if (streamComplete || error) {
          controller.close();
          return;
        }

        // If not already processing, start the stream
        if (!isProcessing) {
          this.set("isProcessing", true);
          this.processRequest(user, isFirstRequest);
        }
      },
      cancel: (controller) => {
        // Remove controller when canceled
        const index = this.activeControllers.indexOf(controller);
        if (index > -1) {
          this.activeControllers.splice(index, 1);
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*"
      }
    });
  };

  async getCurrentResult() {
    const initialized = this.get<boolean>("initialized");

    if (!initialized) {
      return new Response("Not initialized", { status: 404 });
    }

    const prompt = this.get<string>("prompt");
    const modelConfig = this.get<ModelConfig>("modelConfig");
    const context = this.get<string>("context");
    const headline = this.get<string>("headline");
    const streamComplete = this.get<boolean>("streamComplete") || false;
    const error = this.get<string>("error");
    const isProcessing = this.get<boolean>("isProcessing") || false;

    const currentResult = {
      prompt,
      model: modelConfig?.model,
      context,
      headline,
      result: this.accumulatedData, // This is the current result so far
      status: error
        ? "error"
        : streamComplete
          ? "complete"
          : isProcessing
            ? "streaming"
            : "pending",
      error,
      timestamp: Date.now()
    };

    return new Response(JSON.stringify(currentResult), {
      headers: { "Content-Type": "application/json" }
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    try {
      // Handle initial setup from POST request
      if (request.method === "GET" && url.pathname === "/current") {
        return this.getCurrentResult();
      }
      // Handle SSE stream requests
      if (request.method === "GET" && url.pathname === "/stream") {
        const user = await request.json<StripeUser>().catch(() => undefined);
        return this.stream(user, false);
      }

      return new Response("Not Found", { status: 404 });
    } catch (error) {
      console.error("Error in DO fetch:", error);
      return new Response("Internal server error", { status: 500 });
    }
  }

  private async processRequest(
    user: Omit<StripeUser, "charge"> | undefined,
    isFirstRequest: boolean | undefined
  ) {
    try {
      // Get stored state
      const prompt = this.get<string>("prompt");
      const frontMatter = this.get<{ [key: string]: string }>("frontMatter");
      const modelConfig = this.get<ModelConfig>("modelConfig");
      const pathname = this.get<string>("pathname");

      if (!prompt || !modelConfig || !pathname) {
        throw new Error("Missing required state");
      }
      const envVariableName = `${modelConfig.providerSlug.toUpperCase()}_SECRET`;
      const apiKey = this.env[envVariableName];
      if (!apiKey) {
        throw new Error(
          `Missing API Key for ${modelConfig.model}: ${envVariableName}`
        );
      }

      // generate title after we have the context
      const markdown = getMarkdownResponse(pathname, {
        model: modelConfig.model,
        prompt: prompt
        // context: context,
      });

      this.ctx.waitUntil(
        generateTitleWithAI(markdown, this.env.OPENAI_SECRET).then((data) => {
          console.log("GOT HEADLINE", data);
          this.set("headline", data.title);
        })
      );

      const isCloudflare = modelConfig.providerSlug === "cloudflare";

      const content = prompt.replaceAll("{{prompt_id}}", pathname.slice(1));

      // Prepare LLM request
      const messages: { role: string; content: any }[] = [
        { role: "user", content: this.parseFrontMatter(content).content }
      ];

      let priceAtOutput: number | undefined = undefined;

      const titleTokens = Math.round(markdown.length / 5);
      const titleCostPerToken = 0.5 / 1000000;
      const titlePrice = titleTokens * titleCostPerToken;

      const inputTokens = Math.round(prompt.length / 5);
      const inputPrice =
        inputTokens * (modelConfig.pricePerMillionInput / 1000000);
      const fullUrl = `${modelConfig.basePath}/chat/completions`;

      console.log("gonna do request ", fullUrl);

      // Pre-fetch URL context using idp-middleware
      const kv = kvFromNamespace(this.env.IDP_KV);
      const selfFetch = createSelfFetch(this.env);
      const urlContextResult = await fetchUrlContext(
        prompt,
        user?.userId || "",
        "default",
        kv,
        selfFetch
      );

      if (
        urlContextResult.status === 200 &&
        urlContextResult.results.length > 0
      ) {
        const textResults = urlContextResult.results.filter(
          (r): r is Extract<UrlContextResult, { type: "text" }> =>
            r.type === "text"
        );
        const imageResults = urlContextResult.results.filter(
          (r): r is Extract<UrlContextResult, { type: "image" }> =>
            r.type === "image"
        );

        if (textResults.length > 0) {
          const contextText = textResults
            .map((r) => `<context url="${r.url}">\n${r.content}\n</context>`)
            .join("\n\n");
          messages.unshift({ role: "system", content: contextText });
        }

        if (imageResults.length > 0) {
          // Convert user message to multimodal content parts with images
          const userMsg = messages[messages.length - 1];
          const parts: any[] = imageResults.map((r) => ({
            type: "image_url",
            image_url: {
              url: `data:${r.mediaType};base64,${r.base64}`
            }
          }));
          parts.push({
            type: "text",
            text:
              typeof userMsg.content === "string"
                ? userMsg.content
                : JSON.stringify(userMsg.content)
          });
          userMsg.content = parts;
        }
      }

      // Extract MCP server URLs from front matter and @-tagged URLs in prompt
      const mcpUrls: string[] = [];
      if (frontMatter?.mcp) {
        for (const url of String(frontMatter.mcp).split(",")) {
          const trimmed = url.trim();
          if (trimmed) {
            mcpUrls.push(
              trimmed.startsWith("http") ? trimmed : `https://${trimmed}`
            );
          }
        }
      }
      // Detect @https://... URLs in prompt text as MCP servers
      const atUrlRe = /@(https?:\/\/[^\s]+)/g;
      let atMatch;
      while ((atMatch = atUrlRe.exec(prompt)) !== null) {
        const url = atMatch[1].replace(/[)\].,;:!?'"]+$/, "");
        if (!mcpUrls.includes(url)) mcpUrls.push(url);
      }

      // Resolve MCP tool authorization via idp-middleware
      const mcpTools: {
        type: "mcp";
        server_url: string;
        authorization?: string;
        require_approval: "never";
      }[] = [];
      if (mcpUrls.length > 0) {
        const toolResults = await createTools(
          mcpUrls.map((url) => ({ server_url: url })),
          user?.userId || "",
          "default",
          kv
        );
        for (const url of mcpUrls) {
          const result = toolResults.find((t) => t.server_url === url);
          mcpTools.push({
            type: "mcp",
            server_url: url,
            ...(result?.authorization && {
              authorization: result.authorization
            }),
            require_approval: "never"
          });
        }
      }

      // Use MCP-aware fetch proxy when MCP tools are present
      const fetchFn =
        mcpTools.length > 0
          ? chatCompletionsProxy({
              clientInfo: CLIENT_INFO,
              mcpFetch: selfFetch
            }).fetchProxy
          : fetch;

      const llmResponse = await fetchFn(fullUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: modelConfig.model,
          messages,
          stream: true,
          stream_options: { include_usage: true },
          ...(mcpTools.length > 0 && { tools: mcpTools }),
          ...(modelConfig.extra && { ...modelConfig.extra }),
          ...(isCloudflare
            ? {
                max_tokens:
                  modelConfig.maxTokens -
                  Math.round(JSON.stringify(messages).length / 5)
              }
            : {})
        })
      });

      if (!llmResponse.ok) {
        throw new Error(
          `LLM API error: ${llmResponse.status} ${await llmResponse.text()}`
        );
      }

      console.log(
        "Response OK",
        llmResponse.status,
        llmResponse.headers.get("content-type")
      );

      // Process SSE stream
      const reader = llmResponse.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let position = 0;
      let reasoningBuffer = "";
      let isInReasoningBlock = false;

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
            let parsed: any;

            try {
              parsed = JSON.parse(data);
            } catch (e) {
              console.error("Error parsing SSE data:", e);
              continue;
            }

            let token = "";
            let reasoningToken = "";
            if (parsed.type?.startsWith("response.reasoning_")) {
              console.log("reasoning event", parsed.type);

              if (parsed.type === "response.reasoning_text.delta") {
                reasoningToken = parsed.delta || "";
                reasoningBuffer += reasoningToken;

                // Don't send reasoning deltas immediately, buffer them
                continue;
              } else if (parsed.type === "response.reasoning_text.done") {
                // When reasoning is done, format it as quoted text and send it
                if (reasoningBuffer.trim()) {
                  const quotedReasoning = reasoningBuffer
                    .split("\n")
                    .map((line) => `> ${line}`)
                    .join("\n");

                  this.accumulatedData += quotedReasoning + "\n\n";
                  this.broadcastEvent("token", {
                    type: "token",
                    text: quotedReasoning + "\n\n",
                    position: position++
                  });

                  reasoningBuffer = "";
                }
                continue;
              } else if (
                parsed.type === "response.reasoning_summary_text.delta"
              ) {
                // Handle summary reasoning similarly
                reasoningToken = parsed.delta || "";
                reasoningBuffer += reasoningToken;
                continue;
              } else if (
                parsed.type === "response.reasoning_summary_text.done"
              ) {
                // Format summary reasoning as quoted text
                if (reasoningBuffer.trim()) {
                  const quotedSummary = reasoningBuffer
                    .split("\n")
                    .map((line) => `> ${line}`)
                    .join("\n");

                  this.accumulatedData += quotedSummary + "\n\n";
                  this.broadcastEvent("token", {
                    type: "token",
                    text: quotedSummary + "\n\n",
                    position: position++
                  });

                  reasoningBuffer = "";
                }
                continue;
              }
            }

            if (parsed.choices?.[0]?.delta?.content) {
              token = parsed.choices[0].delta.content;
            } else if (parsed.usage?.completion_tokens) {
              priceAtOutput =
                parsed.usage.completion_tokens *
                (modelConfig.pricePerMillionOutput / 1000000);

              console.log(
                "chatgpt output tokens",
                parsed.usage.completion_tokens,
                "priceAtOutput",
                priceAtOutput
              );
            } else if (parsed.type === "error") {
              throw new Error("Error during stream: " + JSON.stringify(parsed));
            }

            // Send regular content tokens
            if (token) {
              this.accumulatedData += token;
              this.broadcastEvent("token", {
                type: "token",
                text: token,
                position: position++
              });
            }
          }
        }
      }

      // Handle any remaining reasoning buffer at the end
      if (reasoningBuffer.trim()) {
        const quotedReasoning = reasoningBuffer
          .split("\n")
          .map((line) => `> ${line}`)
          .join("\n");

        this.accumulatedData += quotedReasoning + "\n\n";
        this.broadcastEvent("token", {
          type: "token",
          text: quotedReasoning + "\n\n",
          position: position++
        });
      }

      const totalCost = isFirstRequest
        ? (inputPrice + titlePrice + (priceAtOutput || 0)) * PRICE_MARKUP_FACTOR
        : 0;

      await this.handleStreamComplete(user, totalCost);
    } catch (error: any) {
      console.error("Error processing request:", error);
      this.set("error", error.message);

      // Send error to all connected clients
      this.broadcastEvent("error", {
        type: "error",
        message: error.message,
        stack: error.stack
      });

      // Store error state in KV
      const pathname = this.get<string>("pathname");
      const prompt = this.get<string>("prompt");
      const modelConfig = this.get<ModelConfig>("modelConfig");
      const context = this.get<string>("context");

      if (pathname && prompt && modelConfig) {
        const errorData: KVData = {
          prompt,
          model: modelConfig.model,
          context: context || undefined,
          error: "Error:" + error.message,
          timestamp: Date.now()
        };
        console.warn("error stored", error);
        await this.env.RESULTS.put(pathname, JSON.stringify(errorData));
      } else {
        console.warn("error not stored", error.message);
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

  private async handleStreamComplete(
    user: Omit<StripeUser, "charge"> | undefined,
    totalCostUsd: number
  ) {
    this.set("streamComplete", true);
    const shouldStore = this.get<boolean>("store") !== false;
    console.log({ shouldStore });
    // Send complete event
    this.broadcastEvent("complete", {
      type: "complete",
      result: this.accumulatedData
    });

    // Store in KV
    const pathname = this.get<string>("pathname");
    const prompt = this.get<string>("prompt");
    const modelConfig = this.get<ModelConfig>("modelConfig");
    const context = this.get<string>("context");
    const headline = this.get<string>("headline") || undefined;

    console.log(
      "Request is done. User should be charged; total cost: ",
      totalCostUsd
    );

    console.log({ userId: user?.userId });
    if (user?.userId) {
      const ctx = { waitUntil: async (fn: Promise<any>) => await fn };

      const stripeflareUser = await getStripeflareUser(
        user.userId,
        this.env,
        ctx
      );

      if (stripeflareUser) {
        const { charged, message } = await stripeflareUser.charge(
          totalCostUsd * 100,
          true
        );
        console.log({ charged, message });
      }
    } else {
      console.log("WARN; NO USER ACCESS TOKEN");
    }

    if (shouldStore && pathname && prompt && modelConfig) {
      const kvData: KVData = {
        prompt,
        model: modelConfig.model,
        context: context || undefined,
        result: this.accumulatedData,
        timestamp: Date.now(),
        headline
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
    data: any
  ) {
    const event: SSEEvent = {
      type: type as any,
      data,
      timestamp: Date.now()
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

/**
 * Sanitizes strings for use in HTML metadata (title, description)
 * - Removes HTML tags
 * - Escapes special characters
 * - Removes newlines and excess whitespace
 * - Trims to specified length
 */
function sanitizeMetadataString(str: string, maxLength = 160) {
  if (!str || typeof str !== "string") return "";

  // Remove HTML tags
  let sanitized = str.replace(/<[^>]*>/g, "");

  // Replace newlines and tabs with spaces
  sanitized = sanitized.replace(/[\r\n\t]+/g, " ");

  // Replace multiple spaces with single space
  sanitized = sanitized.replace(/\s+/g, " ");

  // Escape special characters
  sanitized = sanitized
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  // Trim and limit length
  sanitized = sanitized.trim();
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength - 3) + "...";
  }

  return sanitized;
}
const removeUrlsFromText = (text: string | undefined): string => {
  if (!text) {
    return "";
  }
  // This pattern matches URLs with or without protocol
  // It handles http, https, ftp, and protocol-less URLs (www.example.com)
  const urlPattern =
    /(https?:\/\/|www\.)[^\s<>"]+|[^\s<>"]+\.(com|net|org|io|gov|edu|co|ai|app|dev)([^\s<>"]*)/gi;

  // Replace all URLs with empty strings
  return text.replace(urlPattern, "").replace(/\s+/g, " ").trim();
};
const generateMetadataHtml = (kvData: KVData, requestUrl: string) => {
  const { prompt = "", model = "", context = "", headline } = kvData;
  const url = new URL(requestUrl);
  const tokens = Math.round(((context || prompt)?.length || 0) / 5);
  // Create a title from the prompt (limit to first 60 chars)

  const promptWithoutUrls = removeUrlsFromText(prompt);

  const rawTitle =
    `Prompt with ${tokens} tokens - ` +
    (promptWithoutUrls.length > 40
      ? promptWithoutUrls.substring(0, 37) + "..."
      : promptWithoutUrls);

  // Create a description - use the prompt, but truncate if needed
  const rawDescription =
    promptWithoutUrls.substring(0, 140) +
    (promptWithoutUrls.length > 140 ? "..." : "");

  // Sanitize the title and description
  const title = sanitizeMetadataString(headline || rawTitle || "No title", 60);
  const description = sanitizeMetadataString(
    rawDescription || "No description",
    160
  );

  // Use the provided imageUrl or generate a default one if not provided
  const domain = url.hostname;
  const ogImageUrl = `https://${url.hostname}${url.pathname}.png`;

  return `
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} - ${domain}</title>
<meta name="description" content="${description}" />
<meta name="robots" content="index, follow" />

<!-- Facebook/Open Graph Meta Tags -->
<meta property="og:url" content="${url}" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${title} - ${domain}" />
<meta property="og:description" content="${description}" />
<meta property="og:image" content="${ogImageUrl}" />
<meta property="og:image:alt" content="${description}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:logo" content="/logo.png" />

<!-- Twitter Meta Tags -->
<meta name="twitter:card" content="summary_large_image" />
<meta property="twitter:domain" content="${domain}" />
<meta property="twitter:url" content="${url}" />
<meta name="twitter:title" content="${title} - ${domain}" />
<meta name="twitter:description" content="${description}" />
<meta name="twitter:image" content="${ogImageUrl}" />

`;
};

/*

This implementation allows the following

1. SEO Crawlers must be served SEO-friendly HTML at all cost
2. The path may end with a segment with an extension such as .html, .md, or .json, as https://llmstxt.org suggests. This allows easy navigation when testing in browsers.
3. If accept `*\/*` is provided (such as with some clis) it will default to text/markdown, which is desired for simple implementation with curl and fetch.
4. If none of the above is true, it will use the accept header and find the first matching format, or return 'null' if no format matches.

By default this function requires also supports yaml and png.

- YAML is a great alternative to JSON since it's more information-dense than JSON.
- PNG is used for retrieving the og-image, and is added to the default since og-images are an essential way to improve URL shareability.

*/
const getCrawler = (userAgent: string | null) => {
  const crawlers = [
    { name: "Facebook", userAgentRegex: /facebookexternalhit|Facebot/ },
    { name: "Twitter", userAgentRegex: /Twitterbot/ },
    { name: "LinkedIn", userAgentRegex: /LinkedInBot/ },
    { name: "Slack", userAgentRegex: /Slackbot-LinkExpanding/ },
    { name: "Discord", userAgentRegex: /Discordbot/ },
    { name: "WhatsApp", userAgentRegex: /WhatsApp/ },
    { name: "Telegram", userAgentRegex: /TelegramBot/ },
    { name: "Pinterest", userAgentRegex: /Pinterest/ },
    { name: "Google", userAgentRegex: /Googlebot/ },
    { name: "Bing", userAgentRegex: /bingbot/ }
  ];
  const crawler = crawlers.find((item) =>
    item.userAgentRegex.test(userAgent || "")
  )?.name;

  return crawler;
};

const allowedFormats = {
  md: "text/markdown",
  html: "text/html",
  json: "application/json",
  yaml: "text/yaml",
  png: "image/png"
} as const;

type AllowedFormat = (typeof allowedFormats)[keyof typeof allowedFormats];

/** Useful function to determine what to respond with */
export const getFormat = (request: Request): AllowedFormat | null => {
  const accept = request.headers.get("accept") || "*/*";
  const pathname = new URL(request.url).pathname;
  const segmentChunks = pathname.split("/").pop()!.split(".");
  const ext =
    segmentChunks.length > 1
      ? (segmentChunks.pop()! as AllowedFormat)
      : undefined;

  if (ext && Object.keys(allowedFormats).includes(ext)) {
    // allow path to determine format. comes before crawler since this allows easy changing
    return Object.entries(allowedFormats).find(
      (entry) => entry[0] === ext
    )?.[1]!;
  }

  const crawler = getCrawler(request.headers.get("user-agent"));
  if (crawler) {
    return "text/html";
  }

  if (accept === "*/*") {
    return "text/markdown";
  }

  const acceptedFormats = accept
    .split(",")
    .map((f) => f.trim().split(";")[0].trim());
  const allowedFomat = acceptedFormats.find((format) =>
    Object.values(allowedFormats).includes(format as AllowedFormat)
  ) as AllowedFormat | undefined;

  return allowedFomat || null;
};

const getResult = async (
  request: Request,
  env: Env,
  data: KVData,
  status: string,
  headers: any
) => {
  const format = getFormat(request);
  const url = new URL(request.url);

  // For OG image
  if (format === "image/png") {
    const provider = providers.find((x) => x.model === data.model);

    const promptWithoutUrls = removeUrlsFromText(data.prompt);
    // Extract a preview of the prompt - display first 40 chars
    const headline =
      data.headline ||
      (promptWithoutUrls.length > 32
        ? promptWithoutUrls.substring(0, 30) + "..."
        : promptWithoutUrls);

    // Ensure all divs have display: flex and only using inline styles. also, img must have width and height props
    const ogHtml = `<div style="display: flex; width: 1200px; height: 630px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; background-color: #2a2a2a;">
    
    <!-- Top orange section -->
    <div style="position: absolute; top: 0; left: 0; display:flex; width: 100%; height: 80px; background-color: ${
      provider.color
    };"></div>
    
    <!-- Bottom orange section -->
    <div style="position: absolute; bottom: 0; left: 0; display:flex; width: 100%; height: 80px; background-color: ${
      provider.color
    };"></div>
    
    <!-- Main content container -->
    <div style="display: flex; flex-direction: column; width: 100%; height: 100%; padding: 100px 60px; justify-content: center; align-items: center; position: relative; z-index: 1;">
      
      <!-- Title -->
      <div style="display: flex; margin-bottom: 40px;">
        <h1 style="color: #ffffff; font-size: 72px; font-weight: 600; margin: 0; text-align: center; line-height: 1.2;">${headline}</h1>
      </div>
      
      <!-- Subtitle with provider info and signature -->
      <div style="display: flex; align-items: center; gap: 20px;">
        
        <!-- Provider icon -->
        ${
          provider?.icon
            ? `<img src="https://raw.githubusercontent.com/janwilmake/flaredream.providers/refs/heads/main/public${
                provider.icon
              }" alt="${
                provider?.name || "Provider"
              }" width="120" height="120" style="width: 120px; height: 120px; border-radius: 24px;" />`
            : ""
        }
        
        <!-- Provider name -->
        <span style="color: #e5e5e5; font-size: 36px; font-weight: 400;">${
          provider?.name || "AI"
        } Generation</span>
        
       
        
      </div>
      
    </div>
  </div>`;

    /* 
  
  TODO: Add back after we have login
  
  <span style="color: #b5b5b5; font-size: 36px; font-weight: 300;">by Jan</span>
        
        <!-- Profile picture -->
        <img src="https://pbs.twimg.com/profile_images/1904848783290019841/1duyf2SK_400x400.jpg" width="120" height="120" alt="Jan Wilmake" style="width: 120px; height: 120px; border-radius: 24px;" />*/

    // Generate the image using ImageResponse from workers-og
    try {
      console.log("Generating OG image");

      const imageResponse = new ImageResponse(ogHtml, {
        width: 1200,
        height: 630,
        format: "png",
        debug: true
      });

      // Ensure proper headers are set
      const imageHeaders = new Headers(headers);
      imageHeaders.set("Content-Type", "image/png");
      imageHeaders.set("Cache-Control", "public, max-age=86400");

      console.log("OG image generated successfully");

      return new Response(imageResponse.body, {
        headers: imageHeaders,
        status: 200
      });
    } catch (error) {
      console.error("Error generating OG image:", error);
      headers.set("Content-Type", "text/plain");
      return new Response("Error generating image: " + error.message, {
        status: 500,
        headers
      });
    }
  }

  // For Markdown format
  if (format === "text/markdown") {
    headers.set("Content-Type", "text/markdown");

    return new Response(
      getMarkdownResponse(
        url.pathname,
        data,
        url.searchParams.get("key"),
        url.searchParams.get("codeblock")
      ),
      { headers }
    );
  }

  // For API calls, return JSON
  if (format === "application/json") {
    headers.set("Content-Type", "application/json");
    return new Response(
      JSON.stringify(data),
      //{
      //   ...data,
      //  user: publicUser, status
      // })
      { headers }
    );
  }

  const scriptData = {
    ...data,
    //user: publicUser,
    status,
    streaming: status !== "complete"
  };

  return getResultHTML(env, scriptData, headers, request.url);
};

const getResultHTML = async (
  env: Env,
  data: any,
  headers: Headers,
  requestUrl: string
) => {
  const url = new URL(requestUrl);

  // For browser, return HTML
  const resultHTML = new HTMLRewriter()
    .on("#server-data", {
      element: (e) => {
        e.setInnerContent(JSON.stringify(data), { html: false });
      }
    })
    .on("head", {
      element: (e) => {
        e.append(generateMetadataHtml(data, requestUrl), { html: true });
      }
    })
    .transform(await env.ASSETS.fetch(url.origin + "/result.html"));

  // need new response due to set-cookie header
  headers.set("Content-Type", "text/html");
  return new Response(resultHTML.body, { headers });
};

// ── Paste & Context API handlers ────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

async function handlePaste(
  request: Request,
  env: Env,
  url: URL
): Promise<Response> {
  if (!env.PASTES) {
    return new Response("KV not configured", {
      status: 503,
      headers: corsHeaders
    });
  }

  const id = crypto.randomUUID().slice(0, 16);
  const content = await request.text();
  const contentType = request.headers.get("Content-Type") || "text/plain";

  await env.PASTES.put(id, content, {
    metadata: { contentType },
    expirationTtl: 86400 * 30
  });

  const pasteUrl = `${url.origin}/paste/${id}`;
  return new Response(pasteUrl, {
    headers: { ...corsHeaders, "Content-Type": "text/plain" }
  });
}

async function handleGetPaste(url: URL, env: Env): Promise<Response> {
  if (!env.PASTES) {
    return new Response("KV not configured", {
      status: 503,
      headers: corsHeaders
    });
  }

  const id = url.pathname.slice("/paste/".length);
  const { value, metadata } = await env.PASTES.getWithMetadata(id);

  if (!value) {
    return new Response("Not found", { status: 404, headers: corsHeaders });
  }

  return new Response(value, {
    headers: {
      ...corsHeaders,
      "Content-Type": (metadata as any)?.contentType || "text/plain"
    }
  });
}

async function handleContext(
  url: URL,
  env: Env,
  userId: string | null
): Promise<Response> {
  const targetUrl = url.searchParams.get("url");
  if (!targetUrl) {
    return new Response(JSON.stringify({ error: "Missing url parameter" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    // For contextarea.com URLs, use the self service binding to avoid 522
    let parsedTarget: URL;
    try {
      parsedTarget = new URL(targetUrl);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const isSelf =
      parsedTarget.hostname === "contextarea.com" ||
      parsedTarget.hostname === "www.contextarea.com";

    const headers: Record<string, string> = {
      "User-Agent": "ContextArea/1.0",
      Accept: "text/markdown"
    };

    // If user is logged in, try to get auth for this URL
    if (userId) {
      const kv = kvFromNamespace(env.IDP_KV);
      const auth = await getAuthorizationForContext(
        kv,
        userId,
        targetUrl,
        "default",
        {
          baseUrl: "https://contextarea.com",
          pathPrefix: "/mcp",
          fetchFn: createSelfFetch(env)
        }
      );
      if (auth.Authorization) {
        headers["Authorization"] = auth.Authorization;
      }
    }

    const response = await (isSelf ? env.FETCHER : globalThis).fetch(
      targetUrl,
      {
        headers,
        redirect: "follow"
      }
    );

    // Return 401 with action info for the client
    if (response.status === 401) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
          status: 401,
          action: `/dashboard?url=${encodeURIComponent(targetUrl)}`
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Return 404 with action info for the client
    if (response.status === 404) {
      return new Response(
        JSON.stringify({
          error: "Not found",
          status: 404,
          action: `/dashboard?url=${encodeURIComponent(targetUrl)}`
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const contentType = response.headers.get("Content-Type") || "";
    const text = await response.text();

    let type = "unknown";

    if (contentType.includes("text/html")) {
      return new Response(
        JSON.stringify({ error: "HTML pages are not supported as context" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    } else if (contentType.includes("application/json")) {
      type = "json";
    } else if (contentType.includes("text/")) {
      type = "text";
    } else {
      type = contentType.split("/")[1] || "binary";
    }

    const tokens = Math.ceil(text.length / 4);

    return new Response(
      JSON.stringify({
        title: targetUrl,
        type,
        tokens,
        description: "",
        content: text
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}

export default {
  fetch: withSimplerAuth<Env>(
    async (request: Request, env: Env, ctx: UserContext) => {
      const url = new URL(request.url);
      const pathname = url.pathname;
      const acceptHeader = request.headers.get("Accept") || "*/*";
      if (pathname === "/stripe-webhook") {
        return handleStripeWebhook(request, env, ctx);
      }

      // ── Paste & Context API routes ──
      if (
        request.method === "OPTIONS" &&
        (pathname === "/paste" ||
          pathname.startsWith("/paste/") ||
          pathname === "/context")
      ) {
        return new Response(null, { headers: corsHeaders });
      }

      if (pathname === "/paste" && request.method === "POST") {
        if (!ctx.user?.id) {
          return new Response("Login required to create pastes", {
            status: 401,
            headers: corsHeaders
          });
        }
        return handlePaste(request, env, url);
      }

      if (pathname.startsWith("/paste/") && request.method === "GET") {
        return handleGetPaste(url, env);
      }

      // Get model configuration
      const userId = ctx.user?.id || null;

      if (pathname === "/admin" && ctx.user?.username === "janwilmake") {
        const stub = env.DORM_NAMESPACE.getByName(
          `${env.STRIPEFLARE_VERSION}-${AGGREGATE_NAME}`
        );

        return studioMiddleware(request, stub.raw, {
          dangerouslyDisableAuth: true
        });
      }

      if (pathname === "/context" && request.method === "GET") {
        return handleContext(url, env, userId);
      }

      const t = Date.now();
      // Apply stripeflare middleware
      const stripeflareUser = await getStripeflareUser(userId, env, ctx);
      const user = ctx.user;

      if (user) {
        user.balance = stripeflareUser?.balance;
      }
      console.log({ stripeMiddlewareMs: Date.now() - t });

      if (pathname === "/user") {
        const userData = user ? { ...user, accessToken: ctx.accessToken } : {};
        return new Response(JSON.stringify(userData, undefined, 2), {});
      }

      if (
        pathname === "/mcp" &&
        (request.method === "POST" || request.method === "OPTIONS")
      ) {
        return handleMcpRequest(
          request,
          env,
          userId
            ? { id: userId, username: ctx.user?.username || "" }
            : undefined,
          stripeflareUser
        );
      }

      const idpHandlers = createIdpMiddleware({
        kv: kvFromNamespace(env.IDP_KV),
        userId,
        profile: "default",
        clientInfo: CLIENT_INFO,
        baseUrl: "https://contextarea.com",
        pathPrefix: "/mcp",
        fetchFn: createSelfFetch(env)
      });

      // Serve dashboard page
      if (pathname === "/dashboard") {
        return env.ASSETS.fetch(
          new Request(new URL("/dashboard.html", request.url))
        );
      }

      // IDP middleware handles /mcp/login/* and /mcp/callback/*
      const idpResponse = await idpHandlers.middleware(request);
      if (idpResponse) {
        return idpResponse;
      }

      // IDP API routes
      if (pathname === "/mcp/api/mcp-servers" && request.method === "GET") {
        return Response.json(await idpHandlers.getMcpServers());
      }
      if (pathname === "/mcp/api/context-entries" && request.method === "GET") {
        return Response.json(await idpHandlers.getContextEntries());
      }
      if (pathname === "/mcp/api/mcp-servers" && request.method === "DELETE") {
        const body = (await request.json()) as { url: string; profile: string };
        await idpHandlers.removeMcpServer(body.url, body.profile);
        return Response.json({ ok: true });
      }
      if (
        pathname === "/mcp/api/context-entries" &&
        request.method === "DELETE"
      ) {
        const body = (await request.json()) as { url: string; profile: string };
        await idpHandlers.removeContext(body.url, body.profile);
        return Response.json({ ok: true });
      }

      // Only accept POST and GET methods
      if (!["POST", "GET"].includes(request.method)) {
        return new Response("Method not allowed", { status: 405 });
      }

      // EVENT STREAM HERE
      const isEventStream = acceptHeader?.includes("text/event-stream");

      const pathnameWithoutExt = pathname.split(".")[0];
      console.log({ pathnameWithoutExt });
      try {
        const t = Date.now();
        // Check if result already exists in KV
        const existingData = (await env.RESULTS.get(
          pathnameWithoutExt,
          "json"
        )) as KVData | null;
        console.log({ kvRequestMs: Date.now() - t });

        if (existingData) {
          return getResult(
            request,
            env,
            existingData,
            existingData.error ? "error" : "complete",
            new Headers({ accept: "text/event-stream" })
          );
        }

        // Handle EventSource GET requests
        if (isEventStream && request.method === "GET") {
          const doId = env.SQL_STREAM_PROMPT_DO.idFromName(pathnameWithoutExt);
          const doStub = env.SQL_STREAM_PROMPT_DO.get(doId);

          // Connect to the Durable Object SSE stream
          const doRequest = new Request("https://do/stream", {
            method: "GET",
            headers: { Accept: "text/event-stream" }
          });

          const response = await doStub.fetch(doRequest);

          // Forward the SSE response with CORS headers
          const sseHeaders = new Headers(response.headers);
          sseHeaders.set("Access-Control-Allow-Origin", "*");
          sseHeaders.set("Access-Control-Allow-Headers", "*");

          return new Response(response.body, {
            status: response.status,
            headers: sseHeaders
          });
        }

        // Process POST request

        // Get or create Durable Object
        const doId = env.SQL_STREAM_PROMPT_DO.idFromName(pathnameWithoutExt);
        const doStub = env.SQL_STREAM_PROMPT_DO.get(doId);
        const result = await doStub.details();

        let model: string | undefined = undefined;
        let prompt: string | undefined = undefined;
        let context: string | null | undefined = undefined;

        // Logged out should get 5 requests per hour, then login first.
        const requestLimit = (stripeflareUser?.balance || 0) <= 0 ? 5 : 1000;

        if (request.method === "POST" && !result.prompt) {
          let modelName: string | undefined;
          const contentType = request.headers.get("Content-Type") || "";
          if (contentType.includes("application/json")) {
            const body = await request.json<{
              prompt?: string;
              model?: string;
            }>();
            prompt = body.prompt;
            modelName = body.model;
          } else {
            const formData = await request.formData();
            prompt = formData?.get("prompt")?.toString();
            modelName = formData?.get("model")?.toString();
          }
          console.log("Received submission", modelName);

          // NB: submit this to /chat/completions from here!
          if (!prompt) {
            console.log("missing prompt");
            return new Response("Missing prompt", { status: 400, headers: {} });
          }

          const modelConfig =
            providers.find((m) => m.model === modelName) || providers[0];

          model = modelConfig?.model;

          const userNeedsPayment =
            (modelConfig.premium ||
              (stripeflareUser && stripeflareUser.balance > 0)) &&
            (!stripeflareUser?.balance || stripeflareUser.balance <= 0);

          const clientIp =
            request.headers.get("CF-Connecting-IP") ||
            request.headers.get("X-Forwarded-For")?.split(",")[0].trim() ||
            "127.0.0.1";

          const ratelimited = await env.RATELIMIT_DO.get(
            env.RATELIMIT_DO.idFromName("v2." + clientIp)
          ).checkRateLimit({
            requestLimit,
            resetIntervalMs: 3600 * 1000
          });

          // console.log("middleware 2:", Date.now() - t + "ms", {
          //   requestLimit,
          //   ratelimited,
          // });

          const acceptHtml = request.headers
            .get("accept")
            ?.includes("text/html");
          const TEST_RATELIMIT_PAGE = false;
          const hasWaitTime = (ratelimited?.waitTime || 0) > 0;
          // console.log({ requestLimit, ratelimited, hasWaitTime, hasNegativeBalance });
          if (hasWaitTime || TEST_RATELIMIT_PAGE || userNeedsPayment) {
            if (acceptHtml) {
              const scriptData = {
                model,
                prompt,
                user,
                status: "error",
                ratelimited: true,
                error: !user?.id
                  ? "You need to login first."
                  : hasWaitTime
                    ? "You have reached the ratelimit. Please purchase tokens to continue."
                    : "You have spent all your tokens. Please purchase tokens to continue.",
                streaming: false
              };

              return getResultHTML(
                env,
                scriptData,
                new Headers(ratelimited.headers),
                request.url
              );
            }

            // can only exceed ratelimit if balance is negative
            return new Response(
              "Ratelimit exceeded\n\n" + ratelimited?.headers
                ? JSON.stringify(ratelimited?.headers, undefined, 2)
                : undefined,
              {
                status: 429,
                headers: {
                  ...ratelimited?.headers,
                  "WWW-Authenticate":
                    'Bearer realm="CONTEXTAREA",' +
                    'error="rate_limit_exceeded",' +
                    'error_description="Rate limit exceeded. Please purchase credit at https://contextarea.com for higher limits"'
                }
              }
            );
          }

          await doStub.setup({
            pathname: pathnameWithoutExt,
            prompt,
            model: modelConfig,
            user: stripeflareUser
          });
        } else {
          prompt = result.prompt!;
          model = result.model;
          context = result.context;
          console.log("GET METHOD got details", {
            promptLength: prompt?.length || 0,
            model
          });
        }

        const data: KVData = {
          model: model || providers[0].model,
          prompt,
          context,
          headline: result.headline || undefined
        };
        if (!result.prompt && request.method === "GET") {
          return new Response(null, {
            headers: { Location: "/" },
            status: 302
          });
        }
        return getResult(request, env, data, "pending", new Headers());
      } catch (error) {
        console.error("Error in fetch handler:", error);
        return new Response("Internal server error", {
          status: 500,
          headers: {}
        });
      }
    }
  )
};
