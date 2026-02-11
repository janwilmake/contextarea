/// <reference lib="esnext" />

// --- KV Interface ---

export interface IdpKV {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  del(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}

// --- Data Interfaces ---

export interface McpServer {
  profile: string;
  url: string;
  name: string;
  client_id: string | null;
  client_secret: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_endpoint: string | null;
  token_type: string | null;
  expires_in: number | null;
  scope: string | null;
  created_at: string;
  updated_at: string;
  public: boolean;
  metadata: string | null;
}

export interface ContextEntry {
  profile: string;
  url: string;
  name: string;
  client_id: string | null;
  client_secret: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_endpoint: string | null;
  token_type: string | null;
  expires_in: number | null;
  scope: string | null;
  created_at: string;
  updated_at: string;
  public: boolean;
  metadata: string | null;
}

// --- KV Key Helpers ---

const KV_V = "v1";
const SEP = "||";

function mcpKey(userId: string, profile: string, url: string) {
  return [KV_V, userId, "mcp", profile, url].join(SEP);
}

function ctxKey(userId: string, profile: string, url: string) {
  return [KV_V, userId, "ctx", profile, url].join(SEP);
}

function profilesKey(userId: string) {
  return [KV_V, userId, "profiles"].join(SEP);
}

function mcpPrefix(userId: string, profile?: string) {
  const parts = [KV_V, userId, "mcp"];
  if (profile) parts.push(profile);
  return parts.join(SEP) + SEP;
}

function ctxPrefix(userId: string, profile?: string) {
  const parts = [KV_V, userId, "ctx"];
  if (profile) parts.push(profile);
  return parts.join(SEP) + SEP;
}

// --- Storage Options ---

interface AddEntryOptions {
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenEndpoint?: string;
  expiresIn?: number;
  scope?: string;
  isPublic?: boolean;
  metadata?: Record<string, unknown>;
}

// --- Storage Factory ---

export function createStorage(kv: IdpKV, userId: string) {
  async function findByUrlPrefix<T>(
    getEntry: (url: string, profile: string) => Promise<T | null>,
    url: string,
    profile: string
  ): Promise<T | null> {
    const urlObj = new URL(url);
    const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
    const pathSegments = urlObj.pathname.split("/").filter(Boolean);
    const candidates = [url];
    for (let i = pathSegments.length; i >= 0; i--) {
      const path = i > 0 ? "/" + pathSegments.slice(0, i).join("/") : "";
      candidates.push(baseUrl + path);
    }
    for (const candidate of candidates) {
      const entry = await getEntry(candidate, profile);
      if (entry) return entry;
    }
    return null;
  }

  async function listAndParse<T>(prefix: string): Promise<T[]> {
    const keys = await kv.list(prefix);
    const results: T[] = [];
    for (const key of keys) {
      const data = await kv.get(key);
      if (data) results.push(JSON.parse(data));
    }
    return results;
  }

  const getMcpServer = async (
    url: string,
    profile: string
  ): Promise<McpServer | null> => {
    const data = await kv.get(mcpKey(userId, profile, url));
    return data ? JSON.parse(data) : null;
  };

  const getContext = async (
    url: string,
    profile: string
  ): Promise<ContextEntry | null> => {
    const data = await kv.get(ctxKey(userId, profile, url));
    return data ? JSON.parse(data) : null;
  };

  const addMcpServer = async (
    url: string,
    name: string,
    profile: string,
    options: AddEntryOptions = {}
  ) => {
    const now = new Date().toISOString();
    const existing = await getMcpServer(url, profile);
    const server: McpServer = {
      profile,
      url,
      name,
      client_id: options.clientId || null,
      client_secret: options.clientSecret || null,
      access_token: options.accessToken || null,
      refresh_token: options.refreshToken || null,
      token_endpoint: options.tokenEndpoint || null,
      token_type: "Bearer",
      expires_in: options.expiresIn || null,
      scope: options.scope || null,
      created_at: existing?.created_at || now,
      updated_at: now,
      public: options.isPublic || false,
      metadata: options.metadata ? JSON.stringify(options.metadata) : null
    };
    await kv.set(mcpKey(userId, profile, url), JSON.stringify(server));
    await registerProfile(profile);
  };

  const addContext = async (
    url: string,
    name: string,
    profile: string,
    options: AddEntryOptions = {}
  ) => {
    const now = new Date().toISOString();
    const existing = await getContext(url, profile);
    const entry: ContextEntry = {
      profile,
      url,
      name,
      client_id: options.clientId || null,
      client_secret: options.clientSecret || null,
      access_token: options.accessToken || null,
      refresh_token: options.refreshToken || null,
      token_endpoint: options.tokenEndpoint || null,
      token_type: "Bearer",
      expires_in: options.expiresIn || null,
      scope: options.scope || null,
      created_at: existing?.created_at || now,
      updated_at: now,
      public: options.isPublic || false,
      metadata: options.metadata ? JSON.stringify(options.metadata) : null
    };
    await kv.set(ctxKey(userId, profile, url), JSON.stringify(entry));
    await registerProfile(profile);
  };

  const updateTokens = async (
    table: "mcp_servers" | "context",
    url: string,
    profile: string,
    accessToken: string,
    refreshToken?: string,
    expiresIn?: number
  ) => {
    const key =
      table === "mcp_servers"
        ? mcpKey(userId, profile, url)
        : ctxKey(userId, profile, url);
    const data = await kv.get(key);
    if (!data) return;
    const entry = JSON.parse(data);
    entry.access_token = accessToken;
    entry.refresh_token = refreshToken || null;
    entry.expires_in = expiresIn || null;
    entry.updated_at = new Date().toISOString();
    await kv.set(key, JSON.stringify(entry));
  };

  const findMcpServerForUrl = async (
    url: string,
    profile: string
  ): Promise<McpServer | null> => {
    return findByUrlPrefix(getMcpServer, url, profile);
  };

  const findContextForUrl = async (
    url: string,
    profile: string
  ): Promise<ContextEntry | null> => {
    return findByUrlPrefix(getContext, url, profile);
  };

  const getMcpServers = async (urls: string[]): Promise<McpServer[]> => {
    if (urls.length === 0) return [];
    const all = await listAndParse<McpServer>(mcpPrefix(userId));
    const urlSet = new Set(urls);
    return all.filter((s) => urlSet.has(s.url));
  };

  const getContextEntries = async (urls: string[]): Promise<ContextEntry[]> => {
    if (urls.length === 0) return [];
    const all = await listAndParse<ContextEntry>(ctxPrefix(userId));
    const urlSet = new Set(urls);
    return all.filter((e) => urlSet.has(e.url));
  };

  const getAllMcpServers = async (): Promise<McpServer[]> => {
    const results = await listAndParse<McpServer>(mcpPrefix(userId));
    return results.sort((a, b) => b.created_at.localeCompare(a.created_at));
  };

  const getAllContextEntries = async (): Promise<ContextEntry[]> => {
    const results = await listAndParse<ContextEntry>(ctxPrefix(userId));
    return results.sort((a, b) => b.created_at.localeCompare(a.created_at));
  };

  const removeMcpServer = async (url: string, profile: string) => {
    await kv.del(mcpKey(userId, profile, url));
  };

  const removeContext = async (url: string, profile: string) => {
    await kv.del(ctxKey(userId, profile, url));
  };

  const registerProfile = async (name: string) => {
    const profiles = await getProfiles();
    if (!profiles.includes(name)) {
      profiles.push(name);
      await kv.set(profilesKey(userId), JSON.stringify(profiles));
    }
  };

  const getProfiles = async (): Promise<string[]> => {
    const data = await kv.get(profilesKey(userId));
    return data ? JSON.parse(data) : [];
  };

  return {
    addMcpServer,
    addContext,
    updateTokens,
    getMcpServer,
    getContext,
    findMcpServerForUrl,
    findContextForUrl,
    getMcpServers,
    getContextEntries,
    getAllMcpServers,
    getAllContextEntries,
    removeMcpServer,
    removeContext,
    registerProfile,
    getProfiles
  };
}

export type IdpStorage = ReturnType<typeof createStorage>;

// --- Authorization Flow Types ---

export interface AuthorizationFlowData {
  authorizationUrl?: string;
  codeVerifier?: string;
  state?: string;
  tokenEndpoint?: string;
  clientId?: string;
  clientSecret?: string;
  resourceUrl: string;
  scope?: string;
  noAuthRequired?: boolean;
  accessToken?: string;
  resourceType: "mcp" | "context";
}

export interface AuthServerMetadata {
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
  code_challenge_methods_supported?: string[];
  scopes_supported?: string[];
  client_id_metadata_document_supported?: boolean;
  [key: string]: unknown;
}

export interface ClientInfo {
  name: string;
  version?: string;
  uri?: string;
  logo_uri?: string;
}

export interface WWWAuthenticateInfo {
  scheme: string;
  realm?: string;
  resourceMetadataUrl?: string;
  scope?: string;
  error?: string;
  errorDescription?: string;
}

export interface ProtectedResourceMetadata {
  resource: string;
  authorization_servers: string[];
  scopes_supported?: string[];
  bearer_methods_supported?: string[];
  [key: string]: unknown;
}

// --- PKCE Helpers ---

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function generateRandomState(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

// --- WWW-Authenticate Parser ---

export function parseWWWAuthenticate(header: string): WWWAuthenticateInfo {
  const result: WWWAuthenticateInfo = { scheme: "" };

  const schemeMatch = header.match(/^(\w+)\s*/);
  if (schemeMatch) {
    result.scheme = schemeMatch[1];
  }

  const paramRegex = /(\w+)="([^"]+)"/g;
  let match;
  while ((match = paramRegex.exec(header)) !== null) {
    const [, key, value] = match;
    switch (key) {
      case "realm":
        result.realm = value;
        break;
      case "resource_metadata":
        result.resourceMetadataUrl = value;
        break;
      case "scope":
        result.scope = value;
        break;
      case "error":
        result.error = value;
        break;
      case "error_description":
        result.errorDescription = value;
        break;
    }
  }

