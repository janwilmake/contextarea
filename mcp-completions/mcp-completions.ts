import {
  getAuthorization,
  getMCPProviders,
  MCPProviders,
  createMCPOAuthHandler,
  MCPOAuthEnv,
  MCPProvider,
} from "universal-mcp-oauth";

export { MCPProviders };

interface MCPTool {
  type: "mcp";
  server_url: string;
  allowed_tools?: { tool_names: string[] };
  require_approval?: "never";
}

export interface ChatCompletionRequest {
  model: string;
  messages: Array<{
    role: "system" | "user" | "assistant" | "tool" | "function";
    content?: string | null;
    name?: string;
    tool_calls?: Array<{
      id: string;
      type: "function";
      function: { name: string; arguments: string };
    }>;
    tool_call_id?: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  max_completion_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  stream?: boolean;
  stream_options?: {
    include_usage?: boolean;
  };
  tools?: Array<
    | {
        type: "function";
        function: {
          name: string;
          description?: string;
          parameters?: Record<string, any>;
        };
      }
    | MCPTool
  >;
  tool_choice?:
    | "none"
    | "auto"
    | { type: "function"; function: { name: string } };
  user?: string;
  [key: string]: any;
}

interface MCPSession {
  sessionId?: string;
  initialized: boolean;
  tools?: Array<{
    name: string;
    description?: string;
    inputSchema?: any;
    // optional
    outputSchema?: any;
  }>;
}

interface UsageStats {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

const mcpSessions = new Map<string, MCPSession>();

async function parseMCPResponse(response: Response): Promise<any> {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("text/event-stream")) {
    if (!response.body) throw new Error("No response body for event stream");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value);
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || trimmedLine.startsWith(":")) continue;

          if (trimmedLine.startsWith("data: ")) {
            const data = trimmedLine.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.jsonrpc === "2.0") {
                reader.releaseLock();
                return parsed;
              }
            } catch {}
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
    throw new Error("No valid JSON-RPC response received from event stream");
  } else {
    const responseText = await response.text();
    if (!responseText.trim()) throw new Error("Empty response body");
    try {
      return JSON.parse(responseText);
    } catch {
      throw new Error(`Invalid JSON response: ${responseText}`);
    }
  }
}

