# CONSIDER THE FOLLOWING PROMPT

{{PROMPT}}

# Consider the business logic, tools, and resources available

Available Tools:

- Slack (no access right now)
- Google Drive (no access right now)
- Linear: https://mcp.linear.app/mcp (we have lots of tickets inhere)
- Notion: https://mcp.notion.com/mcp
- Parallel tasks: https://task-mcp.parallel.ai
- Web Search: https://search-mcp.parallel.ai
- X CRM: https://crm.grok-tools.com/mcp
- X feed data: https://markdownfeed.com/mcp
- GitHub: https://api.githubcopilot.com/mcp <!-- this is SSE so need better alternative-->
- uithub MCP: https://mcp.uithub.com/mcp <!--gottamakethis! Should have tools and resources of logged in users for high level overview of repos with useful filter to reduce context-->
- OpenAPI MCP server: https://server.smithery.ai/@janwilmake/openapi-mcp-server/mcp (use this to discover other OpenAPIs)
- CURL MCP: https://curlmcp.com/mcp (use this for doing any API calls) <!-- killer addition: let users log in so authorization header can be omitted -->

Resources & Prompts:

<!-- If MCPs have them available they should be added as well, but it may require login -->

- Parallel Docs: https://docs.parallel.ai/llms.txt (if we need this, we also need curl mcp)

# Your task

Come up with the relevant MCP servers and tools needed and return it as `{tools:{type:"mcp",tools_available:string[], url:string}[],context:string}`.
