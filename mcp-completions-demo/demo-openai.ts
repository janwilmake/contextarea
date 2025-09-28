import { chatCompletionsProxy, MCPProviders } from "./user-chat-completion";
import { OpenAI } from "openai";
export { MCPProviders };
export default {
  fetch: async (request, env, ctx) => {
    // Just use mcps without auth and it'll just work!
    const { fetchProxy, idpMiddleware } = await chatCompletionsProxy(
      request,
      env,
      ctx,
      {
        userId: "admin",
        clientInfo: {
          name: "OpenAI Demo",
          title: "OpenAI Demo",
          version: "1.0.0",
        },
      }
    );

    const middlewareResponse = await idpMiddleware(request, env, ctx);
    if (middlewareResponse) {
      return middlewareResponse;
    }

    const client = new OpenAI({
      baseURL: "https://api.openai.com/v1",
      apiKey: env.OPENAI_API_KEY,
      fetch: fetchProxy,
    });

    const stream = await client.chat.completions.create({
      messages: [
        { role: "user", content: "Hi, what tools do you have available?" },
      ],
      stream: true,
      stream_options: { include_usage: true },
      model: "gpt-5",
      tools: [{ type: "mcp", server_url: "https://mcp.notion.com/mcp" }] as any,
    });

    return new Response(stream.toReadableStream(), {
      headers: { "content-type": "text/event-stream;charset=utf8" },
    });
  },
};