  return result;
}

// --- Protected Resource Metadata Discovery ---

async function discoverProtectedResourceMetadata(
  resourceUrl: string,
  wwwAuthInfo?: WWWAuthenticateInfo
): Promise<ProtectedResourceMetadata> {
  if (wwwAuthInfo?.resourceMetadataUrl) {
    try {
      const response = await fetch(wwwAuthInfo.resourceMetadataUrl);
      if (response.ok) {
        return (await response.json()) as ProtectedResourceMetadata;
      }
    } catch (error) {
      // Continue to fallback
    }
  }

  const urlObj = new URL(resourceUrl);
  const basePath = urlObj.pathname === "/" ? "" : urlObj.pathname;

  const endpoints: string[] = [];

  if (basePath && basePath !== "") {
    endpoints.push(`/.well-known/oauth-protected-resource${basePath}`);
  }

  endpoints.push(`/.well-known/oauth-protected-resource`);

  const discoveryErrors: string[] = [];

  for (const endpoint of endpoints) {
    try {
      const metadataUrl = new URL(endpoint, urlObj.origin);
      const response = await fetch(metadataUrl);
      if (response.ok) {
        const metadata = (await response.json()) as ProtectedResourceMetadata;

        if (
          metadata.authorization_servers &&
          metadata.authorization_servers.length > 0
        ) {
          return metadata;
        }

        discoveryErrors.push(`${endpoint}: Missing authorization_servers`);
      } else {
        discoveryErrors.push(`${endpoint}: ${response.status}`);
      }
    } catch (error) {
      discoveryErrors.push(`${endpoint}: ${(error as Error).message}`);
    }
  }

  throw new Error(
    `Could not discover protected resource metadata for ${resourceUrl}. Tried: ${discoveryErrors.join(
      ", "
    )}`
  );
}

// --- MCP Initialize Probe ---

interface McpInitializeResult {
  name: string;
  title?: string;
  version?: string;
  description?: string;
  icons?: { src: string; mimeType?: string; sizes?: string[] }[];
  websiteUrl?: string;
}

async function tryMcpInitialize(
  url: string,
  accessToken?: string
): Promise<McpInitializeResult | null> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream"
    };
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "idp-middleware", version: "1.0.0" }
        }
      })
    });

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "";

    let data: any;
    if (contentType.includes("text/event-stream")) {
      const text = await response.text();
      const match = text.match(/^data:\s*(.+)$/m);
      if (!match) return null;
      data = JSON.parse(match[1]);
    } else {
      data = await response.json();
    }

    if (data?.result?.serverInfo?.name) {
      const serverInfo = data.result.serverInfo;
      return {
        name: serverInfo.name,
        title: serverInfo.title,
        version: serverInfo.version,
        description: serverInfo.description,
        icons: serverInfo.icons,
        websiteUrl: serverInfo.websiteUrl
      };
    }

    return null;
  } catch {
    return null;
  }
}

