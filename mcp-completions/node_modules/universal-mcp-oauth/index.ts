/// <reference types="@cloudflare/workers-types" />
/// <reference lib="esnext" />
import { DurableObject } from "cloudflare:workers";
import {
  constructMCPAuthorizationUrl,
  extractMCPServerInfo,
} from "mcp-client-server-registration";

export interface MCPOAuthEnv {
  MCPProviders: DurableObjectNamespace<MCPProviders>;
}

export interface MCPProvider extends Record<string, SqlStorageValue> {
  id: string;
  hostname: string;
  name: string;
  mcp_url: string;
  client_id?: string;
  client_secret?: string;
  access_token?: string;
  refresh_token?: string;
  token_endpoint?: string;
  token_type?: "Bearer" | string;
  expires_in?: number;
  created_at: string;
  updated_at: string;
  public?: 0 | 1;
  tools?: string; // JSON blob of tools array
}

export class MCPProviders extends DurableObject {
  sql: SqlStorage;

  constructor(state: DurableObjectState, env: any) {
    super(state, env);
    this.sql = state.storage.sql;
    this.migrate();
  }

  migrate() {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS providers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hostname TEXT NOT NULL,
        name TEXT NOT NULL,
        mcp_url TEXT NOT NULL UNIQUE,
        client_id TEXT,
        client_secret TEXT,
        access_token TEXT,
        refresh_token TEXT,
        token_endpoint TEXT,
        token_type TEXT DEFAULT 'Bearer',
        expires_in INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        public BOOLEAN DEFAULT 0,
        tools TEXT
      )
    `);

    // Add new columns if they don't exist (for existing databases)
    const columnsToAdd = ["tools", "refresh_token", "token_endpoint"];
    for (const column of columnsToAdd) {
      try {
        this.sql.exec(`ALTER TABLE providers ADD COLUMN ${column} TEXT`);
      } catch (e) {
        // Column already exists, ignore
      }
    }
  }

  async addProvider(
    hostname: string,
    name: string,
    mcpUrl: string,
    clientId?: string,
    clientSecret?: string,
    accessToken?: string,
    refreshToken?: string,
    tokenEndpoint?: string,
    expiresIn?: number,
    isPublic: boolean = false,
    tools?: any[]
  ) {
    const toolsJson = tools ? JSON.stringify(tools) : null;

    this.sql.exec(
      `
      INSERT OR REPLACE INTO providers 
      (hostname, name, mcp_url, client_id, client_secret, access_token, refresh_token, token_endpoint, expires_in, updated_at, public, tools)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
    `,
      hostname,
      name,
      mcpUrl,
      clientId || null,
      clientSecret || null,
      accessToken || null,
      refreshToken || null,
      tokenEndpoint || null,
      expiresIn || null,
      isPublic ? 1 : 0,
      toolsJson
    );
  }

  async updateProviderTokens(
    mcpUrl: string,
    accessToken: string,
    refreshToken?: string,
    expiresIn?: number
  ) {
    this.sql.exec(
      `UPDATE providers SET access_token = ?, refresh_token = ?, expires_in = ?, updated_at = CURRENT_TIMESTAMP WHERE mcp_url = ?`,
      accessToken,
      refreshToken || null,
      expiresIn || null,
      mcpUrl
    );
  }

  async getProvider(mcpUrl: string): Promise<MCPProvider | null> {
    const result = this.sql
      .exec<MCPProvider>(
        `SELECT * FROM providers WHERE mcp_url = ? LIMIT 1`,
        mcpUrl
      )
      .toArray()[0];

    return result || null;
  }

  async getProviders(mcpUrls: string[]): Promise<MCPProvider[]> {
    if (mcpUrls.length === 0) return [];

    const placeholders = mcpUrls.map(() => "?").join(",");
    return this.sql
      .exec<MCPProvider>(
        `SELECT * FROM providers WHERE mcp_url IN (${placeholders}) ORDER BY created_at DESC`,
        ...mcpUrls
      )
      .toArray();
  }

  async getAllProviders(): Promise<MCPProvider[]> {
    return this.sql
      .exec<MCPProvider>(`SELECT * FROM providers ORDER BY created_at DESC`)
      .toArray();
  }

  async removeProvider(mcpUrl: string) {
    this.sql.exec(`DELETE FROM providers WHERE mcp_url = ?`, mcpUrl);
  }

  async updateProviderTools(mcpUrl: string, tools: any[]) {
    const toolsJson = JSON.stringify(tools);
    this.sql.exec(
      `UPDATE providers SET tools = ?, updated_at = CURRENT_TIMESTAMP WHERE mcp_url = ?`,
      toolsJson,
      mcpUrl
    );
  }
}

export interface MCPOAuthConfig {
  /** Stable UserID to which the authenticated connections with MCP servers need to be saved to */
  userId: string;
  clientInfo: {
    name: string;
    title: string;
    version: string;
  };
  baseUrl?: string; // For custom callback URLs
  pathPrefix?: string; // Default: "/mcp"
}

const VERSION = "v6:";

export interface MCPOAuthHandlers {
  middleware: (
    request: Request,
    env: MCPOAuthEnv,
    ctx: ExecutionContext
  ) => Promise<Response | null>;
  removeMcp: (url: string) => Promise<void>;
  getProviders: () => Promise<
    (MCPProvider & {
      tools: { name: string; inputSchema: any; description: string }[] | null;
      reauthorizeUrl: string;
    })[]
  >;
  refreshProviders: (urls: string[]) => Promise<void>;
}

export function createMCPOAuthHandler(
  config: MCPOAuthConfig,
  env: MCPOAuthEnv
): MCPOAuthHandlers {
  const { userId, baseUrl, clientInfo, pathPrefix = "/mcp" } = config;

  const getMcpStub = () => {
    return env.MCPProviders.get(env.MCPProviders.idFromName(VERSION + userId));
  };

  const middleware = async (request: Request): Promise<Response | null> => {
    const url = new URL(request.url);
    const path = url.pathname;

    // Only handle MCP OAuth routes with the configured prefix
    if (!path.startsWith(pathPrefix + "/")) {
      return null;
    }

    const origin = baseUrl || url.origin;
    const mcpProviders = getMcpStub();

    if (path === `${pathPrefix}/login`) {
      return handleMCPLogin(
        request,
        mcpProviders,
        origin,
        clientInfo,
        pathPrefix
      );
    }

    if (path.startsWith(`${pathPrefix}/callback/`)) {
      const hostname = path.split(`${pathPrefix}/callback/`)[1];
      return handleMCPCallback(
        request,
        mcpProviders,
        hostname,
        origin,
        clientInfo,
        pathPrefix
      );
    }

    return null;
  };

  const removeMcp = async (url: string): Promise<void> => {
    const mcpProviders = getMcpStub();
    await mcpProviders.removeProvider(url);
  };

  const getProviders = async () => {
    const mcpProviders = getMcpStub();
    const providers = await mcpProviders.getAllProviders();

    // Parse tools JSON and add reauthorize URL for each provider
    return providers.map((provider) => ({
      ...provider,
      tools: provider.tools ? JSON.parse(provider.tools) : null,
      reauthorizeUrl: `${
        baseUrl || "https://example.com"
      }${pathPrefix}/login?url=${encodeURIComponent(provider.mcp_url)}`,
    }));
  };

  const refreshProviders = async (urls: string[]): Promise<void> => {
    const mcpProviders = getMcpStub();
    const providers = await mcpProviders.getProviders(urls);
    const now = Math.floor(Date.now() / 1000); // Current time in seconds

    // Only refresh providers that have expired tokens
    const expiredProviders = providers.filter((provider) => {
      if (
        !provider.refresh_token ||
        !provider.token_endpoint ||
        !provider.expires_in
      ) {
        return false;
      }

      // Calculate expiration time based on updated_at + expires_in
      const updatedAtSeconds = Math.floor(
        new Date(provider.updated_at).getTime() / 1000
      );
      const expirationTime = updatedAtSeconds + provider.expires_in;

      // Only refresh if token has expired (with a 5 minute buffer)
      return now >= expirationTime - 300;
    });

    // Refresh tokens in parallel
    const refreshPromises = expiredProviders.map(async (provider) => {
      try {
        const tokenData = await refreshAccessToken(
          provider.refresh_token!,
          provider.client_id,
          provider.client_secret,
          provider.token_endpoint!
        );

        await mcpProviders.updateProviderTokens(
          provider.mcp_url,
          tokenData.access_token,
          tokenData.refresh_token || provider.refresh_token,
          tokenData.expires_in
        );
      } catch (error) {
        console.error(
          `Failed to refresh token for ${provider.mcp_url}:`,
          error
        );
        // Continue with other providers even if one fails
      }
    });

    await Promise.all(refreshPromises);
  };

  return {
    middleware,
    removeMcp,
    getProviders,
    refreshProviders,
  };
}

function createSuccessHTML(
  serverName: string,
  autoClose: boolean = false
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MCP Authentication Success</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }
        .card {
            background: white;
            border-radius: 12px;
            padding: 32px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
            text-align: center;
            max-width: 400px;
            width: 100%;
        }
        .success-icon {
            width: 48px;
            height: 48px;
            background: #10B981;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
        }
        .success-icon svg {
            width: 24px;
            height: 24px;
            stroke: white;
            stroke-width: 3;
        }
        h1 {
            color: #111827;
            font-size: 20px;
            font-weight: 600;
            margin: 0 0 12px 0;
        }
        p {
            color: #6B7280;
            font-size: 16px;
            margin: 0 0 24px 0;
            line-height: 1.5;
        }
        .server-name {
            color: #10B981;
            font-weight: 600;
        }
        .close-note {
            font-size: 14px;
            color: #9CA3AF;
            margin: 0;
        }
    </style>
    ${
      autoClose
        ? "<script>setTimeout(() => window.close(), 1000);</script>"
        : ""
    }
</head>
<body>
    <div class="card">
        <div class="success-icon">
            <svg fill="none" viewBox="0 0 24 24">
                <polyline points="20,6 9,17 4,12"></polyline>
            </svg>
        </div>
        <h1>Authentication Successful!</h1>
        <p>Successfully authenticated with <span class="server-name">${serverName}</span>.</p>
        <p class="close-note">You can close this page.</p>
    </div>
</body>
</html>`;
}

