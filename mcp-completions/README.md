Add MCP-Tool calling and tool execution **with authentication** to any LLM via a simple fetch-proxy

```ts
export default {
  fetch: async (request, env, ctx) => {
    // Just use mcps without auth and it'll just work!
    const { fetchProxy, middleware } = await chatCompletionsProxy(
      request,
      env,
      ctx
    );

    const middlewareResponse = await middleware(request, env, ctx);
    if (middlewareResponse) {
      return middlewareResponse;
    }

    const client = new OpenAI({
      basePath: "https://api.openai.com/v1",
      fetch: fetchProxy,
      apiKey,
    });
    const result = await client.chat.completions.create({
      messages: [
        // stuff
      ],
      model: "gpt-5",
      tools: [{ type: "mcp", url: "https://mcp.notion.com/mcp" }] as any,
    });
  },
};
```

If the MCP server requires authentication, you should get a response with a markdown login link. Once authenticated, the tools will execute automatically and their results will appear as markdown in the assistant's response stream.

# Installation & Usage

```
npm i mcp-completions
```

Usage:

> [!TIP]
> Don't rely on this yet, breaking changes imminent!

See [demo.ts](../mcp-completions-demo/demo.ts)

Demo live at: https://demo.connectconnector.com