// --- Apex Domain Favicon Scraping ---

function getApexDomain(hostname: string): string {
  const parts = hostname.split(".");
  if (parts.length <= 2) return hostname;
  return parts.slice(-2).join(".");
}

async function fetchApexFavicon(url: string): Promise<string | null> {
  try {
    const hostname = new URL(url).hostname;
    const apex = getApexDomain(hostname);
    const pageUrl = `https://${apex}`;

    const response = await fetch(pageUrl, {
      headers: { Accept: "text/html" },
      redirect: "follow"
    });

    if (!response.ok) return null;

    const html = await response.text();

    // Look for <link rel="icon" ...> or <link rel="shortcut icon" ...> or apple-touch-icon
    const iconPatterns = [
      /<link[^>]*rel=["'](?:apple-touch-icon|icon|shortcut icon)["'][^>]*href=["']([^"']+)["']/i,
      /<link[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:apple-touch-icon|icon|shortcut icon)["']/i
    ];

    for (const pattern of iconPatterns) {
      const match = html.match(pattern);
      if (match?.[1]) {
        const iconHref = match[1];
        if (iconHref.startsWith("http")) return iconHref;
        if (iconHref.startsWith("//")) return `https:${iconHref}`;
        if (iconHref.startsWith("/")) return `https://${apex}${iconHref}`;
        return `https://${apex}/${iconHref}`;
      }
    }

    // Fallback: try /favicon.ico
    return `https://${apex}/favicon.ico`;
  } catch {
    return null;
  }
}

// --- Authorization Server Discovery ---

async function discoverAuthServerMetadata(
  issuerUrl: string
): Promise<AuthServerMetadata> {
  const url = new URL(issuerUrl);
  const basePath = url.pathname === "/" ? "" : url.pathname;

  const endpoints: string[] = [];

  if (basePath && basePath !== "") {
    endpoints.push(
      `/.well-known/oauth-authorization-server${basePath}`,
      `/.well-known/openid-configuration${basePath}`,
      `${basePath}/.well-known/openid-configuration`
    );
  }

  endpoints.push(
    `/.well-known/oauth-authorization-server`,
    `/.well-known/openid-configuration`
  );

  const discoveryErrors: string[] = [];

  for (const endpoint of endpoints) {
    try {
      const metadataUrl = new URL(endpoint, url.origin);
      const response = await fetch(metadataUrl);
      if (response.ok) {
        const metadata = (await response.json()) as AuthServerMetadata;

        if (metadata.authorization_endpoint && metadata.token_endpoint) {
          return metadata;
        }

        discoveryErrors.push(`${endpoint}: Missing required endpoints`);
      } else {
        discoveryErrors.push(`${endpoint}: ${response.status}`);
      }
    } catch (error) {
      discoveryErrors.push(`${endpoint}: ${(error as Error).message}`);
    }
  }

  throw new Error(
    `Could not discover authorization server metadata for ${issuerUrl}. Tried: ${discoveryErrors.join(
      ", "
    )}`
  );
}

// --- Client Registration ---

async function registerClientWithCIMD(
  authMetadata: AuthServerMetadata,
  clientInfo: ClientInfo,
  callbackUrl: string
): Promise<{ clientId: string; clientSecret?: string }> {
  const cimdUrl = `${clientInfo.uri}/oauth/client-metadata.json`;
  return { clientId: cimdUrl };
}

async function registerClientDynamic(
  authMetadata: AuthServerMetadata,
  clientInfo: ClientInfo,
  callbackUrl: string
): Promise<{ clientId: string; clientSecret?: string }> {
  if (!authMetadata.registration_endpoint) {
    throw new Error(
      "Authorization server does not support dynamic client registration"
    );
  }

  const registrationData: Record<string, unknown> = {
    redirect_uris: [callbackUrl],
    grant_types: ["authorization_code"],
    response_types: ["code"],
    client_name: clientInfo.name,
    application_type: "native",
    token_endpoint_auth_method: "none"
  };

  if (clientInfo.uri) {
    registrationData.client_uri = clientInfo.uri;
  }

  if (clientInfo.logo_uri) {
    registrationData.logo_uri = clientInfo.logo_uri;
  }

  try {
    const regResponse = await fetch(authMetadata.registration_endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(registrationData)
    });

    if (!regResponse.ok) {
      const errorText = await regResponse.text().catch(() => "Unknown error");
      throw new Error(
        `Client registration failed: ${regResponse.status} - ${errorText}`
      );
    }

    const registrationResponse = (await regResponse.json()) as {
      client_id: string;
      client_secret?: string;
    };
    return {
      clientId: registrationResponse.client_id,
      clientSecret: registrationResponse.client_secret
    };
  } catch (error) {
    throw new Error(
      `Dynamic client registration failed: ${(error as Error).message}`
    );
  }
}

// --- Authorization URL Construction ---

export async function constructAuthorizationUrl(
  resourceUrl: string,
  callbackUrl: string,
  clientInfo: ClientInfo,
  resourceType: "mcp" | "context",
  options: {
    wwwAuthenticateInfo?: WWWAuthenticateInfo;
    scope?: string;
    testRequest?: () => Promise<Response>;
  } = {}
): Promise<AuthorizationFlowData> {
  let resourceMetadata: ProtectedResourceMetadata;
  let scope = options.scope;

  if (options.testRequest) {
    try {
      const testResponse = await options.testRequest();

      if (testResponse.ok) {
        return {
          resourceUrl,
          resourceType,
          noAuthRequired: true,
          accessToken: undefined
        };
      }

      if (testResponse.status === 401) {
        const wwwAuth = testResponse.headers.get("WWW-Authenticate");
        if (wwwAuth) {
          const parsed = parseWWWAuthenticate(wwwAuth);
          scope = scope || parsed.scope;
          if (!options.wwwAuthenticateInfo) {
            options.wwwAuthenticateInfo = parsed;
          }
        }
      }
    } catch (error) {
      // Continue with auth discovery
    }
  }

  try {
    resourceMetadata = await discoverProtectedResourceMetadata(
      resourceUrl,
      options.wwwAuthenticateInfo
    );
  } catch (error) {
    throw new Error(
      `Failed to discover protected resource metadata: ${(error as Error).message}`
    );
  }

  if (resourceType === "context") {
    if (resourceMetadata.resource) {
      resourceUrl = resourceMetadata.resource;
    }
    if (resourceMetadata.scopes_supported) {
      scope = resourceMetadata.scopes_supported.join(" ");
    }
  } else if (!scope && resourceMetadata.scopes_supported) {
    scope = resourceMetadata.scopes_supported.join(" ");
  }

  let authMetadata: AuthServerMetadata | undefined;
  let selectedAuthServer: string | undefined;
  const discoveryErrors: string[] = [];

  for (const authServerUrl of resourceMetadata.authorization_servers) {
    try {
      authMetadata = await discoverAuthServerMetadata(authServerUrl);
      selectedAuthServer = authServerUrl;
      break;
    } catch (error) {
      discoveryErrors.push(`${authServerUrl}: ${(error as Error).message}`);
    }
  }

  if (!authMetadata || !selectedAuthServer) {
    throw new Error(
      `Could not discover authorization server metadata. Tried: ${discoveryErrors.join(
        ", "
      )}`
    );
  }

  if (!scope && authMetadata.scopes_supported) {
    scope = authMetadata.scopes_supported.join(" ");
  }

  if (
    !authMetadata.code_challenge_methods_supported ||
    !authMetadata.code_challenge_methods_supported.includes("S256")
  ) {
    throw new Error(
      "Authorization server does not support PKCE with S256 method"
    );
  }

  let clientId: string;
  let clientSecret: string | undefined;

  if (authMetadata.client_id_metadata_document_supported && clientInfo.uri) {
    const registration = await registerClientWithCIMD(
      authMetadata,
      clientInfo,
      callbackUrl
    );
    clientId = registration.clientId;
    clientSecret = registration.clientSecret;
  } else if (authMetadata.registration_endpoint) {
    const registration = await registerClientDynamic(
      authMetadata,
      clientInfo,
      callbackUrl
    );
    clientId = registration.clientId;
    clientSecret = registration.clientSecret;
  } else {
    throw new Error(
      "Authorization server does not support CIMD or dynamic client registration"
    );
  }

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateRandomState();

  const authUrl = new URL(authMetadata.authorization_endpoint);
  const params: Record<string, string> = {
    response_type: "code",
    client_id: clientId,
    redirect_uri: callbackUrl,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state: state,
    resource: resourceUrl
  };

  if (scope) {
    params.scope = scope;
  }

  Object.entries(params).forEach(([key, value]) => {
    authUrl.searchParams.set(key, value);
  });

  return {
    authorizationUrl: authUrl.toString(),
    codeVerifier,
    state,
    tokenEndpoint: authMetadata.token_endpoint,
    clientId,
    clientSecret,
    resourceUrl,
    resourceType,
    scope,
    noAuthRequired: false
  };
}

// --- Token Exchange ---

export async function exchangeCodeForToken(
  code: string,
  authFlowData: AuthorizationFlowData,
  redirectUri: string
): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}> {
  const tokenRequestBody = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: authFlowData.clientId!,
    code_verifier: authFlowData.codeVerifier!,
    resource: authFlowData.resourceUrl
  });

  if (authFlowData.clientSecret) {
    tokenRequestBody.append("client_secret", authFlowData.clientSecret);
  }

  const tokenResponse = await fetch(authFlowData.tokenEndpoint!, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json"
    },
    body: tokenRequestBody
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(
      `Token exchange failed: ${tokenResponse.status} ${errorText}`
    );
  }

  return tokenResponse.json();
}

