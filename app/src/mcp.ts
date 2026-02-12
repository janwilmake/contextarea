import { createStorage, type IdpKV } from "./idp-middleware";
import { findCodeblocks } from "./getMarkdownResponse";
import type { StripeUser } from "./stripeflare-simple";
import type { SQLStreamPromptDO } from "./main";

//@ts-ignore
import providers from "../public/providers.json";

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

interface Env {
  IDP_KV: KVNamespace;
  SQL_STREAM_PROMPT_DO: DurableObjectNamespace<SQLStreamPromptDO>;
  RESULTS: KVNamespace;
  [key: string]: any;
}

interface McpUser {
  id: string;
  username: string;
}

interface JsonRpcRequest {
  jsonrpc: string;
  id?: string | number | null;
  method: string;
  params?: any;
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

function jsonRpcResponse(id: string | number | null, result: any) {
  return Response.json({ jsonrpc: "2.0", id, result });
}

function jsonRpcError(
  id: string | number | null,
  code: number,
  message: string
) {
  return Response.json({ jsonrpc: "2.0", id, error: { code, message } });
}

function extractLastCodeblock(text: string): string | null {
  const blocks = findCodeblocks(text);
  if (blocks.length === 0) return null;
  return blocks[blocks.length - 1].text;
}

const TOOL_DEFINITIONS = [
  {
    name: "list_mcps",
    description:
      "List all MCP servers connected to the user's Context Area account",
    inputSchema: { type: "object" as const, properties: {} }
  },
  {
    name: "prompt",
    description:
      "Send a prompt to an LLM model. Returns an ID to check the result with check_result. You can use URLs as context in your prompt and reference MCP servers using @mcp_url.",
    inputSchema: {
      type: "object" as const,
      properties: {
        model: {
          type: "string",
          description:
            "Model name (e.g. 'deepseek-chat'). Defaults to first available model."
        },
        prompt: { type: "string", description: "The prompt to send" }
      },
      required: ["prompt"]
    }
  },
  {
    name: "check_result",
    description:
      "Check the result of a previously submitted prompt by its ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: {
          type: "string",
          description: "The prompt ID returned by the prompt tool"
        },
        type: {
          type: "string",
          enum: ["full", "last_file"],
          description:
            "Result type: 'full' returns the complete response, 'last_file' extracts the last code block from the response."
        }
      },
      required: ["id", "type"]
    }
  }
];

export async function handleMcpRequest(
  request: Request,
  env: Env,
  user: McpUser | undefined,
  stripeflareUser: StripeUser | undefined
): Promise<Response> {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      }
    });
  }

  // Auth check - trigger MCP OAuth discovery flow
  if (!user) {
    const resourceMetadataUrl = `https://contextarea.com/.well-known/oauth-protected-resource`;
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32000,
          message: "Authentication required"
        }
      }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "WWW-Authenticate": `Bearer resource_metadata="${resourceMetadataUrl}"`
        }
      }
    );
  }

  let body: JsonRpcRequest;
  try {
    body = await request.json<JsonRpcRequest>();
  } catch {
    return jsonRpcError(null, -32700, "Parse error");
  }

  if (body.jsonrpc !== "2.0" || !body.method) {
    return jsonRpcError(body.id ?? null, -32600, "Invalid Request");
  }

  const { method, id, params } = body;

  // --- initialize ---
  if (method === "initialize") {
    return jsonRpcResponse(id ?? null, {
      protocolVersion: "2025-11-25",
      capabilities: { tools: {} },
      serverInfo: {
        name: "Context Area",
        version: "1.0.0",
        title: "Context Area",
        websiteUrl: "https://contextarea.com",
        icons: [
          {
            src: "https://contextarea.com/apple-touch-icon.png",
            sizes: ["180x180", "any"],
            mimeType: "image/png"
          }
        ]
      }
    });
  }

  // --- notifications/initialized ---
  if (method === "notifications/initialized") {
    return new Response(null, { status: 202 });
  }

  // --- tools/list ---
  if (method === "tools/list") {
    return jsonRpcResponse(id ?? null, { tools: TOOL_DEFINITIONS });
  }

  // --- tools/call ---
  if (method === "tools/call") {
    const toolName = params?.name;
    const args = params?.arguments || {};

    if (!toolName) {
      return jsonRpcError(id ?? null, -32602, "Missing tool name");
    }

    try {
      const result = await handleToolCall(
        toolName,
        args,
        env,
        user,
        stripeflareUser
      );
      return jsonRpcResponse(id ?? null, result);
    } catch (err: any) {
      return jsonRpcResponse(id ?? null, {
        content: [{ type: "text", text: `Error: ${err.message}` }],
        isError: true
      });
    }
  }

  return jsonRpcError(id ?? null, -32601, `Method not found: ${method}`);
}

async function handleToolCall(
  toolName: string,
  args: any,
  env: Env,
  user: McpUser,
  stripeflareUser: StripeUser | undefined
): Promise<any> {
  switch (toolName) {
    case "list_mcps": {
      const kv = kvFromNamespace(env.IDP_KV);
      const storage = createStorage(kv, user.id);
      const servers = await storage.getAllMcpServers();
      const list = servers.map((s: any) => ({
        url: s.url,
        name: s.name,
        profile: s.profile
      }));
      return {
        content: [{ type: "text", text: JSON.stringify(list, null, 2) }]
      };
    }

    case "prompt": {
      const { id } = await setupPrompt(env, args, stripeflareUser);
      return {
        content: [{ type: "text", text: JSON.stringify({ id }) }]
      };
    }

    case "check_result": {
      const { id, type } = args;
      if (!id) throw new Error("Missing id");
      if (!type || !["full", "last_file"].includes(type))
        throw new Error("type must be 'full' or 'last_file'");

      const pathname = `/${id}`;
      const doId = env.SQL_STREAM_PROMPT_DO.idFromName(pathname);
      const doStub = env.SQL_STREAM_PROMPT_DO.get(doId);

      let data: any;
      const deadline = Date.now() + 60000;
      while (Date.now() < deadline) {
        const res = await doStub.fetch(new Request("https://do/current"));
        data = await res.json();
        if (data.status === "complete" || data.status === "error") break;
        await new Promise((r) => setTimeout(r, 1000));
      }

      if (data.status === "complete" && data.result) {
        if (type === "last_file") {
          const codeblock = extractLastCodeblock(data.result);
          if (codeblock) {
            return { content: [{ type: "text", text: codeblock }] };
          }
          return {
            content: [
              {
                type: "text",
                text:
                  "No code block found in result. Full result:\n\n" +
                  data.result
              }
            ]
          };
        }
        return { content: [{ type: "text", text: data.result }] };
      }

      if (data.status === "error") {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${data.error || "Unknown error"}`
            }
          ],
          isError: true
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ status: "processing", id })
          }
        ]
      };
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

async function setupPrompt(
  env: Env,
  args: { model?: string; prompt: string },
  stripeflareUser: StripeUser | undefined
): Promise<{ url: string; doStub: any; id: string }> {
  const promptId = crypto.randomUUID().slice(0, 12);
  const pathname = `/${promptId}`;

  const modelConfig: ModelConfig =
    providers.find((m: any) => m.model === args.model) || providers[0];

  const doId = env.SQL_STREAM_PROMPT_DO.idFromName(pathname);
  const doStub = env.SQL_STREAM_PROMPT_DO.get(doId);

  await doStub.setup({
    pathname,
    prompt: args.prompt,
    model: modelConfig,
    user: stripeflareUser,
    store: true
  });

  const url = `https://contextarea.com${pathname}`;
  return { url, doStub, id: promptId };
}