async function handleMCPLogin(
  request: Request,
  mcpProviders: DurableObjectStub<MCPProviders>,
  origin: string,
  clientInfo: {
    name: string;
    title: string;
    version: string;
  },
  pathPrefix: string
) {
  const url = new URL(request.url);
  const mcpUrl = url.searchParams.get("url");

  if (!mcpUrl) {
    return new Response("Missing url parameter", { status: 400 });
  }

  try {
    const mcpUrlObj = new URL(mcpUrl);
    const hostname = mcpUrlObj.hostname;
    const callbackUrl = `${origin}${pathPrefix}/callback/${hostname}`;

    const { registrationResponse, authServerMetadata, ...authFlowData } =
      await constructMCPAuthorizationUrl(mcpUrl, callbackUrl, clientInfo);

    // If no auth is required, add the provider immediately
    if (authFlowData.noAuthRequired) {
      try {
        const { serverName, tools } = await extractMCPServerInfo(
          clientInfo,
          mcpUrl
        );
        await mcpProviders.addProvider(
          hostname,
          serverName,
          mcpUrl,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          true,
          tools
        );

        // Return HTML that auto-closes for no-auth MCPs
        return new Response(createSuccessHTML(serverName, true), {
          headers: { "Content-Type": "text/html" },
        });
      } catch (error) {
        return new Response(`Failed to get server info: ${error.message}`, {
          status: 400,
        });
      }
    }

    // Store auth flow data in cookie for callback
    const authFlowCookie = encodeURIComponent(
      btoa(
        JSON.stringify({
          ...authFlowData,
          hostname: hostname,
        })
      )
    );

    return new Response(null, {
      status: 302,
      headers: {
        Location: authFlowData.authorizationUrl,
        "Set-Cookie": `mcp_auth_${hostname}=${authFlowCookie}; HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/`,
      },
    });
  } catch (error) {
    return new Response(`MCP authorization failed: ${error.message}`, {
      status: 400,
    });
  }
}

