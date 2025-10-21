// @ts-check
/// <reference types="@cloudflare/workers-types" />
/// <reference lib="esnext" />

const PRICE_MARKUP_FACTOR = 1.5;
const LMPIFY_CLIENT = {
  name: "Context Area",
  title: "Context Area",
  version: "1.0.0",
};
import { UserContext, withSimplerAuth } from "simplerauth-client";
import { MCPProviders, chatCompletionsProxy } from "mcp-completions";
import { ImageResponse } from "workers-og";
import {
  Env as StripeflareEnv,
  type StripeUser,
  DORM,
  handleStripeWebhook,
  getStripeflareUser,
} from "./stripeflare-simple";
import { DurableObject } from "cloudflare:workers";
//@ts-ignore
import providers from "./providers.json";
import { RatelimitDO } from "./ratelimiter.js";
export { RatelimitDO };
import { Token, lexer } from "marked";
export { DORM };
export { MCPProviders };

const DORM_VERSION = "bare-stripeflare";

/**
 * Recursively flatten a marked token and return something if a find function is met
 */
export const flattenMarkedTokenRecursive = (
  token: Token,
  findFunction: (token: any) => boolean
): Token[] => {
  if (findFunction(token)) {
    return [token];
  }

  if (token.type === "table") {
    const header = token.header
      .map((token: any) => {
        const result = token.tokens
          .map((x: any) => flattenMarkedTokenRecursive(x, findFunction))
          .flat();
        return result;
      })
      .flat();

    const rows = token.rows
      .map((row: any) => {
        const result = row
          .map((token: any) => {
            const result = token.tokens
              .map((x: any) => flattenMarkedTokenRecursive(x, findFunction))
              .flat();

            return result;
          })
          .flat();

        return result;
      })
      .flat();

    return [header, rows].flat();
  }

  if (token.type === "list") {
    const result = token.items
      .map((token: any) => {
        const result = token.tokens
          .map((x: any) => flattenMarkedTokenRecursive(x, findFunction))
          .flat();
        return result;
      })
      .flat();

    return result;
  }

  if (
    token.type === "del" ||
    token.type === "em" ||
    token.type === "heading" ||
    token.type === "link" ||
    token.type === "paragraph" ||
    token.type === "strong"
  ) {
    if (!token.tokens) {
      return [];
    }
    const result = token.tokens
      .map((x: any) => flattenMarkedTokenRecursive(x, findFunction))
      .flat();
    return result;
  }

  return [];
};

/**
 * find all items that match a token, recursively in all nested things
 */
export const flattenMarkdownString = (
  markdownString: string,
  findFunction: (token: Token) => boolean
): Token[] => {
  const tokenList = lexer(markdownString);
  const result = tokenList
    .map((x) => flattenMarkedTokenRecursive(x, findFunction))
    .filter((x) => !!x)
    .map((x) => x!)
    .flat();

  return result;
};
/**
 * find all codeblocks  (stuff between triple bracket)
 *
 * ```
 * here
 * is
 * example
 * ```
 */
export const findCodeblocks = (
  markdownString: string
): {
  text: string;
  lang?: string;
  parameters?: { [key: string]: string };
}[] => {
  const result = flattenMarkdownString(
    markdownString,
    (token) => token.type === "code"
  );

  const codesblocks = result
    .map((token) => {
      if (token.type !== "code") return;

      const { text, lang } = token;

      const [ext, ...meta] = lang ? (lang as string).trim().split(" ") : [];
      const parameters = Object.fromEntries(
        meta.map((chunk) => {
          const key = chunk.split("=")[0].trim();
          const value0 = chunk.split("=").slice(1).join("=").trim();
          const isQuoted =
            (value0.startsWith('"') && value0.endsWith('"')) ||
            (value0.startsWith("'") && value0.endsWith("'"));

          const value = isQuoted ? value0.slice(1, value0.length - 1) : value0;

          return [key, value];
        })
      );

      return { text, lang: ext, parameters };
    })
    .filter((x) => !!x)
    .map((x) => x!);

  return codesblocks;
};

/**
 * Generates a catchy title for an AI interaction using OpenAI's GPT-4.1 Mini
 * Silently falls back to a default title if any errors occur
 */
