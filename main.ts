// @ts-check
/// <reference types="@cloudflare/workers-types" />

import {
  Env as StripeflareEnv,
  stripeBalanceMiddleware,
  type StripeUser,
} from "stripeflare";
export { DORM } from "stripeflare";
//@ts-ignore
import shareHtml from "./share.html";
//@ts-ignore
import homepageHtml from "./homepage.html";
//@ts-ignore
import resultHtml from "./result.html";

/**
 * Extended environment interface including both stripeflare and original env variables
 */
interface Env extends StripeflareEnv {
  RESULTS: KVNamespace; // KV namespace for storing results
  PROCESS_QUEUE: Queue; // Queue for processing requests
  MODEL: string;
  BASE_PATH: string;
  ANTHROPIC_SECRET: string;
  GEMINI_SECRET: string;
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
  pending: boolean; // Whether the request is still being processed
  prompt: string; // The user's prompt
  model: {
    model: string;
    basePath: string;
    apiKey: string;
  };
  context?: string;
  result?: string; // The result from the LLM (when completed)
  error?: string; // Error message if processing failed
}

/**
 * Queue message structure
 */
interface QueueMessage {
  pathname: string;
  prompt: string;
  model: { model: string; basePath: string; apiKey: string; premium?: boolean };
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

/**
 * Helper function to inject window.data into HTML
 */
function injectWindowData(html: string, data: any): string {
  const scriptTag = `<script>window.data = ${JSON.stringify(data)};</script>`;
  return html.replace("</head>", `${scriptTag}</head>`);
}

export default {
  /**
   * Main fetch handler for the Cloudflare Worker
   */
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Apply stripeflare middleware
    const result = await stripeBalanceMiddleware<User>(
      request,
      env,
      ctx,
      migrations,
    );

    // If middleware returned a response (webhook or db api), return it directly
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
      // Check if result already exists in KV
      const existingData = (await env.RESULTS.get(
        pathname,
        "json",
      )) as KVData | null;

      if (existingData) {
        // Return result.html with the KV data and user data injected
        let html = resultHtml;
        html = injectWindowData(html, {
          ...existingData,
          user,
        });

        headers.set("Content-Type", "text/html");
        return new Response(html, { headers });
      }

      // If no existing data and it's a GET request, show the form
      if (request.method === "GET") {
        let html = homepageHtml;
        html = injectWindowData(html, { user });

        headers.set("Content-Type", "text/html");
        return new Response(html, { headers });
      }

      // Process POST request
      const formData = await request.formData();
      const prompt = formData.get("prompt");
      const models = [
        {
          //models/
          model: "gemini-2.5-flash-preview-04-17",
          basePath: "https://generativelanguage.googleapis.com/v1beta/openai",
          apiKey: env.GEMINI_SECRET,
        },
        {
          model: "claude-3.7-sonnet",
          basePath: "https://api.anthropic.com",
          apiKey: env.ANTHROPIC_SECRET,
          premium: true,
        },
      ];

      const model = formData.get("model")
        ? models.find((x) => x.model === formData.get("model")) || models[0]
        : models[0];

      if (model.premium && (!user.balance || user.balance <= 0)) {
        return new Response("Payment required", {
          status: 402,
          headers,
        });
      }

      // Validate required fields
      if (!prompt) {
        return new Response("Missing prompt", {
          status: 400,
          headers,
        });
      }

      // Store initial data in KV
      const kvData: KVData = {
        pending: true,
        prompt: String(prompt),
        model,
      };

      await env.RESULTS.put(pathname, JSON.stringify(kvData));

      // Send to queue for processing
      const queueMessage: QueueMessage = {
        pathname,
        prompt: String(prompt),
        model,
      };

      await env.PROCESS_QUEUE.send(queueMessage);

      // Return the share.html page with user data
      let html = shareHtml;
      html = injectWindowData(html, { user });

      headers.set("Content-Type", "text/html");
      return new Response(html, { headers });
    } catch (error) {
      console.error("Error in fetch handler:", error);
      return new Response("Internal server error", { status: 500, headers });
    }
  },

  /**
   * Queue handler for processing LLM requests
   */
  async queue(
    batch: MessageBatch<QueueMessage>,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    for (const message of batch.messages) {
      try {
        let { pathname, prompt, model } = message.body;

        console.log("Entered queue", message.body);

        // Extract URLs from the prompt using regex
        const urlRegex =
          /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
        const urls = prompt.match(urlRegex) || [];

        // Fetch all URLs in parallel
        const urlFetches = urls.map(async (url) => {
          try {
            const response = await fetch(url);
            const text = await response.text();
            const tokens = Math.round(text.length / 5);
            return { url, text, tokens };
          } catch (error: any) {
            console.error(`Failed to fetch ${url}:`, error);
            return {
              url,
              text: `Failed to fetch: ${error.message}`,
              tokens: 0,
              failed: true,
            };
          }
        });

        const urlResults = await Promise.all(urlFetches);

        // Construct context from URL content
        let context = "";
        if (urlResults.length > 0) {
          context = urlResults
            .map(
              ({ url, text, tokens }) =>
                `${url} (${tokens} tokens) \n${text}\n------\n`,
            )
            .join("\n");

          prompt = urlResults.reduce((previous, current) => {
            return current.failed
              ? previous
              : previous.replace(
                  current.url,
                  `${current.url} (${current.tokens} tokens)`,
                );
          }, prompt);
        }

        console.log("GONNA CALL LLM");

        // Call the LLM API
        const llmResponse = await fetch(`${model.basePath}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${model.apiKey}`,
          },
          body: JSON.stringify({
            model: model.model,
            messages: [
              ...(context ? [{ role: "system", content: context }] : []),
              { role: "user", content: prompt },
            ],
          }),
        });

        if (!llmResponse.ok) {
          const updatedData: KVData = {
            pending: false,
            prompt,
            context,
            model,
            error: await llmResponse.text(),
          };

          await env.RESULTS.put(pathname, JSON.stringify(updatedData));

          message.ack();
          return;
        }

        const llmData = (await llmResponse.json()) as any;
        const result = llmData.choices[0].message.content;

        // Update KV with the result
        const updatedData: KVData = {
          pending: false,
          prompt,
          context,
          model,
          result,
        };

        await env.RESULTS.put(pathname, JSON.stringify(updatedData));

        // Acknowledge the message
        message.ack();
      } catch (error: any) {
        console.error("Error processing message:", error);

        // Update KV with error
        const errorData: KVData = {
          pending: false,
          prompt: message.body.prompt,
          model: message.body.model,
          error: error.message,
        };

        await env.RESULTS.put(message.body.pathname, JSON.stringify(errorData));

        // Still acknowledge the message to prevent reprocessing
        message.ack();
      }
    }
  },
};
