it's quite complex
does it make sense to do all /chat/completions in DOs?
lets go back to the drawing board first and see what i want exactly.
addressable-in-stream, storable, priced
also if i'd add tools support and MCP (and context?), what would that do to adressability? this is difficult

deterministic from input isn't even needed per se. what's important is that you end up at the right URL, and you can just refresh.

---

Also how does the Agent library fit into all of this?

Also the hierarchical markdown output from mcp use in /chat/completions

DOES `[/id]/chat/completions` need to be addressable, and even stored, for that matter? Maybe, all that's important is the payments, and we can just proxy things. There seems no need for direct addressability here, and should probably only store if `store:true`. All that matters is:

- get system prompt and mcp from ID if provided
- url expansion
- charging
- if MCP provided, either return 401 or attach MCP actually