export async function refreshAccessToken(
  refreshToken: string,
  clientId?: string,
  clientSecret?: string,
  tokenEndpoint?: string,
  resourceUrl?: string
): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}> {
  if (!tokenEndpoint) {
    throw new Error("Token endpoint is required for token refresh");
  }

  const tokenRequestBody = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken
  });

  if (clientId) {
    tokenRequestBody.append("client_id", clientId);
  }

  if (clientSecret) {
    tokenRequestBody.append("client_secret", clientSecret);
  }

  if (resourceUrl) {
    tokenRequestBody.append("resource", resourceUrl);
  }

  const tokenResponse = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json"
    },
    body: tokenRequestBody
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(
      `Token refresh failed: ${tokenResponse.status} ${errorText}`
    );
  }

  return tokenResponse.json();
}

// --- IDP Middleware Config & Handlers ---

export interface IdpMiddlewareConfig {
  /** KV store for persisting tokens and server entries. */
  kv: IdpKV;
  /** The user identifier. Used to namespace KV keys. */
  userId?: string;
  /** The active profile for write operations. */
  profile?: string;
  clientInfo: ClientInfo;
  baseUrl?: string;
  pathPrefix?: string;
  onAuthSuccess?: (
    resourceUrl: string,
    resourceType: "mcp" | "context",
    accessToken: string
  ) => Promise<{ name: string; metadata?: Record<string, unknown> }>;
}

export interface IdpMiddlewareHandlers {
  middleware: (request: Request) => Promise<Response | null>;
  removeMcpServer: (url: string, profile: string) => Promise<void>;
  removeContext: (url: string, profile: string) => Promise<void>;
  getMcpServers: () => Promise<
    (McpServer & {
      metadata: Record<string, unknown> | null;
      reauthorizeUrl: string;
    })[]
  >;
  getContextEntries: () => Promise<
    (ContextEntry & {
      metadata: Record<string, unknown> | null;
      reauthorizeUrl: string;
    })[]
  >;
  getProfiles: () => Promise<string[]>;
  registerProfile: (name: string) => Promise<void>;
  refreshMcpServers: (urls: string[]) => Promise<void>;
  refreshContextEntries: (urls: string[]) => Promise<void>;
  getAuthorizationForMcpServer: (
    url: string
  ) => Promise<{ Authorization: string } | null>;
  getAuthorizationForContext: (
    url: string
  ) => Promise<{ Authorization: string } | null>;
}

