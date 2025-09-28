# First version - 2025-09-22

- ✅ Create a simple HTML frontend.
- 🤔 The API can only be used when we have the same X User ID as what the user gets when logging in here for a tool and this is NOT guaranteed, unless we actually teach developers of this API to use the oauth provider first to get the X user ID. IDK if this is the preferred way of doing things. ✅ make it a cloudflare middleware that works with any oauth!
- ✅ Do not support any `require_approval` other than `never`
- ✅ Do not succeed if `stream:true` not provided
- ✅ Better logging when MCP doesn't succeed and has error.
- ✅ Fix why linear/notion don't work
- 🤔 Look how long MCP init takes when immediately breaking up and when not. If it's useful/possible, reuse the session from the discovery to speed things up!
- 🤔 It was very slow because we kept the SSE Stream open. Should be closed after receiving response!
- ✅ Much faster now!
- ✅ Cleaned up lines (1400 --> 800)
- ✅ Explore the best way to provide the tool response event. Ideally it's not in the markdown, but more details are provided in a standardized way.

# Improvements (2025-09-28)

🤔 Design it so people can ALSO just use anyones hosted version! If they want different oauth, self host. If not, fine! This is mega-powerful.. Is this the right abstraction, or is it more useful to have a separate resource idp (maybe even protocol agnostic, just oauth2.1) and then automatically provide and keep up-to-date the access tokens before calling the MCP endpoint?

- ✅ Ensure the refactored code works
- ✅ Adhere to `max_tokens` throughout tool steps
- ✅ Ensure the Oauth Callback page is set to a success page that says "You've authorized using this MCP" or something.
- ✅ Create a way for users to manage their logged in MCPs so they can also re-scope it (not part of the middleware though, just provide as functions)
- ✅ Add in token refresh functionality into `universal-mcp-oauth` and refresh tokens asynchronously when starting the stream.
  - ✅ maybe adding a proxy (/mcp/proxy/{url}) that performs refresh if token is expired will be best?
  - ✅ maybe just expose a function `refreshTokenIfNeeded(provider)` or even `stub.getFreshProviders(mcpUrls:string[]):Promise<MCPProvider[]>`
