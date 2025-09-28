Usage in any cloudflare project:

```ts
import { createMCPOAuthHandler, MCPProviders } from "universal-mcp-oauth";
// Export the DO that maintains state
export { MCPProviders } from "universal-mcp-oauth";
// In your worker, create a handler that maintains the state for a given user-id
const mcpHandler = createMCPOAuthHandler({ userId: "user123" });
const response = await mcpHandler(request, env, ctx);
```
