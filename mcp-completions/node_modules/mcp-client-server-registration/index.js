/**
 * Generates a random code verifier for PKCE
 * @returns {string} Base64url-encoded code verifier
 */
function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Generates a code challenge from a code verifier using SHA256
 * @param {string} codeVerifier - The code verifier string
 * @returns {Promise<string>} Base64url-encoded SHA256 hash of the code verifier
 */
async function generateCodeChallenge(codeVerifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Generates a random state parameter for OAuth2 security
 * @returns {string} Random state string
 */
function generateRandomState() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Constructs an OAuth2 authorization URL for an MCP server following the MCP authorization specification.
 * This is a stateless function that performs all necessary discovery steps and returns
 * everything needed for the authorization flow.
 *
 * @param {string} mcpUrl - The URL of the MCP server to authorize against
 * @param {string} callbackUrl - The redirect URI for the OAuth2 callback
 * @param {{name: string;title: string;version: string;}} clientInfo - client info
 * @returns {Promise<{
 *   authorizationUrl?: string,
 *   codeVerifier?: string,
 *   state?: string,
 *   tokenEndpoint?: string,
 *   clientId?: string,
 *   clientSecret?: string,
 *   registrationResponse?: object,
 *   mcpServerUrl: string,
 *   authServerMetadata?: object,
 *   noAuthRequired?: boolean,
 *   accessToken?: string
 * }>} Authorization flow data needed for token exchange, or immediate access if no auth required
 * @throws {Error} When authorization server doesn't support required features or discovery fails
 */
export async function constructMCPAuthorizationUrl(
  mcpUrl,
  callbackUrl,
  clientInfo
) {
  // Step 1: Initial MCP request to check if auth is required
  let resourceMetadataUrl;
  let noAuthRequired = false;
  let accessToken = null;

  try {
    // Try MCP initialize request first
    const initResponse = await fetch(mcpUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json,text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {
            roots: {
              listChanged: true,
            },
            sampling: {},
          },
          clientInfo,
        },
      }),
    });

    if (initResponse.status === 200) {
      // No authentication required - MCP server is public
      noAuthRequired = true;

      return {
        mcpServerUrl: mcpUrl,
        noAuthRequired: true,
        accessToken: null, // Public servers don't need tokens
      };
    } else if (initResponse.status === 401) {
      // Extract resource metadata URL from WWW-Authenticate header
      const wwwAuth = initResponse.headers.get("WWW-Authenticate");
      if (wwwAuth) {
        const match = wwwAuth.match(/resource_metadata="([^"]+)"/);
        if (match) {
          resourceMetadataUrl = match[1];
        }
      }
    } else {
      throw new Error(`Unexpected response status: ${initResponse.status}`);
    }
  } catch (error) {
    // Continue with fallback approach for auth discovery
  }

  // Step 2: Discover authorization servers
  let authorizationServers = [];

  // Try to get protected resource metadata first (if we have a resourceMetadataUrl)
  if (resourceMetadataUrl) {
    try {
      const resourceResponse = await fetch(resourceMetadataUrl);
      if (resourceResponse.ok) {
        const resourceMetadata = await resourceResponse.json();
        if (
          resourceMetadata.authorization_servers &&
          Array.isArray(resourceMetadata.authorization_servers) &&
          resourceMetadata.authorization_servers.length > 0
        ) {
          authorizationServers = resourceMetadata.authorization_servers;
        }
      }
    } catch (error) {
      // Continue to fallback methods
    }
  }

  // Fallback 1: Try .well-known/oauth-protected-resource on MCP server host (SEP-985)
  if (authorizationServers.length === 0) {
    try {
      const mcpUrlObj = new URL(mcpUrl);
      const fallbackResourceUrl = new URL(
        "/.well-known/oauth-protected-resource",
        `${mcpUrlObj.protocol}//${mcpUrlObj.host}`
      ).toString();

      const resourceResponse = await fetch(fallbackResourceUrl);
      if (resourceResponse.ok) {
        const resourceMetadata = await resourceResponse.json();
        if (
          resourceMetadata.authorization_servers &&
          Array.isArray(resourceMetadata.authorization_servers) &&
          resourceMetadata.authorization_servers.length > 0
        ) {
          authorizationServers = resourceMetadata.authorization_servers;
        }
      }
    } catch (error) {
      // Continue to next fallback
    }
  }

  // Fallback 2: Assume authorization server is on same host as MCP server
  if (authorizationServers.length === 0) {
    const mcpUrlObj = new URL(mcpUrl);
    const assumedAuthServer = `${mcpUrlObj.protocol}//${mcpUrlObj.host}`;
    authorizationServers = [assumedAuthServer];
  }

  // Step 3: Try each authorization server until we find one that works
  let authMetadata, selectedAuthServer;
  const discoveryErrors = [];

  for (const authServerUrl of authorizationServers) {
    try {
      authMetadata = await discoverAuthServerMetadata(authServerUrl);
      selectedAuthServer = authServerUrl;
      break;
    } catch (error) {
      discoveryErrors.push(`${authServerUrl}: ${error.message}`);
      continue;
    }
  }

  if (!authMetadata || !selectedAuthServer) {
    throw new Error(
      `Could not discover authorization server metadata. Tried: ${discoveryErrors.join(
        ", "
      )}`
    );
  }

  // Step 4: Verify PKCE support (mandatory per draft spec)
  if (
    !authMetadata.code_challenge_methods_supported ||
    !authMetadata.code_challenge_methods_supported.includes("S256")
  ) {
    throw new Error(
      "Authorization server must support PKCE with S256 - this is mandatory per MCP specification"
    );
  }

  if (!authMetadata.authorization_endpoint || !authMetadata.token_endpoint) {
    throw new Error("Authorization server metadata missing required endpoints");
  }

  // Step 5: Dynamic client registration (if supported)
  let clientId, clientSecret, registrationResponse;

  if (authMetadata.registration_endpoint) {
    try {
      const registrationRequest = {
        redirect_uris: [callbackUrl],
        grant_types: ["authorization_code"],
        response_types: ["code"],
        client_name: clientInfo.name,
        application_type: "native",
      };

      const regResponse = await fetch(authMetadata.registration_endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registrationRequest),
      });

      if (!regResponse.ok) {
        throw new Error(
          `Client registration failed: ${
            regResponse.status
          } - ${await regResponse.text?.()}`
        );
      }

      registrationResponse = await regResponse.json();
      clientId = registrationResponse.client_id;
      clientSecret = registrationResponse.client_secret;
    } catch (error) {
      throw new Error(`Dynamic client registration failed: ${error.message}`);
    }
  } else {
    throw new Error(
      "Authorization server does not support dynamic client registration"
    );
  }

  // Step 6: Generate PKCE parameters
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateRandomState();

  // Step 7: Construct authorization URL
  const authUrl = new URL(authMetadata.authorization_endpoint);
  const params = {
    response_type: "code",
    client_id: clientId,
    redirect_uri: callbackUrl,
    resource: mcpUrl, // Canonical URI of MCP server
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state: state,
  };

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
    registrationResponse,
    mcpServerUrl: mcpUrl,
    authServerMetadata: authMetadata,
    noAuthRequired: false,
  };
}