async function generateTitleWithAI(
  contextContent,
  apiKey
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
        model: "gpt-5-mini-2025-08-07",
        messages: [{ role: "user", content: titlePrompt }],
      }),
    });

    // If request failed, log warning and return default
    if (!response.ok) {
      const errorData: any = await response.json().catch(() => ({}));
      console.warn(
        `OpenAI API error: ${errorData.error?.message || response.statusText}`
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
        /```(?:\w*\s*)?\s*([\s\S]*?)\s*```/
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
  OPENAI_SECRET: string;
  ASSETS: Fetcher;
  RATELIMIT_DO: DurableObjectNamespace<RatelimitDO>;
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
  type: "init" | "token" | "update" | "complete" | "error";
  data:
    | SSEInitData
    | SSETokenData
    | SSEUpdateData
    | SSECompleteData
    | SSEErrorData;
  timestamp: number;
}

// Init event - sent when streaming starts
export interface SSEInitData {
  type: "init";
  prompt: string;
  model: string;
  context?: string | null;
  status: "pending" | "streaming" | "complete" | "error";
  result: string;
  error?: string | null;
}

// Token event - sent for each new token/chunk
export interface SSETokenData {
  type: "token";
  text: string;
  position: number;
}

// Update event - sent when fields are updated
export interface SSEUpdateData {
  type: "update";
  field: string;
  value: string;
}

// Complete event - sent when processing finishes
export interface SSECompleteData {
  type: "complete";
  result: string;
}

// Error event - sent when an error occurs
export interface SSEErrorData {
  type: "error";
  message: string;
  stack?: string;
}

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
  extra?: object;
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
    })
  );

  // Construct context
  context = urlResults.reduce(
    (previous, { url, text, tokens }) =>
      `${previous}\n${url} (${tokens} tokens) \n${
        previous.length > 1024 * 1024 ? "Omitted due to context length." : text
      }\n`,
    ""
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
  }) {
    // Save each field to storage
    this.set("pathname", data.pathname);
    const prompt = data.prompt.slice(0, 1024 * 1024);
    this.set("frontMatter", this.parseFrontMatter(prompt).frontMatter);

    // cut prompt at 1mb = 200k tokens - use content without front matter
    this.set("prompt", prompt);
    this.set("modelConfig", data.model);
    this.set("initialized", true);

    // NB: Magic! already get started as soon as it is submitted
    this.state.waitUntil(this.stream(data.user, true));

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
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
      timestamp: Date.now(),
    };

    return new Response(JSON.stringify(currentResult), {
      headers: { "Content-Type": "application/json" },
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

      let { context } = await generateContext(prompt);
      //overwite prompt_id
      context = context?.replaceAll("{{prompt_id}}", pathname.slice(1));

      console.log("GOT CONTEXT", context?.length);
      // generate title after we have the context

      const markdown = getMarkdownResponse(pathname, {
        model: modelConfig.model,
        prompt: prompt,
        context: context,
      });

      this.ctx.waitUntil(
        generateTitleWithAI(markdown, this.env.OPENAI_SECRET).then((data) => {
          //   console.log("GOT HEADLINE", data.title);
          this.set("headline", data.title);
        })
      );

      // Fetch all URLs in parallel
      if (context) {
        this.set("context", context);
        this.set("prompt", prompt.slice(0, 1024 * 1024));
        // Send context update
        this.broadcastEvent("update", {
          type: "update",
          field: "context",
          value: context,
        });
      }

      const isCloudflare = modelConfig.providerSlug === "cloudflare";

      const content = prompt.replaceAll("{{prompt_id}}", pathname.slice(1));

      // Prepare LLM request
      const messages = [
        ...(context ? [{ role: "system", content: context }] : []),
        {
          role: "user",
          content: this.parseFrontMatter(content).content,
        },
      ];

      let priceAtOutput: number | undefined = undefined;

      const titleTokens = Math.round(markdown.length / 5);
      const titleCostPerToken = 0.5 / 1000000;
      const titlePrice = titleTokens * titleCostPerToken;

      const inputTokens =
        Math.round((context?.length || 0) / 5) + Math.round(prompt.length / 5);
      const inputPrice =
        inputTokens * (modelConfig.pricePerMillionInput / 1000000);
      const fullUrl = `${modelConfig.basePath}/chat/completions`;

      console.log("gonna do request ", fullUrl);

      const { fetchProxy } = chatCompletionsProxy(this.env, {
        baseUrl: "https://contextarea.com",
        userId: user?.userId,
        clientInfo: LMPIFY_CLIENT,
      });

      const mcpUrls = frontMatter?.mcp
        ? frontMatter.mcp
            .split(",")
            .map((x) => "https://" + x.trim())
            .filter((x) => {
              try {
                new URL(x);
                return true;
              } catch (e) {
                return false;
              }
            })
        : undefined;

      const tools =
        mcpUrls?.length && user?.userId
          ? mcpUrls.map((server_url) => ({ type: "mcp", server_url }))
          : undefined;
      console.log({ tools });
      const llmResponse = await fetchProxy(fullUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelConfig.model,
          messages,
          stream: true,
          stream_options: { include_usage: true },
          tools,

          ...(modelConfig.extra && { ...modelConfig.extra }),
          ...(isCloudflare
            ? {
                max_tokens:
                  modelConfig.maxTokens -
                  Math.round(JSON.stringify(messages).length / 5),
              }
            : {}),
        }),
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
                    position: position++,
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
                    position: position++,
                  });

                  reasoningBuffer = "";
                }
                continue;
              }
            }

            if (parsed.choices?.[0]?.delta?.content) {
              token = parsed.choices[0].delta.content;
            } else if (parsed.usage?.completion_tokens) {
              console.log(
                "chatgpt output tokens",
                parsed.usage.completion_tokens
              );

              priceAtOutput =
                parsed.usage.completion_tokens *
                (modelConfig.pricePerMillionOutput / 1000000);
            } else if (parsed.type === "error") {
              throw new Error("Error during stream: " + JSON.stringify(parsed));
            }

            // Send regular content tokens
            if (token) {
              this.accumulatedData += token;
              this.broadcastEvent("token", {
                type: "token",
                text: token,
                position: position++,
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
          position: position++,
        });
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
        type: "error",
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
          error: "Error:" + error.message,
          timestamp: Date.now(),
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
    totalCost: number
  ) {
    this.set("streamComplete", true);

    // Send complete event
    this.broadcastEvent("complete", {
      type: "complete",
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
      totalCost
    );

    if (user?.userId) {
      const { charge } = await getStripeflareUser(
        user.userId,
        this.env,
        this.ctx.waitUntil
      );

      const { charged, message } = await charge(totalCost, true);
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
    data: any
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
    { name: "Bing", userAgentRegex: /bingbot/ },
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

const getMarkdownResponse = (
  pathname: string,
  data: KVData,
  key?: string | null,
  codeblock?: string | null
) => {
  if (key) {
    // allow returning a specific key
    const value = data[key];

    if (!value) {
      if (!["prompt", "result", "context"].includes(key)) {
        return "Please provide key prompt, result, or context";
      }
      return `${key} not found.`;
    }

    if (codeblock) {
      const codeblocks = findCodeblocks(value);
      const selected = !isNaN(Number(codeblock))
        ? codeblocks[Number(codeblock)].text
        : codeblocks.find((item) => item.parameters.path === codeblock)?.text;
      if (!selected) {
        return "Codeblock not found. Please provide the index (number) or filename that was specified using 'path' parameter";
      }

      return selected;
    }

    return value;
  }

  let markdownResponse = `# ${data.headline || pathname}\n\n`;

  // Add prompt section
  // TODO: Find longest fence character count
  const longestFenceCharacterCount = 3;
  const fence =
    longestFenceCharacterCount > 10
      ? "~~~"
      : "`".repeat(longestFenceCharacterCount + 1);

  markdownResponse += `## Prompt\n\n${fence}md path="prompt.md"\n`;
  markdownResponse += data.prompt;
  markdownResponse += `\n${fence}\n\n`;

  // Add context section if available
  if (data.context) {
    const longestFenceCharacterCount = 3;
    const fence =
      longestFenceCharacterCount > 10
        ? "~~~"
        : "`".repeat(longestFenceCharacterCount + 1);

    markdownResponse += `## Context\n\n${fence}md path="context.md"\n`;

    markdownResponse += data.context;
    markdownResponse += `\n${fence}\n\n`;
  }

  // Add result section if available
  if (data.result) {
    const longestFenceCharacterCount = 3;
    const fence =
      longestFenceCharacterCount > 10
        ? "~~~"
        : "`".repeat(longestFenceCharacterCount + 1);

    markdownResponse += `## Result\n\n${fence}md path="result.md"\n`;
    markdownResponse += data.result;
    markdownResponse += `\n${fence}\n\n`;
  } else {
    markdownResponse += "## Status\n\n";
    markdownResponse += `Model: ${data.model}\n`;
  }
  return markdownResponse;
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
      {
        headers,
      }
    );
  }

  const scriptData = {
    ...data,
    //user: publicUser,
    status,
    streaming: status !== "complete",
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
  ctx: UserContext
): Promise<Response> => {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const acceptHeader = request.headers.get("Accept") || "*/*";

  // Get model configuration

  const userId = ctx.user?.id || null;

  const t = Date.now();
  // Apply stripeflare middleware
  const { charge, ...user } = await getStripeflareUser(
    userId,
    env,
    ctx.waitUntil
  );

  console.log({ stripeMiddlewareMs: Date.now() - t, user });

  const { idpMiddleware } = chatCompletionsProxy(env, {
    baseUrl: "https://contextarea.com",
    userId,
    clientInfo: LMPIFY_CLIENT,
    pathPrefix: "/mcp",
  });

  const idpResponse = await idpMiddleware(request, env, ctx);
  if (idpResponse) {
    return idpResponse;
  }

  // Only accept POST and GET methods
  if (!["POST", "GET"].includes(request.method)) {
    return new Response("Method not allowed", { status: 405 });
  }

  const pathnameWithoutExt = pathname.split(".")[0];

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
        new Headers()
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

    // Logged out should get 5 requests per hour, then login first.
    const requestLimit = (user?.balance || 0) <= 0 ? 5 : 1000;

    if (request.method === "POST" && !result.prompt) {
      const formData = await request.formData();
      prompt = formData?.get("prompt")?.toString();
      const modelName = formData?.get("model")?.toString();
      console.log("received submission", modelName);

      // NB: submit this to /chat/completions from here!
      if (!prompt) {
        console.log("missing prompt");
        return new Response("Missing prompt", { status: 400, headers: {} });
      }

      const modelConfig =
        providers.find((m) => m.model === modelName) || providers[0];

      model = modelConfig?.model;

      const userNeedsPayment =
        (modelConfig.premium || (user && user.balance > 0)) &&
        (!user?.balance || user.balance <= 0);

      const clientIp =
        request.headers.get("CF-Connecting-IP") ||
        request.headers.get("X-Forwarded-For")?.split(",")[0].trim() ||
        "127.0.0.1";

      const ratelimited = await env.RATELIMIT_DO.get(
        env.RATELIMIT_DO.idFromName("v2." + clientIp)
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
            user,
            status: "error",
            ratelimited: true,
            error: hasWaitTime
              ? "You have reached the ratelimit. Please purchase tokens to continue."
              : "You have spent all your tokens. Please purchase tokens to continue.",
            streaming: false,
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
                'Bearer realm="LMPIFY",' +
                'error="rate_limit_exceeded",' +
                'error_description="Rate limit exceeded. Please purchase credit at https://contextarea.com for higher limits"',
            },
          }
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
      console.log("GET METHOD got details", {
        promptLength: prompt?.length || 0,
        model,
      });
    }

    const data: KVData = {
      model: model || providers[0].model,
      prompt,
      context,
      headline: result.headline || undefined,
    };
    return getResult(request, env, data, "pending", new Headers());
  } catch (error) {
    console.error("Error in fetch handler:", error);
    return new Response("Internal server error", { status: 500, headers: {} });
  }
};

export default {
  fetch: withSimplerAuth<Env>(
    async (request: Request, env: Env, ctx: UserContext) => {
      const url = new URL(request.url);
      const pathname = url.pathname;
      console.log({ pathname });
      if (pathname === "/stripe-webhook") {
        return handleStripeWebhook(request, env, ctx);
      }

      return requestHandler(request as any, env, ctx);
    }
  ),
};