function createErrorStream(content: string, requestId: string, model: string) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      const chunks = [
        { delta: { role: "assistant" } },
        { delta: { content } },
        { delta: {}, finish_reason: "stop" },
      ];

      for (const [i, chunk] of chunks.entries()) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              id: requestId,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model,
              choices: [
                {
                  index: 0,
                  ...chunk,
                  finish_reason: chunk.finish_reason || null,
                },
              ],
            })}\n\n`
          )
        );
        if (i < chunks.length - 1) await new Promise((r) => setTimeout(r, 10));
      }

      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

async function initializeMCPSession(
  serverUrl: string,
  userId: string,
  env: any
) {
  const authHeaders = await getAuthorization(env, userId, serverUrl);
  const mcpHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json,text/event-stream",
    "MCP-Protocol-Version": "2025-06-18",
    ...(authHeaders?.Authorization && {
      Authorization: authHeaders.Authorization,
    }),
  };

  // Initialize
  const initResponse = await fetch(serverUrl, {
    method: "POST",
    headers: mcpHeaders,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: { roots: { listChanged: true }, sampling: {} },
        clientInfo: { name: "ChatCompletionsProxy", version: "1.0.0" },
      },
    }),
  });

  if (!initResponse.ok) throw new Error(`Init failed: ${initResponse.status}`);

  const initResult = await parseMCPResponse(initResponse);
  if (initResult.error)
    throw new Error(`Init error: ${initResult.error.message}`);

  const sessionId = initResponse.headers.get("Mcp-Session-Id");
  if (sessionId) mcpHeaders["Mcp-Session-Id"] = sessionId;

  // Send initialized notification
  await fetch(serverUrl, {
    method: "POST",
    headers: mcpHeaders,
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    }),
  });

  // List tools
  const toolsResponse = await fetch(serverUrl, {
    method: "POST",
    headers: mcpHeaders,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now() + 1,
      method: "tools/list",
    }),
  });

  const toolsResult = await parseMCPResponse(toolsResponse);
  if (toolsResult.error)
    throw new Error(`Tools list error: ${toolsResult.error.message}`);

  return { sessionId, tools: toolsResult.result?.tools || [] };
}

export const chatCompletionsProxy = async (
  request: Request,
  env: any,
  ctx: ExecutionContext,
  config: {
    userId: string;
    clientInfo: {
      name: string;
      title: string;
      version: string;
    };
  }
): Promise<{
  fetchProxy: (
    input: RequestInfo | URL,
    init?: RequestInit
  ) => Promise<Response>;
  idpMiddleware: (
    request: Request,
    env: any,
    ctx: ExecutionContext
  ) => Promise<Response | null>;
  removeMcp: (url: string) => Promise<void>;
  getProviders: () => Promise<
    (MCPProvider & {
      tools:
        | {
            name: string;
            inputSchema: any;
            description: string;
          }[]
        | null;
      reauthorizeUrl: string;
    })[]
  >;
}> => {
  const { userId, clientInfo } = config;
  const url = new URL(request.url);

  // Create MCP OAuth handler
  const { middleware, getProviders, refreshProviders, removeMcp } =
    createMCPOAuthHandler(
      {
        userId,
        clientInfo,
        baseUrl: url.origin,
      },
      env
    );

  const idpMiddleware = async (
    request: Request,
    env: any,
    ctx: ExecutionContext
  ) => {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/mcp/")) {
      return await middleware(request, env as MCPOAuthEnv, ctx);
    }

    return null;
  };

  const fetchProxy = async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const llmEndpoint = typeof input === "string" ? input : input.toString();
    const headers = init?.headers ? new Headers(init.headers) : new Headers();

    // Properly handle the request body
    let body: ChatCompletionRequest;
    try {
      if (init?.body) {
        let bodyText: string;

        if (typeof init.body === "string") {
          bodyText = init.body;
        } else if (init.body instanceof ReadableStream) {
          // Read the stream
          const reader = init.body.getReader();
          const decoder = new TextDecoder();
          let result = "";

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              result += decoder.decode(value, { stream: true });
            }
            result += decoder.decode(); // Final decode
            bodyText = result;
          } finally {
            reader.releaseLock();
          }
        } else if (init.body instanceof ArrayBuffer) {
          bodyText = new TextDecoder().decode(init.body);
        } else if (init.body instanceof Uint8Array) {
          bodyText = new TextDecoder().decode(init.body);
        } else {
          // For other types (FormData, URLSearchParams, etc.)
          bodyText = init.body.toString();
        }

        body = JSON.parse(bodyText);
      } else {
        throw new Error("No request body provided");
      }
    } catch (error) {
      console.error("Error parsing request body:", error);
      return new Response(
        JSON.stringify({
          error: {
            message: "Invalid JSON in request body",
            type: "invalid_request_error",
          },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const requestId = `chatcmpl-${Date.now()}`;

    if (!body.stream) {
      return new Response(
        JSON.stringify({
          error: {
            message: "This middleware requires stream: true to be set",
            type: "invalid_request_error",
          },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (body.tools) {
      const mcpTools = body.tools.filter((x) => x.type === "mcp");
      const invalidMcpTools = mcpTools.filter(
        (x) => (x.require_approval || "never") !== "never" || !x.server_url
      );
      if (invalidMcpTools.length > 0) {
        return new Response(
          JSON.stringify({
            error: {
              message: "Invalid MCP tools",
              type: "invalid_request_error",
            },
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    try {
      let mcpToolMap:
        | Map<string, { serverUrl: string; originalName: string }>
        | undefined;

      if (body.tools?.length) {
        const mcpProviders = await getMCPProviders(env, userId);
        const transformedTools: Array<any> = [];
        const toolMap = new Map<
          string,
          { serverUrl: string; originalName: string }
        >();
        const missingAuth: string[] = [];

        for (const tool of body.tools) {
          if (tool.type === "function") {
            transformedTools.push(tool);
          } else if (tool.type === "mcp") {
            const provider = mcpProviders.find(
              (x) => x.mcp_url === tool.server_url
            );
            if (!provider?.access_token) {
              missingAuth.push(tool.server_url);
              continue;
            }

            for (const mcpTool of provider.tools || []) {
              if (
                tool.allowed_tools?.tool_names &&
                !tool.allowed_tools.tool_names.includes(mcpTool.name)
              )
                continue;

              const functionName = `mcp_${provider.hostname.replaceAll(
                ".",
                "-"
              )}_${mcpTool.name}`;
              toolMap.set(functionName, {
                serverUrl: tool.server_url,
                originalName: mcpTool.name,
              });

              transformedTools.push({
                type: "function",
                function: {
                  name: functionName,
                  description: `${
                    mcpTool.description || mcpTool.name
                  } (via MCP server: ${provider.name})`,
                  parameters: mcpTool.inputSchema || {},
                },
              });
            }
          }
        }

        if (missingAuth.length) {
          const loginLinks = missingAuth
            .map(
              (x) =>
                `- [Authorize ${new URL(x).hostname}](${
                  url.origin
                }/mcp/login?url=${encodeURIComponent(x)})`
            )
            .join("\n");
          const content = `# MCP Server Authentication Required\n\nTo use the requested MCP tools, you need to authenticate with the following servers:\n\n${loginLinks}\n\nAfter authentication, retry your request.`;
          return new Response(
            createErrorStream(content, requestId, body.model),
            {
              headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
              },
            }
          );
        }

        // Refresh providers that we're about to use (only authenticated ones)
        const authenticatedUrls = mcpProviders
          .filter((p) => p.access_token)
          .map((p) => p.mcp_url);

        if (authenticatedUrls.length > 0) {
          await refreshProviders(authenticatedUrls);
          // Re-fetch providers after refresh to get updated tokens
          const refreshedProviders = await getMCPProviders(env, userId);
          // Update mcpProviders with refreshed data
          for (const refreshed of refreshedProviders) {
            const index = mcpProviders.findIndex(
              (p) => p.mcp_url === refreshed.mcp_url
            );
            if (index >= 0) {
              mcpProviders[index] = refreshed;
            }
          }
        }

        body.tools = transformedTools;
        mcpToolMap = toolMap;
      }

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            let currentMessages = [...body.messages];
            let remainingTokens = body.max_completion_tokens || body.max_tokens;
            const userRequestedUsage = body.stream_options?.include_usage;
            const totalUsage: UsageStats = {
              prompt_tokens: 0,
              completion_tokens: 0,
              total_tokens: 0,
            };

            // Send initial role chunk
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  id: requestId,
                  object: "chat.completion.chunk",
                  created: Math.floor(Date.now() / 1000),
                  model: body.model,
                  choices: [
                    {
                      index: 0,
                      delta: { role: "assistant" },
                      finish_reason: null,
                    },
                  ],
                })}\n\n`
              )
            );

            while (remainingTokens === undefined || remainingTokens > 0) {
              const stepBody = { ...body };
              stepBody.messages = currentMessages;

              // Set the remaining tokens for this step
              if (remainingTokens !== undefined) {
                if (body.max_completion_tokens) {
                  stepBody.max_completion_tokens = remainingTokens;
                } else if (body.max_tokens) {
                  stepBody.max_tokens = remainingTokens;
                }
              }

              // Always request usage from downstream API to track tokens properly
              stepBody.stream_options = { include_usage: true };

              const response = await fetch(llmEndpoint, {
                method: "POST",
                headers,
                body: JSON.stringify(stepBody),
              });

              if (!response.ok) {
                const message = await response.text();
                throw new Error(
                  `API request failed: ${llmEndpoint} - ${response.status} - ${message}`
                );
              }

              if (!response.body) throw new Error("No response body");

              const reader = response.body.getReader();
              const decoder = new TextDecoder();
              let buffer = "";
              let assistantMessage = "";
              let toolCalls: Array<{
                id: string;
                name: string;
                arguments: any;
              }> = [];
              let toolCallBuffer = new Map<number, any>();
              let finished = false;
              let stepUsage: UsageStats | null = null;

              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;

                  buffer += decoder.decode(value);
                  const lines = buffer.split("\n");
                  buffer = lines.pop() || "";

                  for (const line of lines) {
                    if (!line.startsWith("data: ") || line === "data: [DONE]")
                      continue;

                    try {
                      const data = JSON.parse(line.slice(6));
                      const choice = data.choices[0];

                      // Capture usage information if present (but don't forward it)
                      if (data.usage) {
                        stepUsage = data.usage;
                        continue; // Don't forward usage chunks to client
                      }

                      if (
                        choice?.delta?.content ||
                        choice.delta?.refusal ||
                        choice.delta?.reasoning_content
                      ) {
                        assistantMessage += choice.delta.content || "";
                        controller.enqueue(
                          encoder.encode(
                            `data: ${JSON.stringify({
                              id: requestId,
                              object: "chat.completion.chunk",
                              created: Math.floor(Date.now() / 1000),
                              model: body.model,
                              choices: [
                                {
                                  index: 0,
                                  delta: {
                                    content: choice.delta.content,
                                    refusal: choice.delta.refusal,
                                    reasoning_content:
                                      choice.delta.reasoning_content,
                                  },
                                  finish_reason: null,
                                },
                              ],
                            })}\n\n`
                          )
                        );
                      }

                      if (choice?.delta?.tool_calls) {
                        for (const toolCall of choice.delta.tool_calls) {
                          const toolIndex = toolCall.index;
                          if (!toolCallBuffer.has(toolIndex)) {
                            toolCallBuffer.set(toolIndex, {
                              id: "",
                              name: "",
                              arguments: "",
                            });
                          }
                          const bufferedCall = toolCallBuffer.get(toolIndex);
                          if (toolCall.id) bufferedCall.id = toolCall.id;
                          if (toolCall.function?.name)
                            bufferedCall.name += toolCall.function.name;
                          if (toolCall.function?.arguments)
                            bufferedCall.arguments +=
                              toolCall.function.arguments;
                        }
                      }

                      if (choice?.finish_reason === "tool_calls") {
                        for (const bufferedCall of toolCallBuffer.values()) {
                          if (bufferedCall.name && bufferedCall.arguments) {
                            try {
                              toolCalls.push({
                                id: bufferedCall.id,
                                name: bufferedCall.name,
                                arguments: JSON.parse(bufferedCall.arguments),
                              });
                            } catch (e) {
                              console.error(
                                "Error parsing tool call arguments:",
                                e
                              );
                            }
                          }
                        }
                        break;
                      }

                      if (choice?.finish_reason === "stop") {
                        finished = true;
                        break;
                      }

                      if (choice?.finish_reason === "length") {
                        finished = true;
                        break;
                      }
                    } catch {}
                  }
                }
              } finally {
                reader.releaseLock();
              }

              // Update total usage
              if (stepUsage) {
                totalUsage.prompt_tokens += stepUsage.prompt_tokens;
                totalUsage.completion_tokens += stepUsage.completion_tokens;
                totalUsage.total_tokens += stepUsage.total_tokens;

                // Update remaining tokens
                if (remainingTokens !== undefined) {
                  remainingTokens -= stepUsage.completion_tokens;
                }
              }

              if (assistantMessage || toolCalls.length) {
                const assistantMsg: any = {
                  role: "assistant",
                  content: assistantMessage || null,
                };

                if (toolCalls.length) {
                  assistantMsg.tool_calls = toolCalls.map((tc) => ({
                    id: tc.id,
                    type: "function",
                    function: {
                      name: tc.name,
                      arguments: JSON.stringify(tc.arguments),
                    },
                  }));
                }

                currentMessages.push(assistantMsg);
              }

              if (!toolCalls.length || finished) break;

              // Check if we've run out of tokens
              if (remainingTokens !== undefined && remainingTokens <= 0) {
                break;
              }

              // Execute tool calls
              for (const toolCall of toolCalls) {
                if (
                  mcpToolMap?.has(toolCall.name) &&
                  toolCall.name.startsWith("mcp_")
                ) {
                  const toolInfo = mcpToolMap.get(toolCall.name)!;
                  const hostname = new URL(toolInfo.serverUrl).hostname;

                  // Stream tool input
                  const toolInput = `\n\n<details><summary>🔧 ${
                    toolInfo.originalName
                  } (${hostname})</summary>\n\n\`\`\`json\n${JSON.stringify(
                    toolCall.arguments,
                    null,
                    2
                  )}\n\`\`\`\n\n</details>`;
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        id: requestId,
                        object: "chat.completion.chunk",
                        created: Math.floor(Date.now() / 1000),
                        model: body.model,
                        choices: [
                          {
                            index: 0,
                            delta: { content: toolInput },
                            finish_reason: null,
                          },
                        ],
                      })}\n\n`
                    )
                  );

                  try {
                    const sessionKey = `${userId}:${toolInfo.serverUrl}`;
                    let session = mcpSessions.get(sessionKey);

                    if (!session?.initialized) {
                      const sessionData = await initializeMCPSession(
                        toolInfo.serverUrl,
                        userId,
                        env
                      );
                      session = {
                        sessionId: sessionData.sessionId,
                        initialized: true,
                        tools: sessionData.tools,
                      };
                      mcpSessions.set(sessionKey, session);
                    }

                    const authHeaders = await getAuthorization(
                      env,
                      userId,
                      toolInfo.serverUrl
                    );
                    const executeHeaders: Record<string, string> = {
                      "Content-Type": "application/json",
                      Accept: "application/json,text/event-stream",
                      "MCP-Protocol-Version": "2025-06-18",
                      ...(authHeaders?.Authorization && {
                        Authorization: authHeaders.Authorization,
                      }),
                      ...(session.sessionId && {
                        "Mcp-Session-Id": session.sessionId,
                      }),
                    };

                    const toolResponse = await fetch(toolInfo.serverUrl, {
                      method: "POST",
                      headers: executeHeaders,
                      body: JSON.stringify({
                        jsonrpc: "2.0",
                        id: Date.now(),
                        method: "tools/call",
                        params: {
                          name: toolInfo.originalName,
                          arguments: toolCall.arguments,
                        },
                      }),
                    });

                    if (toolResponse.status === 404 && session.sessionId) {
                      mcpSessions.delete(sessionKey);
                      throw new Error(
                        "Session expired, please retry the request"
                      );
                    }

                    if (!toolResponse.ok) {
                      if (toolResponse.status === 401) {
                        throw new Error(
                          `# MCP Server Authentication Required\n\nAuthentication failed for ${hostname}. Please re-authenticate:\n\n- [Authorize ${hostname}](${
                            url.origin
                          }/mcp/login?url=${encodeURIComponent(
                            toolInfo.serverUrl
                          )})\n\nAfter authentication, retry your request.`
                        );
                      } else {
                        const errorText = await toolResponse.text();
                        throw new Error(
                          `Tool ${toolInfo.originalName} failed with status ${toolResponse.status}: ${errorText}`
                        );
                      }
                    }

                    const toolResult = await parseMCPResponse(toolResponse);
                    if (toolResult.error) {
                      throw new Error(
                        `${toolResult.error.message} (code: ${toolResult.error.code})`
                      );
                    }

                    // Format result
                    const content = toolResult.result?.content;
                    let formattedResult: string;

                    if (!content || !Array.isArray(content)) {
                      const jsonString = JSON.stringify(toolResult, null, 2);
                      formattedResult = `<details><summary>Error Result (±${Math.round(
                        jsonString.length / 5
                      )} tokens)</summary>\n\n\`\`\`json\n${jsonString}\n\`\`\`\n\n</details>\n\nTool returned invalid response structure`;
                    } else {
                      const contentBlocks = content
                        .map((item) => {
                          if (item.type === "text") {
                            try {
                              const parsed = JSON.parse(item.text);
                              return `\`\`\`json\n${JSON.stringify(
                                parsed,
                                null,
                                2
                              )}\n\`\`\``;
                            } catch {
                              return `\`\`\`markdown\n${item.text}\n\`\`\``;
                            }
                          } else if (item.type === "image") {
                            return `\`\`\`\n[Image: ${item.data}]\n\`\`\``;
                          } else {
                            return `\`\`\`json\n${JSON.stringify(
                              item,
                              null,
                              2
                            )}\n\`\`\``;
                          }
                        })
                        .join("\n\n");

                      const totalSize = content.reduce((size, item) => {
                        return (
                          size +
                          (item.type === "text"
                            ? item.text?.length || 0
                            : JSON.stringify(item).length)
                        );
                      }, 0);

                      formattedResult = `<details><summary>Result (±${Math.round(
                        totalSize / 5
                      )} tokens)</summary>\n\n${contentBlocks}\n\n</details>`;
                    }

                    currentMessages.push({
                      role: "tool",
                      tool_call_id: toolCall.id,
                      content: formattedResult,
                    });

                    // Stream result
                    const toolFeedback = `\n\n${formattedResult}\n\n`;
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({
                          id: requestId,
                          object: "chat.completion.chunk",
                          created: Math.floor(Date.now() / 1000),
                          model: body.model,
                          choices: [
                            {
                              index: 0,
                              delta: { content: toolFeedback },
                              finish_reason: null,
                            },
                          ],
                        })}\n\n`
                      )
                    );
                  } catch (error) {
                    const errorMsg = `**Error**: ${error.message}`;
                    currentMessages.push({
                      role: "tool",
                      tool_call_id: toolCall.id,
                      content: errorMsg,
                    });

                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({
                          id: requestId,
                          object: "chat.completion.chunk",
                          created: Math.floor(Date.now() / 1000),
                          model: body.model,
                          choices: [
                            {
                              index: 0,
                              delta: { content: `\n\n${errorMsg}\n\n` },
                              finish_reason: null,
                            },
                          ],
                        })}\n\n`
                      )
                    );
                  }
                }
              }
            }

            // Send final chunk with usage only if user requested it
            const finalChunk: any = {
              id: requestId,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model: body.model,
              choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
            };

            if (userRequestedUsage && totalUsage.total_tokens > 0) {
              finalChunk.usage = totalUsage;
            }

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(finalChunk)}\n\n`)
            );

            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          } catch (error) {
            console.error("Stream error:", error);
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
    } catch (error) {
      console.error("Proxy error:", error);
      return new Response(
        JSON.stringify({
          error: { message: "Internal server error", type: "internal_error" },
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  };

  return { fetchProxy, idpMiddleware, getProviders, removeMcp };
};
