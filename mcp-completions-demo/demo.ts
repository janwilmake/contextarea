import { withSimplerAuth } from "simplerauth-client";
import { chatCompletionsProxy, MCPProviders } from "../mcp-completions";

export { MCPProviders };

const HTML_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MCP IDP Completions</title>
    <style>
        @font-face {
            font-family: 'FTSystemMono';
            src: url('https://assets.p0web.com/FTSystemMono-Regular.woff2') format('woff2');
            font-weight: 400;
            font-style: normal;
        }

        @font-face {
            font-family: 'FTSystemMono';
            src: url('https://assets.p0web.com/FTSystemMono-Medium.woff2') format('woff2');
            font-weight: 500;
            font-style: normal;
        }

        @font-face {
            font-family: 'GerstnerProgramm';
            src: url('https://assets.p0web.com/Gerstner-ProgrammRegular.woff2') format('woff2');
            font-weight: 400;
            font-style: normal;
        }

        @font-face {
            font-family: 'GerstnerProgramm';
            src: url('https://assets.p0web.com/Gerstner-ProgrammMedium.woff2') format('woff2');
            font-weight: 500;
            font-style: normal;
        }

        :root {
            --off-white: #fcfcfa;
            --index-black: #1d1b16;
            --neural: #d8d0bf;
            --signal: #fb631b;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'FTSystemMono', monospace;
            background: var(--off-white);
            color: var(--index-black);
            line-height: 1.4;
            min-height: 100vh;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }

        h1 {
            font-family: 'GerstnerProgramm', serif;
            font-size: 2.5rem;
            font-weight: 500;
            margin-bottom: 2rem;
            color: var(--index-black);
        }

        .form-section {
            background: white;
            border: 1px solid var(--neural);
            border-radius: 8px;
            padding: 1.5rem;
            margin-bottom: 1.5rem;
        }

        .form-section h2 {
            font-family: 'GerstnerProgramm', serif;
            font-size: 1.25rem;
            font-weight: 500;
            margin-bottom: 1rem;
            color: var(--signal);
        }

        .form-group {
            margin-bottom: 1rem;
        }

        label {
            display: block;
            font-weight: 500;
            margin-bottom: 0.5rem;
            font-size: 0.9rem;
        }

        input,
        textarea,
        button {
            font-family: 'FTSystemMono', monospace;
            font-size: 0.9rem;
        }

        input,
        textarea {
            width: 100%;
            padding: 0.75rem;
            border: 1px solid var(--neural);
            border-radius: 4px;
            background: var(--off-white);
            color: var(--index-black);
        }

        input:focus,
        textarea:focus {
            outline: none;
            border-color: var(--signal);
        }

        textarea {
            min-height: 100px;
            resize: vertical;
        }

        button {
            background: var(--signal);
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 500;
            transition: opacity 0.2s;
        }

        button:hover:not(:disabled) {
            opacity: 0.9;
        }

        button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        .user-info {
            background: var(--neural);
            padding: 1rem;
            border-radius: 4px;
            margin-bottom: 1rem;
            font-size: 0.85rem;
        }

        .response-section {
            margin-top: 2rem;
        }

        .response {
            background: white;
            border: 1px solid var(--neural);
            border-radius: 8px;
            padding: 1.5rem;
            min-height: 200px;
            white-space: pre-wrap;
            font-family: 'FTSystemMono', monospace;
            font-size: 0.9rem;
            line-height: 1.6;
        }

        .response.streaming {
            border-color: var(--signal);
        }

        .error {
            background: #fef2f2;
            color: #dc2626;
            border-color: #fecaca;
        }

        .provider {
            border: 1px solid var(--neural);
            border-radius: 8px;
            padding: 1rem;
            margin-bottom: 1rem;
            background: var(--off-white);
        }

        .provider.authenticated {
            border-color: #22c55e;
            background: #f0fdf4;
        }

        .provider.unauthenticated {
            border-color: #ef4444;
            background: #fef2f2;
        }

        .provider-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 0.5rem;
        }

        .provider-name {
            font-weight: 500;
            font-size: 1rem;
        }

        .provider-status {
            font-size: 0.8rem;
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            font-weight: 500;
        }

        .status-authenticated {
            background: #22c55e;
            color: white;
        }

        .status-unauthenticated {
            background: #ef4444;
            color: white;
        }

        .provider-url {
            font-size: 0.8rem;
            color: #666;
            margin-bottom: 0.5rem;
        }

        .provider-tools {
            font-size: 0.8rem;
            color: #666;
            margin-bottom: 1rem;
        }

        .provider-actions {
            display: flex;
            gap: 0.5rem;
            align-items: center;
        }

        .provider-checkbox {
            margin-right: 0.5rem;
        }

        .btn-small {
            padding: 0.5rem 1rem;
            font-size: 0.8rem;
        }

        .btn-danger {
            background: #dc2626;
        }

        .btn-secondary {
            background: var(--neural);
            color: var(--index-black);
        }

        .add-server-section {
            display: flex;
            gap: 0.5rem;
            align-items: center;
        }

        .add-server-section input {
            flex: 1;
        }

        .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
        }

        /* Enhanced markdown rendering styles */
        .response.rendered {
            white-space: normal;
            font-family: inherit;
        }

        /* Code block styles */
        .response.rendered pre {
            background: #f8f9fa;
            border: 1px solid var(--neural);
            border-radius: 4px;
            padding: 1rem;
            overflow-x: auto;
            margin: 1rem 0;
            font-family: 'FTSystemMono', monospace;
            font-size: 0.85rem;
            line-height: 1.4;
        }

        .response.rendered code {
            font-family: 'FTSystemMono', monospace;
            font-size: 0.85rem;
        }

        .response.rendered p code {
            background: #f1f3f4;
            padding: 0.2rem 0.4rem;
            border-radius: 3px;
            font-size: 0.85rem;
        }

        /* Details/Summary styles */
        .response.rendered details {
            border: 1px solid var(--neural);
            border-radius: 4px;
            margin: 1rem 0;
            overflow: hidden;
        }

        .response.rendered summary {
            background: #f8f9fa;
            padding: 0.75rem 1rem;
            cursor: pointer;
            font-weight: 500;
            user-select: none;
            border-bottom: 1px solid var(--neural);
            transition: background-color 0.2s;
        }

        .response.rendered summary:hover {
            background: #e9ecef;
        }

        .response.rendered details[open] summary {
            background: #e9ecef;
            border-bottom: 1px solid var(--neural);
        }

        .response.rendered details>*:not(summary) {
            padding: 1rem;
        }

        .response.rendered details pre {
            margin: 0;
            border: none;
            border-radius: 0;
        }

        /* Headings */
        .response.rendered h1,
        .response.rendered h2,
        .response.rendered h3,
        .response.rendered h4,
        .response.rendered h5,
        .response.rendered h6 {
            font-family: 'GerstnerProgramm', serif;
            font-weight: 500;
            margin: 1.5rem 0 1rem 0;
            color: var(--index-black);
        }

        .response.rendered h1 {
            font-size: 2rem;
        }

        .response.rendered h2 {
            font-size: 1.5rem;
        }

        .response.rendered h3 {
            font-size: 1.25rem;
        }

        .response.rendered h4 {
            font-size: 1.1rem;
        }

        .response.rendered h5 {
            font-size: 1rem;
        }

        .response.rendered h6 {
            font-size: 0.9rem;
        }

        /* Lists */
        .response.rendered ul,
        .response.rendered ol {
            margin: 1rem 0;
            padding-left: 2rem;
        }

        .response.rendered li {
            margin: 0.25rem 0;
        }

        /* Paragraphs */
        .response.rendered p {
            margin: 1rem 0;
        }

        /* Blockquotes */
        .response.rendered blockquote {
            border-left: 4px solid var(--signal);
            padding-left: 1rem;
            margin: 1rem 0;
            font-style: italic;
            color: #666;
        }

        /* Tables */
        .response.rendered table {
            border-collapse: collapse;
            width: 100%;
            margin: 1rem 0;
        }

        .response.rendered th,
        .response.rendered td {
            border: 1px solid var(--neural);
            padding: 0.5rem;
            text-align: left;
        }

        .response.rendered th {
            background: #f8f9fa;
            font-weight: 500;
        }

        /* Links */
        .response.rendered a {
            color: var(--signal);
            text-decoration: none;
        }

        .response.rendered a:hover {
            text-decoration: underline;
        }

        /* Strong and em */
        .response.rendered strong {
            font-weight: 500;
            color: var(--index-black);
        }

        .response.rendered em {
            font-style: italic;
        }

        @media (max-width: 768px) {
            .grid {
                grid-template-columns: 1fr;
            }

            .container {
                padding: 1rem;
            }

            h1 {
                font-size: 2rem;
            }

            .response.rendered pre {
                padding: 0.75rem;
                font-size: 0.8rem;
            }

            .provider-actions {
                flex-direction: column;
                gap: 0.25rem;
            }

            .add-server-section {
                flex-direction: column;
            }
        }
    </style>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/marked@12.0.0/marked.min.js"></script>
    <script id="providers-data" type="application/json"></script>
    <script id="user-data" type="application/json"></script>
    <script>
        window.PROVIDERS_DATA = JSON.parse(document.getElementById('providers-data').textContent);
        window.USER_DATA = JSON.parse(document.getElementById('user-data').textContent);
    </script>
