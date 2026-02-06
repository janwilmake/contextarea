const getInstructions = (id: string, data: KVData, access_token: string) => {
  return `You can use this prompt as system prompt using the following endpoint:

System Prompt:

\`\`\`
${data.prompt}
\`\`\`

The prompt will be URL-expanded and used as system prompt for the generation. URLs never get cached by us, so its content can be dynamic if desired.

## OpenAI Compatible API

\`\`\`sh
curl -X POST "https://contextarea.com/${id}/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${access_token}" \
  -d '{
    "model": "${data.model}",
    "stream":true,
    "messages": [
      {
        "role": "user",
        "content": "Who are you?"
      }
    ]
  }'
\`\`\`

This is a fully OpenAI Compatible API:

\`\`\`javascript
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: "${access_token}",   // Your LMPIFY API key
    baseURL: "https://contextarea.com/${id}",
});

const response = await openai.chat.completions.create({
    messages: [
        { role: "user", content: "Who are you?" }
    ],
    model: "${data.model}",
});

console.log(response.choices[0].message.content);
\`\`\`

## MCP Server

You can also use this prompt as an MCP (Model Context Protocol) server. The MCP server provides the same functionality through the standardized MCP protocol.

**MCP Server Address:**
\`\`\`
https://contextarea.com/${id}/mcp
\`\`\`

**Using with Cursor:**

Add this to your Cursor MCP configuration:

\`\`\`json
{
  "mcpServers": {
    "lmpify-${id}": {
      "url": "https://contextarea.com/${id}/mcp",
      "headers": {
        "Authorization": "Bearer ${access_token}"
      }
    }
  }
}
\`\`\`

**Using with other MCP clients:**

The MCP server implements the standard Model Context Protocol and can be used with any MCP-compatible client by connecting to the server URL above with your bearer token for authentication.

## Additional Options

Optionally, it's possible to provide "store:true" in your API requests. This will store the final result in our cache, making it available at https://contextarea.com/{id}. The ID is part of the response JSON like normal.

`;
};

if (url.pathname.endsWith("/chat/completions")) {
  if (request.method === "GET") {
    const url = new URL(request.url);

    // Extract ID from pathname if provided (e.g., /abc123/chat/completions)
    const pathParts = url.pathname.split("/");
    const id =
      pathParts.length > 2 && pathParts[1] !== "chat"
        ? pathParts[1]
        : undefined;
    const pathname = `/${id}`;
    const existingData = (await env.RESULTS.get(
      pathname,
      "json"
    )) as KVData | null;

    if (!existingData) {
      return new Response("Not found", { status: 404 });
    }
    return new Response(getInstructions(id, existingData, "API_KEY"));
  }
}

interface ChatCompletionsRequest {
  model: string;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  stream?: boolean;
  [key: string]: any;
}

interface ChatCompletionsResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message?: {
      role: string;
      content: string;
    };
    delta?: {
      content?: string;
    };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
Implement this. it should
- ensure to be authenticated with stripe user
- ensure sufficient balance. all models are premium in this endpoint
- get prompt from ID if provided and expand urls on it
- also expand urls on messages (all in parallel)
- for streaming, count tokens to get to total price in same way, and charge user at the end. do not alter anything in response, but clone it to count tokens
- for non streaming, also get total usage at the end and charge for that
- do not differentiate between anthropic and others, anthropic also works with /chat/completions now
- ensure to just pass on the whole body to the /chat/completions endpoint, except you should pass {stream_options:{include_usage:true}} incase we stream:true
 */