export function createIdpMiddleware(
  config: IdpMiddlewareConfig
): IdpMiddlewareHandlers {
  const {
    kv,
    userId,
    profile: activeProfile = "default",
    baseUrl,
    clientInfo,
    pathPrefix = "/oauth",
    onAuthSuccess
  } = config;

  const storage = userId ? createStorage(kv, userId) : null;

  const middleware = async (
    request: Request
  ): Promise<Response | null> => {
    const url = new URL(request.url);
    const path = url.pathname;

    if (!path.startsWith(pathPrefix + "/")) {
      return null;
    }

    if (!userId || !storage) {
      return new Response("Unauthorized: No user session", { status: 401 });
    }

    const origin = baseUrl || url.origin;

    if (
      path === `${pathPrefix}/login/mcp` ||
      path === `${pathPrefix}/login/context`
    ) {
      const resourceType = path.endsWith("/mcp") ? "mcp" : "context";
      return handleLogin(
        request,
        storage,
        activeProfile,
        origin,
        clientInfo,
        pathPrefix,
        resourceType,
        onAuthSuccess
      );
    }

    if (
      path.startsWith(`${pathPrefix}/callback/mcp/`) ||
      path.startsWith(`${pathPrefix}/callback/context/`)
    ) {
      const isMcp = path.includes("/callback/mcp/");
      const resourceType = isMcp ? "mcp" : "context";
      const prefix = `${pathPrefix}/callback/${resourceType}/`;
      const hostname = path.split(prefix)[1];

      return handleCallback(
        request,
        storage,
        activeProfile,
        hostname,
        origin,
        clientInfo,
        pathPrefix,
        resourceType,
        onAuthSuccess
      );
    }

    return null;
  };

  const removeMcpServer = async (
    url: string,
    profile: string
  ): Promise<void> => {
    if (!storage) throw new Error("No user session");
    await storage.removeMcpServer(url, profile);
  };

  const removeContext = async (
    url: string,
    profile: string
  ): Promise<void> => {
    if (!storage) throw new Error("No user session");
    await storage.removeContext(url, profile);
  };

  const getMcpServers = async () => {
    if (!storage) return [];

    const servers = await storage.getAllMcpServers();

    return servers.map((server) => ({
      ...server,
      metadata: server.metadata ? JSON.parse(server.metadata) : null,
      reauthorizeUrl: `${
        baseUrl || "https://example.com"
      }${pathPrefix}/login/mcp?url=${encodeURIComponent(server.url)}`
    }));
  };

  const getContextEntries = async () => {
    if (!storage) return [];

    const entries = await storage.getAllContextEntries();

    return entries.map((entry) => ({
      ...entry,
      metadata: entry.metadata ? JSON.parse(entry.metadata) : null,
      reauthorizeUrl: `${
        baseUrl || "https://example.com"
      }${pathPrefix}/login/context?url=${encodeURIComponent(entry.url)}`
    }));
  };

  const refreshMcpServers = async (urls: string[]): Promise<void> => {
    if (!storage) throw new Error("No user session");

    const servers = await storage.getMcpServers(urls);
    const now = Math.floor(Date.now() / 1000);

    const expiredServers = servers.filter((server) => {
      if (
        !server.refresh_token ||
        !server.token_endpoint ||
        !server.expires_in
      ) {
        return false;
      }
      const updatedAtSeconds = Math.floor(
        new Date(server.updated_at).getTime() / 1000
      );
      return now >= updatedAtSeconds + server.expires_in - 300;
    });

    await Promise.all(
      expiredServers.map(async (server) => {
        try {
          const tokenData = await refreshAccessToken(
            server.refresh_token!,
            server.client_id || undefined,
            server.client_secret || undefined,
            server.token_endpoint!,
            server.url
          );
          await storage.updateTokens(
            "mcp_servers",
            server.url,
            server.profile,
            tokenData.access_token,
            tokenData.refresh_token || server.refresh_token || undefined,
            tokenData.expires_in
          );
        } catch (error) {
          console.error(`Failed to refresh token for ${server.url}:`, error);
        }
      })
    );
  };

  const refreshContextEntries = async (urls: string[]): Promise<void> => {
    if (!storage) throw new Error("No user session");

    const entries = await storage.getContextEntries(urls);
    const now = Math.floor(Date.now() / 1000);

    const expiredEntries = entries.filter((entry) => {
      if (
        !entry.refresh_token ||
        !entry.token_endpoint ||
        !entry.expires_in
      ) {
        return false;
      }
      const updatedAtSeconds = Math.floor(
        new Date(entry.updated_at).getTime() / 1000
      );
      return now >= updatedAtSeconds + entry.expires_in - 300;
    });

    await Promise.all(
      expiredEntries.map(async (entry) => {
        try {
          const tokenData = await refreshAccessToken(
            entry.refresh_token!,
            entry.client_id || undefined,
            entry.client_secret || undefined,
            entry.token_endpoint!,
            entry.url
          );
          await storage.updateTokens(
            "context",
            entry.url,
            entry.profile,
            tokenData.access_token,
            tokenData.refresh_token || entry.refresh_token || undefined,
            tokenData.expires_in
          );
        } catch (error) {
          console.error(`Failed to refresh token for ${entry.url}:`, error);
        }
      })
    );
  };

  const getAuthorizationForMcpServer = async (
    url: string
  ): Promise<{ Authorization: string } | null> => {
    if (!storage) return null;

    const server = await storage.findMcpServerForUrl(url, activeProfile);

    if (server?.access_token) {
      return {
        Authorization: `${server.token_type || "Bearer"} ${server.access_token}`
      };
    }

    return null;
  };

  const getAuthorizationForContext = async (
    url: string
  ): Promise<{ Authorization: string } | null> => {
    if (!storage) return null;

    const context = await storage.findContextForUrl(url, activeProfile);

    if (context?.access_token) {
      return {
        Authorization: `${context.token_type || "Bearer"} ${context.access_token}`
      };
    }

    return null;
  };

  const getProfiles = async (): Promise<string[]> => {
    if (!storage) return [];
    return storage.getProfiles();
  };

  const registerProfile = async (name: string): Promise<void> => {
    if (!storage) throw new Error("No user session");
    await storage.registerProfile(name);
  };

  return {
    middleware,
    removeMcpServer,
    removeContext,
    getMcpServers,
    getContextEntries,
    getProfiles,
    registerProfile,
    refreshMcpServers,
    refreshContextEntries,
    getAuthorizationForMcpServer,
    getAuthorizationForContext
  };
}