/**
 * Discovers authorization server metadata using enhanced discovery mechanism from draft spec
 * @param {string} issuerUrl - The authorization server issuer URL
 * @returns {Promise<object>} Authorization server metadata
 * @throws {Error} When metadata discovery fails
 */
async function discoverAuthServerMetadata(issuerUrl) {
  const url = new URL(issuerUrl);
  const basePath = url.pathname === "/" ? "" : url.pathname;

  // Enhanced discovery endpoints per draft spec
  const endpoints = [];

  // For issuer URLs with path components
  if (basePath && basePath !== "") {
    endpoints.push(
      `/.well-known/oauth-authorization-server${basePath}`, // OAuth 2.0 with path insertion
      `/.well-known/openid-configuration${basePath}`, // OpenID Connect with path insertion
      `${basePath}/.well-known/openid-configuration` // OpenID Connect path appending
    );
  }

  // Standard endpoints (for URLs without path or as fallbacks)
  endpoints.push(
    `/.well-known/oauth-authorization-server`, // OAuth 2.0 standard
    `/.well-known/openid-configuration` // OpenID Connect standard
  );

  const discoveryErrors = [];

  for (const endpoint of endpoints) {
    try {
      const metadataUrl = new URL(endpoint, url.origin);
      const response = await fetch(metadataUrl);
      if (response.ok) {
        const metadata = await response.json();

        // Basic validation of required fields
        if (metadata.authorization_endpoint && metadata.token_endpoint) {
          // Enhanced PKCE verification per draft spec
          if (!metadata.code_challenge_methods_supported) {
            discoveryErrors.push(
              `${endpoint}: Missing code_challenge_methods_supported`
            );
            continue;
          }

          if (!metadata.code_challenge_methods_supported.includes("S256")) {
            discoveryErrors.push(
              `${endpoint}: S256 not supported in code_challenge_methods_supported`
            );
            continue;
          }

          return metadata;
        }

        discoveryErrors.push(`${endpoint}: Missing required endpoints`);
      } else {
        discoveryErrors.push(`${endpoint}: ${response.status}`);
      }
    } catch (error) {
      discoveryErrors.push(`${endpoint}: ${error.message}`);
      continue;
    }
  }

  throw new Error(
    `Could not discover authorization server metadata for ${issuerUrl}. Tried: ${discoveryErrors.join(
      ", "
    )}`
  );
}