export async function handleChatCompletions(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  user: User | undefined,
  headers: Headers
): Promise<Response> {
  const url = new URL(request.url);

  // Extract ID from pathname if provided (e.g., /abc123/chat/completions)
  const pathParts = url.pathname.split("/");
  const id =
    pathParts.length > 2 && pathParts[1] !== "chat" ? pathParts[1] : undefined;

  // Ensure user is authenticated
  if (!user?.access_token) {
    return new Response(
      JSON.stringify({
        error: {
          message: "Authentication required",
          type: "authentication_error",
          code: "unauthenticated",
        },
      }),
      {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      }
    );
  }

  // Check if user has sufficient balance (all models are premium)
  if (!user.balance || user.balance <= 0) {
    return new Response(
      JSON.stringify({
        error: {
          message: "Insufficient balance. Please purchase tokens to continue.",
          type: "insufficient_quota",
          code: "insufficient_balance",
        },
      }),
      {
        status: 402,
        headers: { ...headers, "Content-Type": "application/json" },
      }
    );
  }

  let body: ChatCompletionsRequest;
  try {
    body = await request.json();
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: {
          message: "Invalid JSON in request body",
          type: "invalid_request_error",
          code: "invalid_json",
        },
      }),
      {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      }
    );
  }

  // Find model configuration
  const modelConfig = providers.find((p) => p.model === body.model);
  if (!modelConfig) {
    return new Response(
      JSON.stringify({
        error: {
          message: `Model '${body.model}' not found`,
          type: "invalid_request_error",
          code: "model_not_found",
        },
      }),
      {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      }
    );
  }

  try {
    // Get prompt from ID if provided and expand URLs
    let expandedMessages = body.messages;

    if (id) {
      const pathname = `/${id}`;
      const existingData = (await env.RESULTS.get(
        pathname,
        "json"
      )) as KVData | null;

      if (existingData?.prompt) {
        // Expand URLs in the stored prompt
        const systemIndex = expandedMessages.findIndex(
          (x) => x.role === "system"
        );
        if (systemIndex === -1) {
          expandedMessages = [
            { role: "system", content: existingData.prompt },
            ...expandedMessages,
          ];
        } else {
          expandedMessages[systemIndex] = {
            ...expandedMessages[systemIndex],
            content: `${existingData.prompt}${expandedMessages[systemIndex].content}`,
          };
        }
      }
    }

    console.log("before adding context", { expandedMessages });

    // Expand URLs in all messages (in parallel)
    const expandPromises = expandedMessages.map(async (message) => {
      if (message.role === "user" || message.role === "system") {
        const { context } = await generateContext(message.content);
        if (context) {
          return {
            ...message,
            content: message.content + "\n\n" + context,
          };
        }
      }
      return message;
    });

    expandedMessages = await Promise.all(expandPromises);

    // Calculate input tokens for pricing
    const inputContent = expandedMessages.map((m) => m.content).join("\n");
    const inputTokens = Math.round(inputContent.length / 5);
    const inputPrice =
      inputTokens * (modelConfig.pricePerMillionInput / 1000000);

    // Prepare request body for the LLM API
    const llmRequestBody = {
      ...body,
      messages: expandedMessages,
      ...(modelConfig.extra && { ...modelConfig.extra }),
      ...(body.store && { store: undefined }),
      ...(body.stream && { stream_options: { include_usage: true } }),
    };

    console.log({ model: modelConfig.model, llmRequestBody });

    // Get API key
    const envVariableName = `${modelConfig.providerSlug.toUpperCase()}_SECRET`;
    const apiKey = env[envVariableName];
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: {
            message: `API key not configured for ${modelConfig.providerSlug}`,
            type: "configuration_error",
            code: "missing_api_key",
          },
        }),
        {
          status: 500,
          headers: { ...headers, "Content-Type": "application/json" },
        }
      );
    }

    // Make request to the LLM API
    const llmResponse = await fetch(
      `${modelConfig.basePath}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(llmRequestBody),
      }
    );

    if (!llmResponse.ok) {
      const errorText = await llmResponse.text();
      return new Response(
        JSON.stringify({
          error: {
            message: `LLM API error: ${llmResponse.status} ${errorText}`,
            type: "api_error",
            code: "llm_api_error",
          },
        }),
        {
          status: llmResponse.status,
          headers: { ...headers, "Content-Type": "application/json" },
        }
      );
    }

    // Handle streaming response
    if (body.stream) {
      let outputTokens = 0;
      let fullMessage = "";
      let totalCost = 0;
      let id = undefined;
      const transformStream = new TransformStream({
        transform(chunk, controller) {
          // Clone the chunk to count tokens
          const chunkText = new TextDecoder().decode(chunk);
          const lines = chunkText.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                console.log("chunk", data);

                if (parsed.id) {
                  id = parsed.id;
                }
                // Count tokens from streaming response
                if (parsed.choices?.[0]?.delta?.content) {
                  const tokenCount = Math.round(
                    parsed.choices[0].delta.content.length / 5
                  );
                  fullMessage = fullMessage + parsed.choices[0].delta.content;
                  outputTokens += tokenCount;
                }

                // Get final usage if available
                if (parsed.usage?.completion_tokens) {
                  outputTokens = parsed.usage.completion_tokens;
                }
              } catch (e) {
                // Ignore parsing errors for streaming data
              }
            }
          }

          controller.enqueue(chunk);
        },
        flush() {
          // Calculate total cost and charge user
          const outputPrice =
            outputTokens * (modelConfig.pricePerMillionOutput / 1000000);
          totalCost = (inputPrice + outputPrice) * PRICE_MARKUP_FACTOR;

          const prompt = llmRequestBody.messages
            .map((x) => `${x.role}:\n\n${x.content}`)
            .join("\n\n");

          const final = async () => {
            // Charge user asynchronously

            const charged = await chargeUser(
              env,
              ctx,
              user.access_token,
              DORM_VERSION,
              totalCost,
              true
            );
            console.log({ charged, totalCost });

            if (body.store) {
              const kvData: KVData = {
                prompt,
                model: modelConfig.model,
                context: undefined,
                result: fullMessage,
                timestamp: Date.now(),
                headline: undefined,
              };
              const pathname = `/${id}`;
              await env.RESULTS.put(pathname, JSON.stringify(kvData));
            }
          };

          ctx.waitUntil(final());
        },
      });

      // Return the streaming response
      return new Response(llmResponse.body?.pipeThrough(transformStream), {
        status: llmResponse.status,
        headers: {
          ...headers,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Handle non-streaming response
    const responseData: ChatCompletionsResponse = await llmResponse.json();

    // Calculate output tokens and total cost
    const outputTokens = responseData.usage?.completion_tokens || 0;
    const outputPrice =
      outputTokens * (modelConfig.pricePerMillionOutput / 1000000);
    const totalCost = (inputPrice + outputPrice) * PRICE_MARKUP_FACTOR;
    const prompt = llmRequestBody.messages
      .map((x) => `${x.role}:\n\n${x.content}`)
      .join("\n\n");

    const final = async () => {
      // Charge user asynchronously

      // Charge user
      const charged = await chargeUser(
        env,
        ctx,
        user.access_token,
        DORM_VERSION,
        totalCost,
        true
      );

      console.log({ charged, totalCost });

      if (body.store) {
        const kvData: KVData = {
          prompt,
          model: modelConfig.model,
          context: undefined,
          result: responseData.choices?.[0]?.message?.content,
          timestamp: Date.now(),
          headline: undefined,
        };
        await env.RESULTS.put("/" + responseData.id, JSON.stringify(kvData));
      }
    };

    ctx.waitUntil(final());

    // Return the response
    return new Response(JSON.stringify(responseData), {
      status: llmResponse.status,
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Error in handleChatCompletions:", error);
    return new Response(
      JSON.stringify({
        error: {
          message: "Internal server error",
          type: "server_error",
          code: "internal_error",
        },
      }),
      {
        status: 500,
        headers: { ...headers, "Content-Type": "application/json" },
      }
    );
  }
}
