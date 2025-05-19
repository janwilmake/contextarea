// @ts-check
/// <reference types="@cloudflare/workers-types" />

const PRICE_MARKUP_FACTOR = 1.2;

import { ImageResponse } from "workers-og";
import {
  Env as StripeflareEnv,
  stripeBalanceMiddleware,
  type StripeUser,
} from "stripeflare";
export { DORM } from "stripeflare";
import { createClient } from "dormroom";
import { DurableObject } from "cloudflare:workers";
import { RatelimitDO } from "./ratelimiter.js";
export { RatelimitDO };

const DORM_VERSION = "bare-stripeflare";

const migrations = {
  // can add any other info here
  1: [
    `CREATE TABLE users (
      access_token TEXT PRIMARY KEY,
      balance INTEGER DEFAULT 0,
      name TEXT,
      email TEXT,
      verified_email TEXT,
      verified_user_access_token TEXT,
      card_fingerprint TEXT,
      client_reference_id TEXT
    )`,
    `CREATE INDEX idx_users_balance ON users(balance)`,
    `CREATE INDEX idx_users_name ON users(name)`,
    `CREATE INDEX idx_users_email ON users(email)`,
    `CREATE INDEX idx_users_verified_email ON users(verified_email)`,
    `CREATE INDEX idx_users_card_fingerprint ON users(card_fingerprint)`,
    `CREATE INDEX idx_users_client_reference_id ON users(client_reference_id)`,
  ],
  // TODO: let's add other columns here like free_model_uses
  // 2: []
};

/**
 * Generates a catchy title for an AI interaction using OpenAI's GPT-4.1 Mini
 * Silently falls back to a default title if any errors occur
 */
async function generateTitleWithAI(
  contextContent,
  apiKey,
): Promise<{ title: string; description: string }> {
  // Default response in case of any errors
  const defaultResponse = {
    title: "AI Conversation",
    description: "Generated conversation summary",
  };

  // Guard against missing API key
  if (!apiKey) {
    console.warn("OpenAI API key is missing");
    return defaultResponse;
  }

  try {
    // Construct the title generation prompt
    const titlePrompt = `Generate a catchy, concise title (maximum 60 characters) that captures the essence of this complete AI interaction. Consider all components below to create a title that represents the full journey and value provided.
  
  Format your response as:
  
  \`\`\`json
  {
    "title": "Your Compelling Title Here",
    "description": "A one-sentence explanation of why this title works (for my reference)"
  }
  \`\`\`${contextContent}`;

    // Make the API request to OpenAI
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini", // Using GPT-4.1 Mini model
        messages: [{ role: "user", content: titlePrompt }],
        temperature: 0.7,
      }),
    });

    // If request failed, log warning and return default
    if (!response.ok) {
      const errorData: any = await response.json().catch(() => ({}));
      console.warn(
        `OpenAI API error: ${errorData.error?.message || response.statusText}`,
      );
      return defaultResponse;
    }

    // Parse the response
    const data: any = await response.json();
    const aiResponse = data.choices[0].message.content;

    // Extract JSON from the first code block
    const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/);

    if (!jsonMatch) {
      // Try to find any code block if json-specific one isn't found
      const codeBlockMatch = aiResponse.match(
        /```(?:\w*\s*)?\s*([\s\S]*?)\s*```/,
      );

      if (!codeBlockMatch) {
        console.warn("Could not find JSON data in the AI response");
        return defaultResponse;
      }

      try {
        return JSON.parse(codeBlockMatch[1]);
      } catch (e) {
        console.warn(`Invalid JSON in AI response: ${e.message}`);
        return defaultResponse;
      }
    }

    try {
      return JSON.parse(jsonMatch[1]);
    } catch (e) {
      console.warn(`Invalid JSON in AI response: ${e.message}`);
      return defaultResponse;
    }
  } catch (error) {
    console.warn("Error generating title:", error);
    return defaultResponse;
  }
}

/**
 * Extended environment interface including both stripeflare and original env variables
 */