async function handleMCPCallback(
  request: Request,
  mcpProviders: DurableObjectStub<MCPProviders>,
  hostname: string,
  origin: string,
  clientInfo: {
    name: string;
    title: string;
    version: string;
  },
  pathPrefix: string
) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");

  if (!code || !stateParam) {
    return new Response("Missing code or state", { status: 400 });
  }

  // Get auth flow data from cookie
  const cookieName = `mcp_auth_${hostname}`;
  const cookieHeader = request.headers.get("Cookie");
  let authFlowData;

  if (cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split("; ").map((c) => c.split("="))
    );
    if (cookies[cookieName]) {
      try {
        authFlowData = JSON.parse(
          atob(decodeURIComponent(cookies[cookieName]))
        );
      } catch (error) {
        return new Response("Invalid auth flow data", { status: 400 });
      }
    }
  }

  if (!authFlowData) {
    return new Response("Missing auth flow data", { status: 400 });
  }

  // Verify state matches
  if (stateParam !== authFlowData.state) {
    return new Response("Invalid state parameter", { status: 400 });
  }

  if (!authFlowData.clientId || !authFlowData.tokenEndpoint) {
    return new Response("Missing client credentials or token endpoint", {
      status: 400,
    });
  }

  try {
    // Exchange code for token
    const tokenData = await exchangeCodeForToken(
      code,
      authFlowData,
      `${origin}${pathPrefix}/callback/${hostname}`
    );

    if (!tokenData.access_token) {
      return new Response("No access token received", { status: 400 });
    }

    // Get server name and tools
    const { serverName, tools } = await extractMCPServerInfo(
      clientInfo,
      authFlowData.mcpServerUrl,
      tokenData.access_token
    );

    await mcpProviders.addProvider(
      hostname,
      serverName,
      authFlowData.mcpServerUrl,
      authFlowData.clientId,
      authFlowData.clientSecret,
      tokenData.access_token,
      tokenData.refresh_token,
      authFlowData.tokenEndpoint,
      tokenData.expires_in,
      false,
      tools
    );

    // Return HTML success page and clear cookie
    return new Response(createSuccessHTML(serverName, false), {
      headers: {
        "Content-Type": "text/html",
        "Set-Cookie": `mcp_auth_${hostname}=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/`,
      },
    });
  } catch (error) {
    return new Response(`Token exchange failed: ${error.message}`, {
      status: 400,
    });
  }
}

