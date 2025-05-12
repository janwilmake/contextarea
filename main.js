/**
 * create a cloudflare worker in js with doc-comments and //@check-ts and /// cloudflare worker types directive

it should

accept method post and get

check pathname and read kv key of that pathname. if already exist, return ./result.html content (import resultHtml from "./result.html"). add <script> with json of kv value to end of head.

if not:

get prompt, model, basePath, apiKey from FormData

serve share.html (import it using `import shareHtml from "./share.html")

set kv key pathname value {pending:true, prompt,model,basePath,apiKey}

send to queue with the formdata items gathered.

also, queue should:

read message body out

get all urls in the prompt using regex

fetch all urls in parallel, getting text back

the context is then constructed from the urls: format: {url}\n{text}\n------\n\n{url2}\n{text2}\n\n (etc)

do a call to llm using POST {basePath}/chat/completions with the context as system prompt (if any) and the prompt as first message content

the result is added to kv under key of pathname
 */

// @ts-check
/// <reference types="@cloudflare/workers-types" />

import shareHtml from "./share.html";
import indexHtml from "./index.html";
import resultHtml from "./result.html";

/**
 * @typedef {Object} Env
 * @property {KVNamespace} RESULTS - KV namespace for storing results
 * @property {Queue} PROCESS_QUEUE - Queue for processing requests
 * @property {string} MODEL
 * @property {string} BASE_PATH
 * @property {string} API_KEY
 */

/**
 * @typedef {Object} KVData
 * @property {boolean} pending - Whether the request is still being processed
 * @property {string} prompt - The user's prompt
 * @property {string} model - The model to use
 * @property {string} basePath - The API base path
 * @property {string} apiKey - The API key
 * @property {string} [result] - The result from the LLM (when completed)
 * @property {string} [error] - Error message if processing failed
 */

export default {
  /**
   * Main fetch handler for the Cloudflare Worker
   * @param {Request} request - The incoming request
   * @param {Env} env - The worker environment bindings
   * @param {ExecutionContext} ctx - The execution context
   * @returns {Promise<Response>} The response to send back
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Only accept POST and GET methods
    if (!["POST", "GET"].includes(request.method)) {
      return new Response("Method not allowed", { status: 405 });
    }

    try {
      // Check if result already exists in KV
      const existingData = await env.RESULTS.get(pathname, "json");

      if (existingData) {
        // Return result.html with the KV data injected
        let html = resultHtml;
        const scriptTag = `<script>window.kvData = ${JSON.stringify(
          existingData,
        )};</script>`;
        html = html.replace("</head>", `${scriptTag}</head>`);

        return new Response(html, {
          headers: { "Content-Type": "text/html" },
        });
      }

      // If no existing data and it's a GET request, show the form
      if (request.method === "GET") {
        return new Response(indexHtml, {
          headers: { "Content-Type": "text/html" },
        });
      }

      // Process POST request
      const formData = await request.formData();
      const prompt = formData.get("prompt");
      const model = formData.get("model") || env.MODEL;
      const basePath = formData.get("basePath") || env.BASE_PATH;
      const apiKey = formData.get("apiKey") || env.API_KEY;

      if (
        (formData.get("model") || formData.get("basePath")) &&
        !formData.get("apiKey")
      ) {
        return new Response(
          "API key not specified. Specify no model/basePath to use the free model",
          { status: 400 },
        );
      }

      // Validate required fields
      if (!prompt) {
        return new Response("Missing required fields", { status: 400 });
      }

      // Store initial data in KV
      /** @type {KVData} */
      const kvData = {
        pending: true,
        prompt: String(prompt),
        model: String(model),
        basePath: String(basePath),
        apiKey: String(apiKey),
      };

      await env.RESULTS.put(pathname, JSON.stringify(kvData));

      // Send to queue for processing
      await env.PROCESS_QUEUE.send({
        pathname,
        prompt: String(prompt),
        model: String(model),
        basePath: String(basePath),
        apiKey: String(apiKey),
      });

      // Return the share.html page
      return new Response(shareHtml, {
        headers: { "Content-Type": "text/html" },
      });
    } catch (error) {
      console.error("Error in fetch handler:", error);
      return new Response("Internal server error", { status: 500 });
    }
  },

  /**
   * Queue handler for processing LLM requests
   * @param {MessageBatch} batch - The batch of messages from the queue
   * @param {Env} env - The worker environment bindings
   * @param {ExecutionContext} ctx - The execution context
   */
  async queue(batch, env, ctx) {
    for (const message of batch.messages) {
      try {
        const { pathname, prompt, model, basePath, apiKey } = message.body;

        // Extract URLs from the prompt using regex
        const urlRegex =
          /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
        const urls = prompt.match(urlRegex) || [];

        // Fetch all URLs in parallel
        const urlFetches = urls.map(async (url) => {
          try {
            const response = await fetch(url);
            const text = await response.text();
            return { url, text };
          } catch (error) {
            console.error(`Failed to fetch ${url}:`, error);
            return { url, text: `Failed to fetch: ${error.message}` };
          }
        });

        const urlResults = await Promise.all(urlFetches);

        // Construct context from URL content
        let context = "";
        if (urlResults.length > 0) {
          context = urlResults
            .map(({ url, text }) => `${url}\n${text}\n------\n`)
            .join("\n");
        }

        // Call the LLM API
        const llmResponse = await fetch(`${basePath}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: model,
            messages: [
              ...(context ? [{ role: "system", content: context }] : []),
              { role: "user", content: prompt },
            ],
          }),
        });

        if (!llmResponse.ok) {
          throw new Error(
            `LLM API error: ${llmResponse.status} ${await llmResponse.text()}`,
          );
        }

        const llmData = await llmResponse.json();
        const result = llmData.choices[0].message.content;

        // Update KV with the result
        /** @type {KVData} */
        const updatedData = {
          pending: false,
          prompt,
          model,
          basePath,
          apiKey,
          result,
        };

        await env.RESULTS.put(pathname, JSON.stringify(updatedData));

        // Acknowledge the message
        message.ack();
      } catch (error) {
        console.error("Error processing message:", error);

        // Update KV with error
        /** @type {KVData} */
        const errorData = {
          pending: false,
          prompt: message.body.prompt,
          model: message.body.model,
          basePath: message.body.basePath,
          apiKey: message.body.apiKey,
          error: error.message,
        };

        await env.RESULTS.put(message.body.pathname, JSON.stringify(errorData));

        // Still acknowledge the message to prevent reprocessing
        message.ack();
      }
    }
  },
};