interface Env extends StripeflareEnv {
  RESULTS: KVNamespace; // KV namespace for storing results
  SQL_STREAM_PROMPT_DO: DurableObjectNamespace<SQLStreamPromptDO>; // Durable Object namespace
  ANTHROPIC_SECRET: string;
  FREE_SECRET: string;
  ASSETS: Fetcher;
  RATELIMIT_DO: DurableObjectNamespace<RatelimitDO>;
}

/**
 * Extended user interface that includes stripeflare user properties
 */
interface User extends StripeUser {
  free_model_uses: number;
  // Add any additional user properties here
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
  pricePerMillionInput: number;
  pricePerMillionOutput: number;
  model: string;
  basePath: string;
  apiKey: string;
  premium?: boolean;
}

const generateContext = async (prompt: string) => {
  // Extract URLs from prompt
  const urlRegex =
    /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
  const urls = prompt.match(urlRegex) || [];

  let context: string | null = null;

  if (urls?.length === 0) {
    return { context };
  }

  let hasHtml = false;
  let hasError = false;
  const urlResults = await Promise.all(
    urls.map(async (url: string) => {
      try {
        const response = await fetch(url);
        const contentType = response.headers.get("content-type");
        const isHtml = contentType?.startsWith("text/html");
        if (isHtml) {
          hasHtml = true;
          const appendix = url.startsWith("https://github.com/")
            ? "For github code, use https://uithub.com/owner/repo"
            : url.startsWith("https://x.com")
            ? "For x threads, use xymake.com/status/..."
            : "For blogs/docs, use firecrawl or https://jina.ai/reader";
          return {
            url,
            text: "HTML urls are not supported. " + appendix,
            tokens: 0,
          };
        }
        const text = await response.text();
        const mime = contentType?.split(";")[0].split("/")[1];
        const tokens = Math.round(text.length / 5);
        return { url, text: `\`\`\`${mime}\n${text}\n\n\`\`\`\n`, tokens };
      } catch (error: any) {
        hasError = true;
        return {
          url,
          text: `Failed to fetch: ${error.message}. To get context for any url, use jina.ai, firecrawl.dev, uithub.com (for code), or xymake.com (for x threads), or any alternative.`,
          tokens: 0,
          failed: true,
        };
      }
    }),
  );

  // Construct context
  context = urlResults.reduce(
    (previous, { url, text, tokens }) =>
      `${previous}\n${url} (${tokens} tokens) \n${
        previous.length > 1024 * 1024 ? "Omitted due to context length." : text
      }\n`,
    "",
  );

  if (hasHtml || hasError) {
    context =
      context +
      `\n\nThere were one of more URLs pasted that returned ${
        hasHtml ? "HTML" : "an error"
      }. If these URLs are needed to answer the user request, please instruct the user to use the suggested alternatives.`;
  }

  return { context };
};
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
      jsonValue,
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
    user?: User;
  }) {
    // Save each field to storage
    this.set("pathname", data.pathname);

    // cut prompt at 1mb = 200k tokens
    this.set("prompt", data.prompt.slice(0, 1024 * 1024));
    this.set("modelConfig", data.model);
    this.set("initialized", true);

    // NB: Magic! already get started as soon as it is submitted
    this.state.waitUntil(this.stream(data.user, true));

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  async details() {
    const modelConfig = this.get<ModelConfig>("modelConfig");
    const prompt = this.get<string>("prompt");
    const context = this.get<string>("context");
    const headline = this.get<string>("headline");
    return { prompt, model: modelConfig?.model, context, headline };
  }

  stream = async (user: User | undefined, isFirstRequest?: boolean) => {
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
          result: this.accumulatedData,
          error,
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
  };

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    try {
      // Handle initial setup from POST request

      // Handle SSE stream requests
      if (request.method === "GET" && url.pathname === "/stream") {
        const user = await request.json<User>().catch(() => undefined);

        const TEMPORARY_TEST_STREAM_WITH_PAYMENT = true;
        return this.stream(user, TEMPORARY_TEST_STREAM_WITH_PAYMENT);
      }

      return new Response("Not Found", { status: 404 });
    } catch (error) {
      console.error("Error in DO fetch:", error);
      return new Response("Internal server error", { status: 500 });
    }
  }

  private async processRequest(
    user: User | undefined,
    isFirstRequest: boolean | undefined,
  ) {
    try {
      // Get stored state
      const prompt = this.get<string>("prompt");
      const modelConfig = this.get<ModelConfig>("modelConfig");
      const pathname = this.get<string>("pathname");

      if (!prompt || !modelConfig || !pathname) {
        throw new Error("Missing required state");
      }

      const { context } = await generateContext(prompt);
      console.log("GOT CONTEXT", context?.length);
      // generate title after we have the context

      const markdown = getMarkdownResponse(pathname, {
        model: modelConfig.model,
        prompt: prompt,
        context: context,
      });

      this.ctx.waitUntil(
        generateTitleWithAI(markdown, this.env.FREE_SECRET).then((data) => {
          console.log("GOT HEADLINE", data.title);
          this.set("headline", data.title);
        }),
      );

      // Fetch all URLs in parallel
      if (context) {
        this.set("context", context);
        this.set("prompt", prompt.slice(0, 1024 * 1024));
        // Send context update
        this.broadcastEvent("update", {
          field: "context",
          value: context,
        });
      }
      const isAnthropic = modelConfig.model.includes("claude");

      // Prepare LLM request
      const messages = [
        ...(context && !isAnthropic
          ? [{ role: "system", content: context }]
          : []),
        { role: "user", content: prompt },
      ];

      let priceAtOutput: number | undefined = undefined;

      const titleTokens = Math.round(markdown.length / 5);
      const titleCostPerToken = 0.5 / 1000000;
      const titlePrice = titleTokens * titleCostPerToken;

      const inputTokens =
        Math.round((context?.length || 0) / 5) + Math.round(prompt.length / 5);
      const inputPrice =
        inputTokens * (modelConfig.pricePerMillionInput / 1000000);

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
            ...(isAnthropic && context && { system: context }),
            ...(!isAnthropic && { stream_options: { include_usage: true } }),
            ...(isAnthropic && { max_tokens: 64000 }),
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

                if (parsed.usage?.output_tokens) {
                  console.log(
                    "anthropic output tokens",
                    parsed.usage.output_tokens,
                  );
                  priceAtOutput =
                    parsed.usage.output_tokens *
                    (modelConfig.pricePerMillionOutput / 1000000);
                }
              } else {
                if (parsed.choices?.[0]?.delta?.content) {
                  token = parsed.choices[0].delta.content;
                }

                if (parsed.usage?.completion_tokens) {
                  console.log(
                    "chatgpt output tokens",
                    parsed.usage.completion_tokens,
                  );

                  priceAtOutput =
                    parsed.usage.completion_tokens *
                    (modelConfig.pricePerMillionOutput / 1000000);
                }
              }

              if (token) {
                this.accumulatedData += token;
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

      const totalCost = isFirstRequest
        ? (inputPrice + titlePrice + (priceAtOutput || 0)) * PRICE_MARKUP_FACTOR
        : 0;

      if (isFirstRequest) {
        console.log({
          inputPrice,
          titlePrice,
          priceAtOutput,
          PRICE_MARKUP_FACTOR,
        });
      }

      await this.handleStreamComplete(user, totalCost);
    } catch (error: any) {
      console.error("Error processing request:", error);
      this.set("error", error.message);

      // Send error to all connected clients
      this.broadcastEvent("error", {
        message: error.message,
        stack: error.stack,
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

  private async handleStreamComplete(
    user: User | undefined,
    totalCost: number,
  ) {
    this.set("streamComplete", true);

    // Send complete event
    this.broadcastEvent("complete", {
      result: this.accumulatedData,
    });

    // Store in KV
    const pathname = this.get<string>("pathname");
    const prompt = this.get<string>("prompt");
    const modelConfig = this.get<ModelConfig>("modelConfig");
    const context = this.get<string>("context");
    const headline = this.get<string>("headline") || undefined;

    console.log(
      "Request is done. User should be charged; total cost: ",
      totalCost,
      "access_token",
      user?.access_token,
      "model config",
      modelConfig,
    );

    if (user?.access_token) {
      const client = createClient({
        doNamespace: this.env.DORM_NAMESPACE,
        version: DORM_VERSION,
        migrations,
        //@ts-ignore
        ctx: {
          // NB: need to wrap because of the this reference
          waitUntil: (promise: Promise<void>) => this.ctx.waitUntil(promise),
        },
        name: user?.access_token,
        mirrorName: "aggregate",
      });
      client.exec(
        "UPDATE users SET balance = balance - ? WHERE access_token = ?",
        totalCost * 100,
        user?.access_token,
      );
    } else {
      console.log("WARN; NO USER ACCESS TOKEN");
    }

    if (pathname && prompt && modelConfig) {
      const kvData: KVData = {
        prompt,
        model: modelConfig.model,
        context: context || undefined,
        result: this.accumulatedData,
        timestamp: Date.now(),
        headline,
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

/**
 * Sanitizes strings for use in HTML metadata (title, description)
 * - Removes HTML tags
 * - Escapes special characters
 * - Removes newlines and excess whitespace
 * - Trims to specified length
 *
 * @param {string} str - The string to sanitize
 * @param {number} maxLength - Maximum length to truncate to
 * @return {string} - Sanitized string
 */
function sanitizeMetadataString(str, maxLength = 160) {
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
const removeUrlsFromText = (text: string): string => {
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
  const tokens = Math.round((context || prompt).length / 5);
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
  const title = sanitizeMetadataString(headline || rawTitle, 60);
  const description = sanitizeMetadataString(rawDescription, 160);

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
    { name: "Bing", userAgentRegex: /bingbot/ },
  ];
  const crawler = crawlers.find((item) =>
    item.userAgentRegex.test(userAgent || ""),
  )?.name;

  return crawler;
};

const allowedFormats = {
  md: "text/markdown",
  html: "text/html",
  json: "application/json",
  yaml: "text/yaml",
  png: "image/png",
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
      (entry) => entry[0] === ext,
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
    Object.values(allowedFormats).includes(format as AllowedFormat),
  ) as AllowedFormat | undefined;

  return allowedFomat || null;
};

const getMarkdownResponse = (
  pathname: string,
  data: KVData,
  key?: string | null,
) => {
  if (key) {
    // allow returning a specific key
    return data[key];
  }

  let markdownResponse = `# ${data.headline || pathname}\n\n`;

  // Add prompt section
  markdownResponse += "## Prompt\n\n```prompt.md\n";
  markdownResponse += data.prompt;
  markdownResponse += "\n```\n\n";

  // Add context section if available
  if (data.context) {
    markdownResponse += "## Context\n\n```context.md\n";
    markdownResponse += data.context;
    markdownResponse += "\n```\n\n";
  }

  // Add result section if available
  if (data.result) {
    markdownResponse += "## Result\n\n```result.md\n";
    markdownResponse += data.result;
    markdownResponse += "\n```\n\n";
  } else {
    markdownResponse += "## Status\n\n";
    markdownResponse += `Model: ${data.model}\n`;
  }
  return markdownResponse;
};
const getResult = async (
  request: Request,
  env: Env,
  publicUser: Omit<User, "access_token" | "verified_user_access_token"> | {},
  data: KVData,
  status: string,
  headers: any,
) => {
  const format = getFormat(request);
  const url = new URL(request.url);

  // For OG image
  if (format === "image/png") {
    const promptTokens = Math.round(data.prompt.length / 5);
    const contextTokens = Math.round((data.context?.length || 0) / 5);
    const resultTokens = Math.round((data.result?.length || 0) / 5);

    // Extract a preview of the prompt - display first 40 chars
    const headline =
      data.headline ||
      (data.prompt.length > 40
        ? data.prompt.substring(0, 40) + "..."
        : data.prompt);

    // Ensure all divs have display: flex and only using inline styles
    const ogHtml = `<div style="display: flex; width: 1200px; height: 630px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif">
    <div style="display: flex; flex-direction: column; background-color: #2a2a2a; width: 100%; height: 100%; padding-left: 40px; padding-right: 40px; padding-top: 10px; padding-bottom: 100px;">
      
      <!-- Header row -->
      <div style="display: flex; width:100%; justify-content: flex-end; margin-bottom: 15px;">
        <!--<div style="display: flex; width: 36px; height: 36px; background-color: #feca57; border-radius: 18px; margin-right: 12px;"></div>-->
        <div style="display: flex;"><p style="display: flex; flex-direction: column; margin: 0; font-size: 42px; color: #ffffff; font-weight: 300; letter-spacing: 0.02em; font-family: sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial;">let me prompt it for you</p></div>
      </div>
      
      <!-- Main content area -->
      <div style="display: flex; flex-direction: column; justify-content: center; flex: 1;">
        <!-- Prompt container -->
        <div style="display: flex; padding: 30px; margin-bottom: 20px; border-left: 6px solid #feca57;">
          <div style="display: flex; width: 100%;">
            <p style="display: flex; flex-direction: column; color: #e5e5e5; font-size: 64px; margin: 0; font-family: sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial; width: 100%;">${headline}</p>
          </div>
        </div>
      </div>
      
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; flex-direction: column; align-items: flex-start;">
          <div style="display: flex; font-size: 80px; font-weight: bold; color: #feca57;">${promptTokens.toLocaleString()}</div>
          <div style="display: flex; font-size: 28px; color: #b5b5b5; opacity: 0.8;">PROMPT TOKENS</div>
        </div>
  
         <div style="display: flex; flex-direction: column; align-items: flex-start;">
          <div style="display: flex; font-size: 80px; font-weight: bold; color: #4a9eff;">${contextTokens.toLocaleString()}</div>
          <div style="display: flex; font-size: 28px; color: #b5b5b5; opacity: 0.8;">CONTEXT TOKENS</div>
        </div>
  
         <div style="display: flex; flex-direction: column; align-items: flex-start;">
          <div style="display: flex; font-size: 80px; font-weight: bold; color: #e5e5e5;">${resultTokens.toLocaleString()}</div>
          <div style="display: flex; font-size: 28px; color: #b5b5b5; opacity: 0.8;">RESULT TOKENS</div>
        </div>
        
      </div>
    </div>
  </div>`;
    // Generate the image using ImageResponse from workers-og
    try {
      console.log("Generating OG image");

      const imageResponse = new ImageResponse(ogHtml, {
        width: 1200,
        height: 630,
        format: "png",
        debug: true,
      });

      // Ensure proper headers are set
      const imageHeaders = new Headers(headers);
      imageHeaders.set("Content-Type", "image/png");
      imageHeaders.set("Cache-Control", "public, max-age=86400");

      console.log("OG image generated successfully");

      return new Response(imageResponse.body, {
        headers: imageHeaders,
        status: 200,
      });
    } catch (error) {
      console.error("Error generating OG image:", error);
      headers.set("Content-Type", "text/plain");
      return new Response("Error generating image: " + error.message, {
        status: 500,
        headers,
      });
    }
  }

  // For Markdown format
  if (format === "text/markdown") {
    headers.set("Content-Type", "text/markdown");

    return new Response(
      getMarkdownResponse(url.pathname, data, url.searchParams.get("key")),
      { headers },
    );
  }

  // For API calls, return JSON
  if (format === "application/json") {
    headers.set("Content-Type", "application/json");
    return new Response(JSON.stringify({ ...data, user: publicUser, status }), {
      headers,
    });
  }

  const scriptData = {
    ...data,
    user: publicUser,
    status,
    streaming: status !== "complete",
  };

  return getResultHTML(env, scriptData, headers, request.url);
};

const getResultHTML = async (
  env: Env,
  data: any,
  headers: Headers,
  requestUrl: string,
) => {
  const url = new URL(requestUrl);

  // For browser, return HTML
  const resultHTML = new HTMLRewriter()
    .on("#server-data", {
      element: (e) => {
        e.setInnerContent(JSON.stringify(data), { html: false });
      },
    })
    .on("head", {
      element: (e) => {
        e.append(generateMetadataHtml(data, requestUrl), { html: true });
      },
    })
    .transform(await env.ASSETS.fetch(url.origin + "/result.html"));

  // need new response due to set-cookie header
  headers.set("Content-Type", "text/html");
  return new Response(resultHTML.body, { headers });
};
const requestHandler = async (
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> => {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const acceptHeader = request.headers.get("Accept") || "*/*";

  // Get model configuration
  const models: ModelConfig[] = [
    {
      model: "gpt-4.1-mini",
      basePath: "https://api.openai.com/v1",
      apiKey: env.FREE_SECRET,
      pricePerMillionInput: 0.4,
      pricePerMillionOutput: 1.6,
    },
    {
      model: "claude-3-7-sonnet-latest",
      basePath: "https://api.anthropic.com",
      apiKey: env.ANTHROPIC_SECRET,
      premium: true,
      pricePerMillionInput: 3,
      pricePerMillionOutput: 15,
    },
  ];

  const t = Date.now();
  // Apply stripeflare middleware
  const result = await stripeBalanceMiddleware<User>(
    request,
    env,
    ctx,
    migrations,
    DORM_VERSION,
  );

  console.log({ stripeMiddlewareMs: Date.now() - t });

  // If middleware returned a response, return it directly
  if (result.response) {
    return result.response;
  }

  if (!result.session) {
    return new Response("No session could be estabilished");
  }

  const { user } = result.session;
  // Get user data from stripeflare
  const { access_token, verified_user_access_token, ...publicUser } =
    user || {};

  const headers = result.session.headers || new Headers();

  // Only accept POST and GET methods
  if (!["POST", "GET"].includes(request.method)) {
    return new Response("Method not allowed", { status: 405, headers });
  }

  if (pathname === "/me") {
    headers.append("content-type", "application/json");
    return new Response(JSON.stringify(publicUser, undefined, 2), { headers });
  }

  const pathnameWithoutExt = pathname.split(".")[0];

  try {
    const t = Date.now();
    // Check if result already exists in KV
    const existingData = (await env.RESULTS.get(
      pathnameWithoutExt,
      "json",
    )) as KVData | null;
    console.log({ kvRequestMs: Date.now() - t });

    if (existingData) {
      return getResult(
        request,
        env,
        publicUser,
        existingData,
        existingData.error ? "error" : "complete",
        headers,
      );
    }

    const isEventStream = acceptHeader?.includes("text/event-stream");

    // Handle EventSource GET requests
    if (request.method === "GET" && isEventStream) {
      const doId = env.SQL_STREAM_PROMPT_DO.idFromName(pathnameWithoutExt);
      const doStub = env.SQL_STREAM_PROMPT_DO.get(doId);

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

    // Get or create Durable Object
    const doId = env.SQL_STREAM_PROMPT_DO.idFromName(pathnameWithoutExt);
    const doStub = env.SQL_STREAM_PROMPT_DO.get(doId);

    const result = await doStub.details();

    let model: string | undefined = undefined;
    let prompt: string | undefined = undefined;
    let context: string | null | undefined = undefined;

    const requestLimit =
      !user?.access_token || (user?.balance || 0) <= 0
        ? // Logged out should get 5 requests per hour, then login first.
          5
        : 1000;

    if (request.method === "POST" && !result.prompt) {
      const formData = await request.formData();
      prompt = formData?.get("prompt")?.toString();
      const modelName = formData?.get("model")?.toString();

      if (!prompt) {
        console.log("missing prompt");
        return new Response("Missing prompt", { status: 400, headers });
      }

      const modelConfig =
        models.find((m) => m.model === modelName) || models[0];

      model = modelConfig?.model;

      const userNeedsPayment =
        (modelConfig.premium || (user && user.balance > 0)) &&
        (!user?.balance || user.balance <= 0);

      const clientIp =
        request.headers.get("CF-Connecting-IP") ||
        request.headers.get("X-Forwarded-For")?.split(",")[0].trim() ||
        "127.0.0.1";

      const ratelimited = await env.RATELIMIT_DO.get(
        env.RATELIMIT_DO.idFromName("v2." + clientIp),
      ).checkRateLimit({
        requestLimit,
        resetIntervalMs: 3600 * 1000,
      });

      // console.log("middleware 2:", Date.now() - t + "ms", {
      //   requestLimit,
      //   ratelimited,
      // });

      const acceptHtml = request.headers.get("accept")?.includes("text/html");
      const TEST_RATELIMIT_PAGE = false;
      const hasWaitTime = (ratelimited?.waitTime || 0) > 0;
      // console.log({ requestLimit, ratelimited, hasWaitTime, hasNegativeBalance });
      if (hasWaitTime || TEST_RATELIMIT_PAGE || userNeedsPayment) {
        if (acceptHtml) {
          const scriptData = {
            model,
            prompt,
            user: publicUser,
            status: "error",
            ratelimited: true,
            error: hasWaitTime
              ? "You have reached the ratelimit. Please purchase tokens to continue."
              : "You have spent all your tokens. Please purchase tokens to continue.",
            streaming: false,
          };

          const newHeaders = {};
          headers.forEach((value, key) => {
            newHeaders[key] = value;
          });

          return getResultHTML(
            env,
            scriptData,
            new Headers({ ...newHeaders, ...ratelimited.headers }),
            request.url,
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
                'Bearer realm="uithub service",' +
                'error="rate_limit_exceeded",' +
                'error_description="Rate limit exceeded. Please purchase credit at https://lmpify.com for higher limits"',
            },
          },
        );
      }

      await doStub.setup({
        pathname: pathnameWithoutExt,
        prompt,
        model: modelConfig,
        user,
      });
    } else {
      prompt = result.prompt!;
      model = result.model;
      context = result.context;
      console.log("GET METHOD got details", { prompt, model });
    }

    return getResult(
      request,
      env,
      publicUser,
      {
        model: model || models[0].model,
        prompt,
        context,
        headline: result.headline || undefined,
      },
      "pending",
      headers,
    );
  } catch (error) {
    console.error("Error in fetch handler:", error);
    return new Response("Internal server error", { status: 500, headers });
  }
};

export default {
  fetch: async (request: Request, env: Env, ctx: ExecutionContext) => {
    const url = new URL(request.url);
    const pathname = url.pathname;
    if (pathname.startsWith("/from/")) {
      // redirect to post
      try {
        const contextUrl = new URL(pathname.slice("/from/".length));
        const response = await fetch(contextUrl);
        if (!response.ok) {
          return new Response("Invalid URL - returned " + response.status, {
            status: 400,
          });
        }
        const promptText = await response.text();

        const first20 = promptText.substring(0, 20);
        function slugify(text) {
          return text
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, "")
            .replace(/[\s_-]+/g, "-")
            .replace(/^-+|-+$/g, "");
        }

        // Simple hash function for 7-character SHA-like string
        function simpleHash(str) {
          let hash = 0;
          for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash;
          }
          return Math.abs(hash).toString(36).substring(0, 7).padEnd(7, "0");
        }

        const slug = slugify(first20);
        const hash = simpleHash(promptText);

        // Create the URL path
        const path = `/${slug}-${hash}`;
        const formData = new FormData();
        formData.append("prompt", promptText);

        // we do the request internally here
        const postResponse = await requestHandler(
          new Request(new URL(url.origin + path), {
            method: "POST",
            body: formData,
          }),
          env,
          ctx,
        );
        const result = await postResponse.text();
        console.log(
          "result from ",
          postResponse.status,
          contextUrl.toString(),
          result?.length,
        );

        return new Response("Redirect", {
          status: 302,
          headers: { location: path },
        });
      } catch (e) {
        console.log(e);
        return new Response("Invalid url", { status: 400 });
      }
    }

    return requestHandler(request, env, ctx);
  },
};