// Helper functions
async function exchangeCodeForToken(
  code: string,
  authFlowData: any,
  redirectUri: string
) {
  const tokenRequestBody = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: authFlowData.clientId,
    code_verifier: authFlowData.codeVerifier,
    resource: authFlowData.mcpServerUrl,
  });

  if (authFlowData.clientSecret) {
    tokenRequestBody.append("client_secret", authFlowData.clientSecret);
  }

  const tokenResponse = await fetch(authFlowData.tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: tokenRequestBody,
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`${tokenResponse.status} ${errorText}`);
  }

  return (await tokenResponse.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
}

async function refreshAccessToken(
  refreshToken: string,
  clientId?: string,
  clientSecret?: string,
  tokenEndpoint?: string
) {
  if (!tokenEndpoint) {
    throw new Error("Token endpoint is required for token refresh");
  }

  const tokenRequestBody = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  if (clientId) {
    tokenRequestBody.append("client_id", clientId);
  }

  if (clientSecret) {
    tokenRequestBody.append("client_secret", clientSecret);
  }

  const tokenResponse = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: tokenRequestBody,
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`${tokenResponse.status} ${errorText}`);
  }

  return (await tokenResponse.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
}

// Utility functions for backward compatibility and external use
export async function getMCPProviders(
  env: MCPOAuthEnv,
  userId: string
): Promise<
  (MCPProvider & {
    tools: { name: string; inputSchema: any; description: string }[] | null;
  })[]
> {
  const mcpProviders = env.MCPProviders.get(
    env.MCPProviders.idFromName(VERSION + userId)
  );
  const providers = await mcpProviders.getAllProviders();

  // Parse tools JSON for each provider
  return providers.map((provider) => ({
    ...provider,
    tools: provider.tools ? JSON.parse(provider.tools) : null,
  }));
}

// Utility function to get authorization for any URL
export async function getAuthorization(
  env: MCPOAuthEnv,
  userId: string,
  url: string
): Promise<{ Authorization?: string } | null> {
  try {
    const urlObj = new URL(url);
    const mcpProviders = env.MCPProviders.get(
      env.MCPProviders.idFromName(VERSION + userId)
    );
    const provider = await mcpProviders.getProvider(url);

    if (provider && provider.access_token) {
      return {
        Authorization: `${provider.token_type || "Bearer"} ${
          provider.access_token
        }`,
      };
    }

    return null;
  } catch (error) {
    return null;
  }
}
