# idp-middleware

OAuth identity provider middleware for Cloudflare Workers. Manages per-user authentication tokens for MCP servers and context URLs, stored in Durable Objects with SQLite.

## What it does

AI applications need to access resources on behalf of users — MCP servers that require OAuth, protected APIs referenced in conversation context, etc. This middleware handles the full OAuth lifecycle so your application doesn't have to:

1. **OAuth discovery & registration** — Discovers protected resource metadata, authorization server metadata, and registers clients via CIMD or dynamic registration
2. **PKCE authorization flows** — Constructs authorization URLs, handles callbacks, exchanges codes for tokens
3. **Token storage & refresh** — Persists tokens per user per profile in Durable Object SQLite, refreshes automatically when expiring
4. **Profile isolation** — Users can have multiple profiles (e.g. "work", "personal"), each with their own set of registered servers and tokens

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────────────┐
│  Your App   │────>│  idp-middleware   │────>│  Durable Object (DO) │
│             │     │                  │     │  per user            │
│             │     │  OAuth flows     │     │  SQLite tables:      │
│             │     │  Token refresh   │     │   - mcp_servers      │
│             │     │  Auth headers    │     │   - context          │
│             │     │                  │     │   - user_profiles    │
└─────────────┘     └──────────────────┘     └──────────────────────┘
```

One Durable Object instance per user. Each DO stores MCP servers and context entries across multiple profiles, with full OAuth credentials (client_id, tokens, endpoints).

## Core API

### `createIdpMiddleware(config, env)`

Creates the middleware handlers for a given user session. Returns:

- **`middleware(request, env, ctx)`** — Handles `/oauth/login/*` and `/oauth/callback/*` routes
- **`getMcpServers()`** / **`getContextEntries()`** — List all registered entries
- **`getAuthorizationForMcpServer(url)`** / **`getAuthorizationForContext(url)`** — Get auth headers for a URL
- **`refreshMcpServers(urls)`** / **`refreshContextEntries(urls)`** — Bulk token refresh
- **`removeMcpServer(url, profile)`** / **`removeContext(url, profile)`** — Remove entries

### `fetchUrlContext(content, userId, profile, env)`

Extracts all URLs and markdown links from a string, then fetches each one with appropriate authentication.

For each URL:
- Fetches directly — if the resource is unprotected, returns the content immediately
- On 401, discovers the protected resource metadata to find the canonical `resource` URL (what's stored in the DB), looks up stored tokens, refreshes if needed, and retries with auth

Returns `{ status: 200, results: [{ url, content }] }` on success, or `{ status: 401, error, url }` on first auth failure.

This is the key primitive for AI context injection — paste URLs into a prompt, and this function resolves them into actual content with per-user OAuth handled transparently.

### `createTools(servers, userId, profile, env)`

Resolves authorization for an array of MCP servers. For each `{ server_url }`:
- Looks up the server in the user's profile
- Refreshes the token if expiring within 5 minutes
- Returns `{ server_url, status: 200, authorization }` with the Bearer header ready to use
- Returns `404` if the server isn't registered, `401` if no valid token

This lets you pass MCP server URLs and get back auth headers without managing tokens yourself.

### Standalone helpers

- **`getAuthorizationForMcpServer(env, userId, serverUrl, profile, options)`** — Get auth or login URL for an MCP server
- **`getAuthorizationForContext(env, userId, contextUrl, profile, options)`** — Same for context entries
- **`constructAuthorizationUrl(...)`** — Build an OAuth authorization URL with full PKCE + discovery
- **`exchangeCodeForToken(...)`** / **`refreshAccessToken(...)`** — Token exchange primitives

## How profiles work

Every server and context entry is scoped to a `(url, profile)` pair. A user might have:

- Profile `"work"` with a GitHub MCP server authenticated via their org SSO
- Profile `"personal"` with the same GitHub MCP server authenticated via personal account

All lookups (`findMcpServerForUrl`, `findContextForUrl`, etc.) require a profile, ensuring tokens from different contexts never leak across.

## OAuth flow

When a user adds a protected resource:

1. The middleware probes the URL for a `401` response
2. Parses the `WWW-Authenticate` header for `resource_metadata`
3. Fetches `/.well-known/oauth-protected-resource` to discover the authorization server
4. Fetches `/.well-known/oauth-authorization-server` for endpoints
5. Registers as a client (CIMD or dynamic registration)
6. Redirects the user to authorize with PKCE (S256)
7. Handles the callback, exchanges the code for tokens
8. Stores everything in the DO

For public/unprotected resources, the middleware detects this (via a successful HEAD or MCP initialize handshake) and stores them without tokens.

## Setup

```toml
# wrangler.toml
name = "idp-middleware"
main = "dashboard.ts"
compatibility_date = "2025-12-01"

[durable_objects]
bindings = [
  { name = "OAuthProviders", class_name = "OAuthProviders" }
]

[[migrations]]
tag = "v1"
new_sqlite_classes = ["OAuthProviders"]
```

The `dashboard.ts` file provides a standalone management UI for testing — login, add/remove servers and context entries, switch profiles. For production, import `createIdpMiddleware` and the helper functions into your own worker.