// --- Request Handlers ---

function createSuccessHTML(
  providerName: string,
  autoClose: boolean = false
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Authentication Success</title>
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
        h1 { color: #111827; font-size: 20px; font-weight: 600; margin: 0 0 12px 0; }
        p { color: #6B7280; font-size: 16px; margin: 0 0 24px 0; line-height: 1.5; }
        .provider-name { color: #10B981; font-weight: 600; }
        .close-note { font-size: 14px; color: #9CA3AF; margin: 0; }
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
            <svg fill="none" viewBox="0 0 24 24"><polyline points="20,6 9,17 4,12"></polyline></svg>
        </div>
        <h1>Authentication Successful!</h1>
        <p>Successfully authenticated with <span class="provider-name">${providerName}</span>.</p>
        <p class="close-note">You can close this page.</p>
    </div>
</body>
</html>`;
}

async function handleLogin(
  request: Request,
  storage: IdpStorage,
  profile: string,
  origin: string,
  clientInfo: ClientInfo,
  pathPrefix: string,
  resourceType: "mcp" | "context",
  onAuthSuccess?: (
    resourceUrl: string,
    resourceType: "mcp" | "context",
    accessToken: string
  ) => Promise<{ name: string; metadata?: Record<string, unknown> }>
): Promise<Response> {
  const url = new URL(request.url);
  const isLocalhost = url.hostname === "localhost";
  const resourceUrl = url.searchParams.get("url");
  const scope = url.searchParams.get("scope") || undefined;

  if (!resourceUrl) {
    return new Response("Missing url parameter", { status: 400 });
  }

  try {
    const resourceUrlObj = new URL(resourceUrl);
    const hostname = resourceUrlObj.hostname;
    const callbackUrl = `${origin}${pathPrefix}/callback/${resourceType}/${hostname}`;

    const authFlowData = await constructAuthorizationUrl(
      resourceUrl,
      callbackUrl,
      clientInfo,
      resourceType,
      {
        scope,
        testRequest: async () => {
          return fetch(resourceUrl, {
            method: "HEAD",
            headers: { Accept: "*/*" }
          });
        }
      }
    );

    if (authFlowData.noAuthRequired) {
      let name = hostname;
      let metadata: Record<string, unknown> | undefined;

      if (onAuthSuccess) {
        try {
          const result = await onAuthSuccess(resourceUrl, resourceType, "");
          name = result.name;
          metadata = result.metadata;
        } catch (e) {
          // Use default name
        }
      }

      // For MCP, get name and icon from initialize response
      if (resourceType === "mcp") {
        const mcpInfo = await tryMcpInitialize(resourceUrl);
        if (mcpInfo) {
          name = mcpInfo.title || mcpInfo.name;
          metadata = metadata || {};
          if (mcpInfo.version) metadata.version = mcpInfo.version;
          if (mcpInfo.description) metadata.description = mcpInfo.description;
          if (mcpInfo.icons?.length) {
            metadata.icon = mcpInfo.icons[0].src;
          }
          if (mcpInfo.websiteUrl) metadata.websiteUrl = mcpInfo.websiteUrl;
        }
        // Fallback: scrape icon from apex domain
        if (!metadata?.icon) {
          const faviconUrl = await fetchApexFavicon(resourceUrl);
          if (faviconUrl) {
            metadata = metadata || {};
            metadata.icon = faviconUrl;
          }
        }
      }

      if (resourceType === "mcp") {
        await storage.addMcpServer(resourceUrl, name, profile, {
          isPublic: true,
          metadata
        });
      } else {
        await storage.addContext(resourceUrl, name, profile, {
          isPublic: true,
          metadata
        });
      }

      return new Response(createSuccessHTML(name, true), {
        headers: { "Content-Type": "text/html" }
      });
    }

    const authFlowCookie = encodeURIComponent(
      btoa(JSON.stringify({ ...authFlowData, hostname, profile }))
    );

    return new Response(null, {
      status: 302,
      headers: {
        Location: authFlowData.authorizationUrl!,
        "Set-Cookie": `oauth_auth_${resourceType}_${hostname}=${authFlowCookie}; HttpOnly;${
          isLocalhost ? "" : " Secure;"
        } SameSite=Lax; Max-Age=600; Path=/`
      }
    });
  } catch (error) {
    if (resourceType === "mcp" && resourceUrl) {
      const mcpInfo = await tryMcpInitialize(resourceUrl);
      if (mcpInfo) {
        const name = mcpInfo.title || mcpInfo.name;
        const metadata: Record<string, unknown> = {};
        if (mcpInfo.version) metadata.version = mcpInfo.version;
        if (mcpInfo.description) metadata.description = mcpInfo.description;
        if (mcpInfo.icons?.length) {
          metadata.icon = mcpInfo.icons[0].src;
        }
        if (mcpInfo.websiteUrl) metadata.websiteUrl = mcpInfo.websiteUrl;

        // Fallback: scrape icon from apex domain
        if (!metadata.icon) {
          const faviconUrl = await fetchApexFavicon(resourceUrl);
          if (faviconUrl) metadata.icon = faviconUrl;
        }

        await storage.addMcpServer(resourceUrl, name, profile, {
          isPublic: true,
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined
        });

        return new Response(createSuccessHTML(name, true), {
          headers: { "Content-Type": "text/html" }
        });
      }
    }

    return new Response(`Authorization failed: ${(error as Error).message}`, {
      status: 400
    });
  }
}

async function handleCallback(
  request: Request,
  storage: IdpStorage,
  defaultProfile: string,
  hostname: string,
  origin: string,
  clientInfo: ClientInfo,
  pathPrefix: string,
  resourceType: "mcp" | "context",
  onAuthSuccess?: (
    resourceUrl: string,
    resourceType: "mcp" | "context",
    accessToken: string
  ) => Promise<{ name: string; metadata?: Record<string, unknown> }>
): Promise<Response> {
  const url = new URL(request.url);
  const isLocalhost = url.hostname === "localhost";
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");

  if (!code || !stateParam) {
    return new Response("Missing code or state", { status: 400 });
  }

  const cookieName = `oauth_auth_${resourceType}_${hostname}`;
  const cookieHeader = request.headers.get("Cookie");
  let authFlowData:
    | (AuthorizationFlowData & { hostname: string; profile?: string })
    | undefined;

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

  if (stateParam !== authFlowData.state) {
    return new Response("Invalid state parameter", { status: 400 });
  }

  if (!authFlowData.clientId || !authFlowData.tokenEndpoint) {
    return new Response("Missing client credentials or token endpoint", {
      status: 400
    });
  }

  try {
    const tokenData = await exchangeCodeForToken(
      code,
      authFlowData,
      `${origin}${pathPrefix}/callback/${resourceType}/${hostname}`
    );

    if (!tokenData.access_token) {
      return new Response("No access token received", { status: 400 });
    }

    let name = hostname;
    let metadata: Record<string, unknown> | undefined;

    if (onAuthSuccess) {
      try {
        const result = await onAuthSuccess(
          authFlowData.resourceUrl,
          resourceType,
          tokenData.access_token
        );
        name = result.name;
        metadata = result.metadata;
      } catch (e) {
        // Use default name
      }
    }

    // For MCP, get name and icon from initialize response (with auth token)
    if (resourceType === "mcp") {
      const mcpInfo = await tryMcpInitialize(
        authFlowData.resourceUrl,
        tokenData.access_token
      );
      if (mcpInfo) {
        name = mcpInfo.title || mcpInfo.name;
        metadata = metadata || {};
        if (mcpInfo.version) metadata.version = mcpInfo.version;
        if (mcpInfo.description) metadata.description = mcpInfo.description;
        if (mcpInfo.icons?.length) {
          metadata.icon = mcpInfo.icons[0].src;
        }
        if (mcpInfo.websiteUrl) metadata.websiteUrl = mcpInfo.websiteUrl;
      }
      // Fallback: scrape icon from apex domain
      if (!metadata?.icon) {
        const faviconUrl = await fetchApexFavicon(authFlowData.resourceUrl);
        if (faviconUrl) {
          metadata = metadata || {};
          metadata.icon = faviconUrl;
        }
      }
    }

    const callbackProfile = authFlowData.profile || defaultProfile;
    const authOptions = {
      clientId: authFlowData.clientId,
      clientSecret: authFlowData.clientSecret,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenEndpoint: authFlowData.tokenEndpoint,
      expiresIn: tokenData.expires_in,
      scope: tokenData.scope || authFlowData.scope,
      isPublic: false,
      metadata
    };

    if (resourceType === "mcp") {
      await storage.addMcpServer(
        authFlowData.resourceUrl,
        name,
        callbackProfile,
        authOptions
      );
    } else {
      await storage.addContext(
        authFlowData.resourceUrl,
        name,
        callbackProfile,
        authOptions
      );
    }

    return new Response(createSuccessHTML(name, false), {
      headers: {
        "Content-Type": "text/html",
        "Set-Cookie": `oauth_auth_${resourceType}_${hostname}=; HttpOnly;${
          isLocalhost ? "" : " Secure;"
        } SameSite=Lax; Max-Age=0; Path=/`
      }
    });
  } catch (error) {
    return new Response(`Token exchange failed: ${(error as Error).message}`, {
      status: 400
    });
  }
}

// --- Standalone Utility Functions ---

export async function getAuthorizationForMcpServer(
  kv: IdpKV,
  userId: string,
  serverUrl: string,
  profile: string,
  options: {
    clientInfo?: ClientInfo;
    baseUrl?: string;
    pathPrefix?: string;
  } = {}
): Promise<{ Authorization?: string; loginUrl?: string }> {
  try {
    const storage = createStorage(kv, userId);
    const server = await storage.findMcpServerForUrl(serverUrl, profile);

    if (server?.refresh_token && server.expires_in && server.token_endpoint) {
      const now = Math.floor(Date.now() / 1000);
      const updatedAtSeconds = Math.floor(
        new Date(server.updated_at).getTime() / 1000
      );

      if (now >= updatedAtSeconds + server.expires_in - 300) {
        try {
          const tokenData = await refreshAccessToken(
            server.refresh_token,
            server.client_id || undefined,
            server.client_secret || undefined,
            server.token_endpoint,
            server.url
          );
          await storage.updateTokens(
            "mcp_servers",
            server.url,
            server.profile,
            tokenData.access_token,
            tokenData.refresh_token || server.refresh_token || undefined,
            tokenData.expires_in
          );
          return {
            Authorization: `${server.token_type || "Bearer"} ${tokenData.access_token}`
          };
        } catch (error) {
          // Refresh failed, fall through
        }
      }
    }

    if (server?.access_token) {
      return {
        Authorization: `${server.token_type || "Bearer"} ${server.access_token}`
      };
    }

    const base = options.baseUrl || "https://example.com";
    const prefix = options.pathPrefix || "/oauth";
    return {
      loginUrl: `${base}${prefix}/login/mcp?url=${encodeURIComponent(serverUrl)}`
    };
  } catch (error) {
    const base = options.baseUrl || "https://example.com";
    const prefix = options.pathPrefix || "/oauth";
    return {
      loginUrl: `${base}${prefix}/login/mcp?url=${encodeURIComponent(serverUrl)}`
    };
  }
}

export async function getAuthorizationForContext(
  kv: IdpKV,
  userId: string,
  contextUrl: string,
  profile: string,
  options: {
    clientInfo?: ClientInfo;
    baseUrl?: string;
    pathPrefix?: string;
  } = {}
): Promise<{ Authorization?: string; loginUrl?: string }> {
  try {
    const storage = createStorage(kv, userId);
    const context = await storage.findContextForUrl(contextUrl, profile);

    if (
      context?.refresh_token &&
      context.expires_in &&
      context.token_endpoint
    ) {
      const now = Math.floor(Date.now() / 1000);
      const updatedAtSeconds = Math.floor(
        new Date(context.updated_at).getTime() / 1000
      );

      if (now >= updatedAtSeconds + context.expires_in - 300) {
        try {
          const tokenData = await refreshAccessToken(
            context.refresh_token,
            context.client_id || undefined,
            context.client_secret || undefined,
            context.token_endpoint,
            context.url
          );
          await storage.updateTokens(
            "context",
            context.url,
            context.profile,
            tokenData.access_token,
            tokenData.refresh_token || context.refresh_token || undefined,
            tokenData.expires_in
          );
          return {
            Authorization: `${context.token_type || "Bearer"} ${tokenData.access_token}`
          };
        } catch (error) {
          // Refresh failed, fall through
        }
      }
    }

    if (context?.access_token) {
      return {
        Authorization: `${context.token_type || "Bearer"} ${context.access_token}`
      };
    }

    const base = options.baseUrl || "https://example.com";
    const prefix = options.pathPrefix || "/oauth";
    return {
      loginUrl: `${base}${prefix}/login/context?url=${encodeURIComponent(contextUrl)}`
    };
  } catch (error) {
    const base = options.baseUrl || "https://example.com";
    const prefix = options.pathPrefix || "/oauth";
    return {
      loginUrl: `${base}${prefix}/login/context?url=${encodeURIComponent(contextUrl)}`
    };
  }
}

// --- fetchUrlContext: extract URLs/markdown links, resolve auth via protected resource discovery, fetch ---

export async function fetchUrlContext(
  content: string,
  userId: string,
  profile: string,
  kv: IdpKV
): Promise<
  | { status: 401; error: string; url: string }
  | { status: 200; results: { url: string; content: string }[] }
> {
  const urls = new Set<string>();

  const mdLinkRe = /\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g;
  let m;
  while ((m = mdLinkRe.exec(content)) !== null) urls.add(m[2]);

  const plainUrlRe = /https?:\/\/[^\s<>\])"']+/g;
  while ((m = plainUrlRe.exec(content)) !== null) urls.add(m[0]);

  if (urls.size === 0) return { status: 200, results: [] };

  const storage = createStorage(kv, userId);
  const results: { url: string; content: string }[] = [];

  for (const url of urls) {
    // Try fetching directly first — if unprotected, return immediately
    const directResponse = await fetch(url);

    if (directResponse.ok) {
      results.push({ url, content: await directResponse.text() });
      continue;
    }

    if (directResponse.status !== 401) {
      continue;
    }

    // 401 — discover the protected resource's canonical resource URL
    const wwwAuth = directResponse.headers.get("WWW-Authenticate");
    const wwwAuthInfo = wwwAuth ? parseWWWAuthenticate(wwwAuth) : undefined;

    let resourceUrl: string | undefined;
    try {
      const resourceMetadata = await discoverProtectedResourceMetadata(
        url,
        wwwAuthInfo
      );
      resourceUrl = resourceMetadata.resource;
    } catch {
      return {
        status: 401,
        error: `Unauthorized: ${url} returned 401 and resource discovery failed`,
        url
      };
    }

    if (!resourceUrl) {
      return {
        status: 401,
        error: `Unauthorized: ${url} returned 401 and no resource URL discovered`,
        url
      };
    }

    // Look up the canonical resource URL in the KV
    const ctx = await storage.findContextForUrl(resourceUrl, profile);

    if (!ctx?.access_token) {
      return {
        status: 401,
        error: `Unauthorized: no token for ${url} (resource: ${resourceUrl})`,
        url
      };
    }

    // Refresh token if expiring within 5 minutes
    let accessToken = ctx.access_token;
    if (ctx.refresh_token && ctx.expires_in && ctx.token_endpoint) {
      const now = Math.floor(Date.now() / 1000);
      const updatedAt = Math.floor(
        new Date(ctx.updated_at).getTime() / 1000
      );
      if (now >= updatedAt + ctx.expires_in - 300) {
        try {
          const tokenData = await refreshAccessToken(
            ctx.refresh_token,
            ctx.client_id || undefined,
            ctx.client_secret || undefined,
            ctx.token_endpoint,
            ctx.url
          );
          await storage.updateTokens(
            "context",
            ctx.url,
            ctx.profile,
            tokenData.access_token,
            tokenData.refresh_token || ctx.refresh_token || undefined,
            tokenData.expires_in
          );
          accessToken = tokenData.access_token;
        } catch {
          // Use existing token
        }
      }
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `${ctx.token_type || "Bearer"} ${accessToken}`
      }
    });

    if (response.status === 401) {
      return {
        status: 401,
        error: `Unauthorized: ${url} returned 401 (token may be expired)`,
        url
      };
    }

    results.push({ url, content: await response.text() });
  }

  return { status: 200, results };
}

// --- createTools: resolve authorization for each MCP server ---

export async function createTools(
  servers: { server_url: string; [key: string]: unknown }[],
  userId: string,
  profile: string,
  kv: IdpKV
): Promise<
  {
    server_url: string;
    authorization?: string;
    status: 200 | 401 | 404;
    error?: string;
  }[]
> {
  const storage = createStorage(kv, userId);

  return Promise.all(
    servers.map(async (server) => {
      const mcpServer = await storage.findMcpServerForUrl(
        server.server_url,
        profile
      );

      if (!mcpServer) {
        return {
          server_url: server.server_url,
          status: 404 as const,
          error: "Server not found"
        };
      }

      if (!mcpServer.access_token && !mcpServer.public) {
        return {
          server_url: server.server_url,
          status: 401 as const,
          error: "Unauthorized"
        };
      }

      // Refresh token if expiring within 5 minutes
      let accessToken = mcpServer.access_token;
      if (
        mcpServer.refresh_token &&
        mcpServer.expires_in &&
        mcpServer.token_endpoint
      ) {
        const now = Math.floor(Date.now() / 1000);
        const updatedAt = Math.floor(
          new Date(mcpServer.updated_at).getTime() / 1000
        );
        if (now >= updatedAt + mcpServer.expires_in - 300) {
          try {
            const tokenData = await refreshAccessToken(
              mcpServer.refresh_token,
              mcpServer.client_id || undefined,
              mcpServer.client_secret || undefined,
              mcpServer.token_endpoint,
              mcpServer.url
            );
            await storage.updateTokens(
              "mcp_servers",
              mcpServer.url,
              mcpServer.profile,
              tokenData.access_token,
              tokenData.refresh_token || mcpServer.refresh_token || undefined,
              tokenData.expires_in
            );
            accessToken = tokenData.access_token;
          } catch {
            // Use existing token
          }
        }
      }

      return {
        server_url: server.server_url,
        status: 200 as const,
        ...(accessToken
          ? {
              authorization: `${mcpServer.token_type || "Bearer"} ${accessToken}`
            }
          : {})
      };
    })
  );
}
