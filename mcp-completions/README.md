Add MCP-Tool calling and tool execution **with authentication** to any LLM via a simple fetch-proxy.

```ts
import { chatCompletionsProxy, MCPProviders } from "mcp-completions";
import { OpenAI } from "openai";
// Export DO
export { MCPProviders };
export default {
  fetch: async (request, env, ctx) => {
    // Just use mcps without auth and it'll just work!
    const {
      // this can also be fetched directly!
      fetchProxy,
      idpMiddleware,
      // use these to build an interface to manage user connections
      getProviders,
      removeMcp,
    } = chatCompletionsProxy(env, {
      baseUrl: new URL(request.url).origin,
      // use your own oauth to get a user ID here to store mcp login per user
      // (or, if desired, add multiple profiles per user by adding a suffix to it)
      userId: "admin",
      clientInfo: {
        name: "MCP Completions Demo",
        title: "MCP Completions Demo",
        version: "1.0.0",
      },
    });

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
      // any mcp with oauth is supported
      tools: [{ type: "mcp", server_url: "https://mcp.notion.com/mcp" }] as any,
    });

    return new Response(stream.toReadableStream(), {
      headers: { "content-type": "text/event-stream;charset=utf8" },
    });
  },
};
```

If the MCP server requires authentication, you should get a response with a markdown login link. Once authenticated, the tools will execute automatically and their results will appear as markdown in the assistant's response stream.

As of now, it only works on Cloudflare Workers due to storage constraints.

Demo live at: https://demo.connectconnector.com