/**
 * Extracts server information and tools from an MCP server
 * @param {{name: string; title: string; version: string}} clientInfo - Client information
 * @param {string} mcpUrl - The MCP server URL
 * @param {string} [accessToken] - Optional access token for authenticated requests
 * @returns {Promise<{serverName: string; tools: any[]}>} Server name and available tools
 * @throws {Error} When server request fails or server name cannot be extracted
 */
export async function extractMCPServerInfo(clientInfo, mcpUrl, accessToken) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json,text/event-stream",
    "MCP-Protocol-Version": "2025-06-18", // Add protocol version header
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  // First, initialize the connection
  const initResponse = await fetch(mcpUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {
          roots: { listChanged: true },
          sampling: {},
        },
        clientInfo,
      },
    }),
  });

  if (!initResponse.ok) {
    throw new Error(
      `MCP server request to ${mcpUrl} failed (access token: ${
        accessToken || "None"
      }): ${initResponse.status} - ${await initResponse.text()} `
    );
  }

  // Extract session ID from the initialization response
  const sessionId = initResponse.headers.get("Mcp-Session-Id");

  const contentType = initResponse.headers.get("content-type") || "";
  let serverName;

  if (contentType.includes("text/event-stream")) {
    const initResult = await parseSSEResponse(initResponse);
    if (!initResult.result?.serverInfo?.name) {
      throw new Error("Could not extract server name from SSE response");
    }
    serverName = initResult.result.serverInfo.name;
  } else {
    const initData = await initResponse.json();
    if (!initData.result?.serverInfo?.name) {
      throw new Error("Could not extract server name from JSON response");
    }
    serverName = initData.result.serverInfo.name;
  }

  // Send initialized notification with session ID if provided
  if (sessionId) {
    const initializedHeaders = { ...headers };
    initializedHeaders["Mcp-Session-Id"] = sessionId;

    await fetch(mcpUrl, {
      method: "POST",
      headers: initializedHeaders,
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "initialized",
        params: {},
      }),
    });
  }

  // Now get the tools list with session ID
  const toolsHeaders = { ...headers };
  if (sessionId) {
    toolsHeaders["Mcp-Session-Id"] = sessionId;
  }

  const toolsResponse = await fetch(mcpUrl, {
    method: "POST",
    headers: toolsHeaders,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    }),
  });

  let tools = [];

  if (!toolsResponse.ok) {
    console.error(
      "Tools response not ok",
      toolsResponse.status,
      await toolsResponse.text()
    );
  }

  if (toolsResponse.ok) {
    const toolsContentType = toolsResponse.headers.get("content-type") || "";

    if (toolsContentType.includes("text/event-stream")) {
      try {
        const toolsResult = await parseSSEResponse(toolsResponse);
        if (
          toolsResult.result?.tools &&
          Array.isArray(toolsResult.result.tools)
        ) {
          tools = toolsResult.result.tools;
        }
      } catch (e) {
        // Tools list failed, but that's OK - continue without tools
      }
    } else {
      try {
        const toolsData = await toolsResponse.json();
        if (toolsData.result?.tools && Array.isArray(toolsData.result.tools)) {
          tools = toolsData.result.tools;
        }
      } catch (e) {
        // Tools list failed, but that's OK - continue without tools
      }
    }
  }

  return { serverName, tools };
}

/**
 * Parses Server-Sent Events (SSE) response from MCP server
 * @param {Response} response - The fetch Response object with SSE content
 * @returns {Promise<any>} Parsed JSON data from the SSE stream
 * @throws {Error} When response body is unavailable or parsing fails
 */
async function parseSSEResponse(response) {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");

      // Keep the last incomplete line in the buffer
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("event: message")) {
          // Look for the next data line
          continue;
        }
        if (line.startsWith("data: ")) {
          const jsonStr = line.substring(6);
          try {
            const data = JSON.parse(jsonStr);
            if (data.result) {
              return data;
            }
          } catch (e) {
            continue;
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  throw new Error("Could not parse SSE response");
}