</head>

<body>
    <div class="container">
        <h1>MCP IDP Completions</h1>

        <div class="form-section">
            <h2>Configuration</h2>
            <div class="grid">
                <div class="form-group">
                    <label for="basepath">Base Path:</label>
                    <input type="url" id="basepath" placeholder="https://api.openai.com" />
                </div>
                <div class="form-group">
                    <label for="apikey">API Key:</label>
                    <input type="password" id="apikey" placeholder="sk-..." />
                </div>
            </div>
            <div class="grid">
                <div class="form-group">
                    <label for="model">Model:</label>
                    <input type="text" id="model" placeholder="gpt-4" />
                </div>
                <div class="form-group">
                    <label>User Info:</label>
                    <div class="user-info" id="userInfo">Loading...</div>
                </div>
            </div>
        </div>

        <div class="form-section">
            <h2>MCP Providers</h2>
            <div id="providersContainer"></div>
            
            <div class="form-group">
                <label>Add New Server:</label>
                <div class="add-server-section">
                    <input type="url" id="newServerUrl" placeholder="https://mcp-server.example.com" />
                    <button type="button" class="btn-small" onclick="addNewServer()">Authorize & Add</button>
                </div>
            </div>
        </div>

        <div class="form-section">
            <h2>Message</h2>
            <div class="form-group">
                <textarea id="message" placeholder="Enter your message here..."></textarea>
            </div>
            <button id="sendBtn" onclick="sendMessage()">Send Message</button>
        </div>

        <div class="response-section">
            <div class="form-section">
                <h2>Response</h2>
                <div id="response" class="response"></div>
            </div>
        </div>
    </div>

    <script>
        let currentUser = null;
        let providers = [];

        // Configure marked for better HTML rendering
        marked.setOptions({
            breaks: true,
            gfm: true,
            headerIds: false,
            mangle: false
        });

        // Custom renderer to handle details/summary and links
        const renderer = new marked.Renderer();

        // Override link rendering to add target="_blank" and rel="noopener noreferrer"
        renderer.link = function (href, title, text) {
            // Check if it's an external link (starts with http/https or is a full URL)
            const isExternal = /^https?:\/\//.test(href) || href.includes('://');

            let linkHtml = \`<a href="\${href}"\`;

            if (title) {
                linkHtml += \` title="\${title}"\`;
            }

            if (isExternal) {
                linkHtml += ' target="_blank" rel="noopener noreferrer"';
            }

            linkHtml += \`>\${text}</a>\`;

            return linkHtml;
        };

        // Override HTML rendering to allow details/summary
        const originalHtml = renderer.html;
        renderer.html = function (html) {
            // Allow details and summary tags to pass through
            if (html.match(/^<\\/?(?:details|summary)(?:\\s[^>]*)?>\$/)) {
                return html;
            }
            return originalHtml ? originalHtml.call(this, html) : html;
        };

        marked.use({ renderer });

        // Load saved configuration
        function loadConfig() {
            document.getElementById('basepath').value = localStorage.getItem('basepath') || '';
            document.getElementById('apikey').value = localStorage.getItem('apikey') || '';
            document.getElementById('model').value = localStorage.getItem('model') || 'gpt-4';
        }

        // Save configuration
        function saveConfig() {
            localStorage.setItem('basepath', document.getElementById('basepath').value);
            localStorage.setItem('apikey', document.getElementById('apikey').value);
            localStorage.setItem('model', document.getElementById('model').value);
        }

        // Auto-save on input
        ['basepath', 'apikey', 'model'].forEach(id => {
            document.getElementById(id).addEventListener('input', saveConfig);
        });

        // Initialize user data
        function initializeUserData() {
            if (window.USER_DATA) {
                currentUser = window.USER_DATA;
                document.getElementById('userInfo').textContent = \`Authenticated as: \${currentUser.name || currentUser.username}\`;
            } else {
                document.getElementById('userInfo').textContent = 'Not authenticated';
            }
        }

        // Initialize providers
        function initializeProviders() {
            if (window.PROVIDERS_DATA) {
                providers = window.PROVIDERS_DATA;
                renderProviders();
            }
        }

        // Render providers
        function renderProviders() {
            const container = document.getElementById('providersContainer');
            
            if (!providers.length) {
                container.innerHTML = '<p style="color: #666; font-style: italic;">No MCP providers configured. Add one below to get started.</p>';
                return;
            }

            container.innerHTML = providers.map(provider => {
                const isAuthenticated = !!provider.access_token;
                const toolCount = provider.tools ? provider.tools.length : 0;
                
                return \`
                    <div class="provider \${isAuthenticated ? 'authenticated' : 'unauthenticated'}">
                        <div class="provider-header">
                            <div class="provider-name">\${provider.name || provider.hostname}</div>
                            <div class="provider-status \${isAuthenticated ? 'status-authenticated' : 'status-unauthenticated'}">
                                \${isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
                            </div>
                        </div>
                        <div class="provider-url">\${provider.mcp_url}</div>
                        <div class="provider-tools">\${toolCount} tool\${toolCount !== 1 ? 's' : ''} available</div>
                        <div class="provider-actions">
                            <label>
                                <input type="checkbox" class="provider-checkbox" data-url="\${provider.mcp_url}" \${isAuthenticated ? 'checked' : ''}>
                                Include in chat
                            </label>
                            <button class="btn-small btn-secondary" onclick="reauthorizeProvider('\${provider.mcp_url}')">
                                \${isAuthenticated ? 'Reauthorize' : 'Authorize'}
                            </button>
                            <button class="btn-small btn-danger" onclick="removeProvider('\${provider.mcp_url}')">
                                Remove
                            </button>
                        </div>
                    </div>
                \`;
            }).join('');
        }

        // Add new server
        async function addNewServer() {
            const url = document.getElementById('newServerUrl').value.trim();
            if (!url) {
                alert('Please enter a server URL');
                return;
            }

            try {
                // Redirect to authorization
                window.open(\`/mcp/login?url=\${encodeURIComponent(url)}\`,"_blank");
            } catch (error) {
                alert('Error adding server: ' + error.message);
            }
        }

        // Reauthorize provider
        function reauthorizeProvider(url) {
          window.open(\`/mcp/login?url=\${encodeURIComponent(url)}\`,"_blank");
        }

        // Remove provider
        async function removeProvider(url) {
            if (!confirm(\`Are you sure you want to remove the provider for \${new URL(url).hostname}?\`)) {
                return;
            }

            try {
                const response = await fetch(\`/mcp/remove?url=\${encodeURIComponent(url)}\`, {
                    method: 'POST'
                });

                if (!response.ok) {
                    throw new Error(\`Failed to remove provider: \${response.statusText}\`);
                }

                // Remove from local providers array and re-render
                providers = providers.filter(p => p.mcp_url !== url);
                renderProviders();
            } catch (error) {
                alert('Error removing provider: ' + error.message);
            }
        }

        // Get selected providers
        function getSelectedProviders() {
            const checkboxes = document.querySelectorAll('.provider-checkbox:checked');
            return Array.from(checkboxes).map(cb => cb.dataset.url);
        }

        // Send message
        async function sendMessage() {
            const basepath = document.getElementById('basepath').value;
            const apikey = document.getElementById('apikey').value;
            const model = document.getElementById('model').value;
            const message = document.getElementById('message').value;
            const responseDiv = document.getElementById('response');
            const sendBtn = document.getElementById('sendBtn');

            if (!basepath || !apikey || !model || !message || !currentUser) {
                alert('Please fill in all required fields and authenticate.');
                return;
            }

            // Get selected MCP servers
            const selectedUrls = getSelectedProviders();
            
            // Build tools array
            const tools = selectedUrls.map(serverUrl => ({
                type: "mcp",
                server_url: serverUrl,
                require_approval: "never"
            }));

            const requestBody = {
                model,
                messages: [
                    {
                        role: "user",
                        content: message
                    }
                ],
                stream: true,
            };

            if (tools.length > 0) {
                requestBody.tools = tools;
            }

            sendBtn.disabled = true;
            responseDiv.textContent = '';
            responseDiv.className = 'response streaming';

            try {
                // Extract hostname from basepath for the proxy URL
                const baseUrl = new URL(basepath);
                const hostname = baseUrl.hostname;
                const path = baseUrl.pathname.replace(/\\/\$/, '');

                const proxyUrl = \`/\${hostname}\${path}/chat/completions\`;

                const response = await fetch(proxyUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-LLM-API-KEY': apikey
                    },
                    body: JSON.stringify(requestBody)
                });

                if (!response.ok) {
                    throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                let fullContent = '';
                let type = 'content';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value);
                    const lines = buffer.split('\\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (!line.startsWith('data: ') || line === 'data: [DONE]') {
                            continue;
                        }

                        try {
                            const data = JSON.parse(line.slice(6));
                            const choice = data.choices?.[0];
                            if (choice?.delta) {
                                const delta = choice.delta;

                                // Handle all types of content
                                if (delta.content) {
                                    fullContent += delta.content;
                                    renderMarkdown(fullContent);
                                }

                                if (delta.reasoning_content) {
                                    if (type !== 'reasoning') {
                                        fullContent += '\\n\\n**REASONING:**\\n\\n';
                                    }

                                    fullContent += delta.reasoning_content
                                    type = 'reasoning'

                                    renderMarkdown(fullContent);
                                }

                                if (delta.refusal) {
                                    fullContent += \`\\n\\n**[Refusal]**: \${delta.refusal}\`;
                                    renderMarkdown(fullContent);
                                }
                            }
                        } catch (e) {
                            // Ignore invalid JSON
                        }
                    }
                }

                responseDiv.className = 'response rendered';

            } catch (error) {
                console.error('Request failed:', error);
                responseDiv.textContent = \`Error: \${error.message}\`;
                responseDiv.className = 'response error';
            } finally {
                sendBtn.disabled = false;
            }
        }

        // Enhanced markdown rendering with code highlighting
        function renderMarkdown(content) {
            const responseDiv = document.getElementById('response');
            try {
                // Parse markdown
                let html = marked.parse(content);

                // Create a temporary div to manipulate the HTML
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = html;

                // Highlight code blocks
                const codeBlocks = tempDiv.querySelectorAll('pre code');
                codeBlocks.forEach(block => {
                    // Auto-detect language or use manual highlighting
                    if (typeof hljs !== 'undefined') {
                        hljs.highlightElement(block);
                    }
                });

                // Set the final HTML
                responseDiv.innerHTML = tempDiv.innerHTML;
                responseDiv.className = 'response rendered streaming';

            } catch (error) {
                // Fallback to plain text
                responseDiv.textContent = content;
                responseDiv.className = 'response streaming';
            }
        }

        // Handle Enter key in message textarea
        document.getElementById('message').addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                sendMessage();
            }
        });

        // Initialize
        document.addEventListener('DOMContentLoaded', function () {
            loadConfig();
            initializeUserData();
            initializeProviders();
        });
    </script>
</body>

</html>
`;

// HTMLRewriter class to inject JSON data securely
class DataInjector {
  providersData: any;
  userData: any;
  constructor(providersData, userData) {
    this.providersData = providersData;
    this.userData = userData;
  }

  element(element) {
    const id = element.getAttribute("id");
    if (id === "providers-data") {
      element.setInnerContent(JSON.stringify(this.providersData), {
        html: false,
      });
    } else if (id === "user-data") {
      element.setInnerContent(JSON.stringify(this.userData), { html: false });
    }
  }
}

export default {
  fetch: withSimplerAuth(
    async (request, env, ctx) => {
      const url = new URL(request.url);

      // Initialize the proxy with user context
      const { idpMiddleware, fetchProxy, getProviders, removeMcp } =
        chatCompletionsProxy(env, {
          baseUrl: new URL(request.url).origin,
          userId: ctx.user.id,
          clientInfo: {
            name: "MCP Chat Proxy",
            title: "MCP Chat Completions Proxy",
            version: "1.0.0",
          },
        });

      // Handle MCP OAuth routes
      const mcpResponse = await idpMiddleware(request, env, ctx);
      if (mcpResponse) {
        return mcpResponse;
      }

      // Handle provider removal API
      if (url.pathname === "/mcp/remove" && request.method === "POST") {
        const targetUrl = url.searchParams.get("url");
        if (!targetUrl) {
          return new Response("Missing url parameter", { status: 400 });
        }

        try {
          await removeMcp(targetUrl);
          return new Response("OK", { status: 200 });
        } catch (error) {
          return new Response(`Error removing provider: ${error.message}`, {
            status: 500,
          });
        }
      }

      // Handle main page
      if (url.pathname === "/" && request.method === "GET") {
        try {
          // Get providers data
          const providers = await getProviders();
          const userData = ctx.user;

          // Create response with HTML template
          const response = new Response(HTML_TEMPLATE, {
            headers: { "Content-Type": "text/html" },
          });

          // Use HTMLRewriter to securely inject JSON data
          return new HTMLRewriter()
            .on(
              'script[id="providers-data"]',
              new DataInjector(providers, userData)
            )
            .on('script[id="user-data"]', new DataInjector(providers, userData))
            .transform(response);
        } catch (error) {
          console.error("Error loading providers:", error);
          // Return HTML with empty providers on error
          const response = new Response(HTML_TEMPLATE, {
            headers: { "Content-Type": "text/html" },
          });

          return new HTMLRewriter()
            .on('script[id="providers-data"]', new DataInjector([], ctx.user))
            .on('script[id="user-data"]', new DataInjector([], ctx.user))
            .transform(response);
        }
      }

      // Parse hostname and path for LLM endpoint
      const pathSegments = url.pathname.split("/").filter(Boolean);

      if (pathSegments.length < 2) {
        return new Response(
          "Path should be /{hostnameAndPrefix}/chat/completions",
          { status: 400 }
        );
      }

      const targetHostname = pathSegments[0];
      const remainingPath = "/" + pathSegments.slice(1).join("/");

      if (!remainingPath.endsWith("/chat/completions")) {
        return new Response("Only /chat/completions endpoints are supported", {
          status: 404,
        });
      }

      if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
      }

      const llmApiKey = request.headers.get("X-LLM-API-KEY");
      if (!llmApiKey) {
        return new Response("x-llm-api-key not provided", { status: 400 });
      }

      const llmEndpoint = `https://${targetHostname}${remainingPath}`;
      console.log({ llmEndpoint });

      // Use the fetchProxy to handle the request
      return fetchProxy(llmEndpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${llmApiKey}`,
          "Content-Type": "application/json",
        },
        body: request.body,
      });
    },
    { isLoginRequired: true }
  ),
};
