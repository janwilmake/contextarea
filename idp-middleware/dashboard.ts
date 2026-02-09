/// <reference types="@cloudflare/workers-types" />
import {
  createIdpMiddleware,
  type IdpKV,
  type ClientInfo
} from "./idp-middleware";

interface Env {
  KV_STORE: KVNamespace;
}

function kvFromNamespace(ns: KVNamespace): IdpKV {
  return {
    async get(key: string) {
      return ns.get(key);
    },
    async set(key: string, value: string) {
      await ns.put(key, value);
    },
    async del(key: string) {
      await ns.delete(key);
    },
    async list(prefix: string) {
      const keys: string[] = [];
      let cursor: string | undefined;
      do {
        const result = await ns.list({ prefix, cursor });
        for (const key of result.keys) keys.push(key.name);
        cursor = result.list_complete ? undefined : result.cursor;
      } while (cursor);
      return keys;
    }
  };
}

function getUserFromCookie(request: Request): {
  username: string;
  profile: string;
} | null {
  const cookie = request.headers.get("Cookie");
  if (!cookie) return null;
  const match = cookie.match(/idp_user=([^;]+)/);
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

function setUserCookie(
  username: string,
  profile: string,
  isLocalhost: boolean
): string {
  const value = encodeURIComponent(JSON.stringify({ username, profile }));
  return `idp_user=${value}; Path=/; Max-Age=31536000; SameSite=Lax;${isLocalhost ? "" : " Secure;"} HttpOnly`;
}

function clearUserCookie(isLocalhost: boolean): string {
  return `idp_user=; Path=/; Max-Age=0; SameSite=Lax;${isLocalhost ? "" : " Secure;"} HttpOnly`;
}

const CLIENT_INFO: ClientInfo = {
  name: "IDP Dashboard",
  version: "1.0.0",
  uri: "https://idp-dashboard.example.com"
};

function getIdpForUser(username: string, profile: string, env: Env, baseUrl: string) {
  const kv = kvFromNamespace(env.KV_STORE);
  return createIdpMiddleware(
    { kv, userId: username, profile, clientInfo: CLIENT_INFO, baseUrl, pathPrefix: "/oauth" }
  );
}

function getDashboardHTML(
  user: { username: string; profile: string } | null
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>IDP Middleware Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f1117;
      color: #e4e4e7;
      min-height: 100vh;
    }
    header {
      background: #18181b;
      border-bottom: 1px solid #27272a;
      padding: 16px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    header h1 { font-size: 18px; font-weight: 600; color: #fafafa; }
    .user-badge {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 14px;
      color: #a1a1aa;
    }
    .user-badge strong { color: #fafafa; }
    .user-badge button, .user-badge select {
      background: none;
      border: 1px solid #3f3f46;
      color: #a1a1aa;
      padding: 4px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
    }
    .user-badge button:hover { border-color: #52525b; color: #e4e4e7; }
    .user-badge select {
      background: #18181b;
      color: #fafafa;
      appearance: auto;
    }
    .user-badge select:hover { border-color: #52525b; }
    .container { max-width: 960px; margin: 0 auto; padding: 32px 24px; }

    /* Login card */
    .login-card {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 12px;
      padding: 40px;
      max-width: 440px;
      margin: 80px auto;
    }
    .login-card h2 { font-size: 22px; margin-bottom: 8px; color: #fafafa; }
    .login-card p { color: #71717a; margin-bottom: 24px; font-size: 14px; }
    .form-group { margin-bottom: 16px; }
    .form-group label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: #a1a1aa;
      margin-bottom: 6px;
    }
    .form-group input {
      width: 100%;
      padding: 10px 12px;
      background: #09090b;
      border: 1px solid #27272a;
      border-radius: 8px;
      color: #fafafa;
      font-size: 14px;
      outline: none;
      transition: border-color 0.15s;
    }
    .form-group input:focus { border-color: #3b82f6; }
    .form-group input::placeholder { color: #52525b; }
    .btn-primary {
      width: 100%;
      padding: 10px;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      margin-top: 8px;
      transition: background 0.15s;
    }
    .btn-primary:hover { background: #2563eb; }

    /* Profile picker */
    .profile-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 12px;
      margin-bottom: 24px;
    }
    .profile-card {
      background: #09090b;
      border: 2px solid #27272a;
      border-radius: 10px;
      padding: 20px 16px;
      text-align: center;
      cursor: pointer;
      transition: all 0.15s;
      font-size: 15px;
      font-weight: 500;
      color: #fafafa;
    }
    .profile-card:hover {
      border-color: #3b82f6;
      background: #1a1a2e;
    }
    .profile-card.new-profile {
      border-style: dashed;
      color: #71717a;
      font-weight: 400;
    }
    .profile-card.new-profile:hover {
      border-color: #22c55e;
      color: #a1a1aa;
    }
    .new-profile-form {
      display: flex;
      gap: 8px;
      margin-bottom: 24px;
    }
    .new-profile-form input {
      flex: 1;
      padding: 10px 12px;
      background: #09090b;
      border: 1px solid #27272a;
      border-radius: 8px;
      color: #fafafa;
      font-size: 14px;
      outline: none;
    }
    .new-profile-form input:focus { border-color: #3b82f6; }
    .new-profile-form input::placeholder { color: #52525b; }
    .new-profile-form button {
      padding: 10px 20px;
      background: #22c55e;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
    }
    .new-profile-form button:hover { background: #16a34a; }
    .back-link {
      color: #71717a;
      font-size: 13px;
      cursor: pointer;
      display: inline-block;
      margin-bottom: 16px;
    }
    .back-link:hover { color: #a1a1aa; }

    /* Dashboard sections */
    .section {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 12px;
      margin-bottom: 24px;
      overflow: hidden;
    }
    .section-header {
      padding: 16px 20px;
      border-bottom: 1px solid #27272a;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .section-header h2 { font-size: 16px; font-weight: 600; color: #fafafa; }
    .section-header .count {
      background: #27272a;
      color: #a1a1aa;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }

    /* Add form */
    .add-form {
      display: flex;
      gap: 8px;
      padding: 16px 20px;
      border-bottom: 1px solid #27272a;
      background: #141416;
    }
    .add-form input {
      flex: 1;
      padding: 8px 12px;
      background: #09090b;
      border: 1px solid #27272a;
      border-radius: 6px;
      color: #fafafa;
      font-size: 13px;
      outline: none;
    }
    .add-form input:focus { border-color: #3b82f6; }
    .add-form input::placeholder { color: #52525b; }
    .add-form .btn-add {
      padding: 8px 16px;
      background: #22c55e;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.15s;
    }
    .add-form .btn-add:hover { background: #16a34a; }

    /* List items */
    .list-empty {
      padding: 40px 20px;
      text-align: center;
      color: #52525b;
      font-size: 14px;
    }
    .list-item {
      padding: 14px 20px;
      border-bottom: 1px solid #27272a;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: background 0.1s;
    }
    .list-item:last-child { border-bottom: none; }
    .list-item:hover { background: #1c1c1f; }
    .item-info { flex: 1; min-width: 0; }
    .item-name {
      font-size: 14px;
      font-weight: 500;
      color: #fafafa;
      margin-bottom: 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .item-url {
      font-size: 12px;
      color: #71717a;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-family: 'SF Mono', Menlo, monospace;
    }
    .item-meta {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-left: 16px;
      flex-shrink: 0;
    }
    .badge {
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
    }
    .badge-public { background: #052e16; color: #4ade80; }
    .badge-auth { background: #172554; color: #60a5fa; }
    .btn-remove {
      padding: 6px 12px;
      background: none;
      border: 1px solid #3f3f46;
      color: #a1a1aa;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .btn-remove:hover {
      border-color: #dc2626;
      color: #ef4444;
      background: rgba(239, 68, 68, 0.1);
    }
    .btn-reauth {
      padding: 6px 12px;
      background: none;
      border: 1px solid #3f3f46;
      color: #a1a1aa;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.15s;
    }
    .btn-reauth:hover {
      border-color: #3b82f6;
      color: #60a5fa;
      background: rgba(59, 130, 246, 0.1);
    }
    .loading {
      padding: 40px 20px;
      text-align: center;
      color: #52525b;
    }
    .spinner {
      display: inline-block;
      width: 20px;
      height: 20px;
      border: 2px solid #27272a;
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      color: white;
      opacity: 0;
      transform: translateY(10px);
      transition: all 0.3s;
      z-index: 100;
    }
    .toast.show { opacity: 1; transform: translateY(0); }
    .toast.success { background: #16a34a; }
    .toast.error { background: #dc2626; }
  </style>
</head>
<body>
  <div id="app"></div>
  <div id="toast" class="toast"></div>

  <script>
    const app = document.getElementById('app');
    const currentUser = ${user ? JSON.stringify(user) : "null"};
    let allProfiles = [];

    function showToast(message, type = 'success') {
      const t = document.getElementById('toast');
      t.textContent = message;
      t.className = 'toast ' + type + ' show';
      setTimeout(() => t.className = 'toast', 3000);
    }

    async function api(path, opts = {}) {
      const res = await fetch(path, {
        headers: { 'Content-Type': 'application/json' },
        ...opts,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      return res.json().catch(() => ({}));
    }

    // Step 1: Enter username
    function renderUsernameStep() {
      app.innerHTML = \`
        <div class="login-card">
          <h2>IDP Middleware Dashboard</h2>
          <p>Enter your username to get started.</p>
          <form id="usernameForm">
            <div class="form-group">
              <label for="username">Username</label>
              <input type="text" id="username" name="username" placeholder="e.g. john" required autofocus />
            </div>
            <button type="submit" class="btn-primary">Continue</button>
          </form>
        </div>\`;

      document.getElementById('usernameForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value.trim();
        if (!username) return;
        try {
          const profiles = await api('/api/profiles?username=' + encodeURIComponent(username));
          allProfiles = profiles;
          renderProfilePicker(username, profiles);
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    }

    // Step 2: Pick or create a profile
    function renderProfilePicker(username, profiles) {
      let showNewForm = false;

      function render() {
        app.innerHTML = \`
          <div class="login-card" style="max-width: 520px;">
            <span class="back-link" id="backBtn">&larr; Change user</span>
            <h2>\${esc(username)}</h2>
            <p>\${profiles.length > 0 ? 'Select a profile or create a new one.' : 'No profiles yet. Create your first one.'}</p>
            \${profiles.length > 0 ? \`
              <div class="profile-grid">
                \${profiles.map(p => \`<div class="profile-card" data-profile="\${esc(p)}">\${esc(p)}</div>\`).join('')}
                <div class="profile-card new-profile" id="newProfileBtn">+ New profile</div>
              </div>\` : ''}
            <div id="newProfileArea" style="display: \${showNewForm || profiles.length === 0 ? 'block' : 'none'}">
              <div class="new-profile-form">
                <input type="text" id="newProfileName" placeholder="Profile name, e.g. default" autofocus />
                <button id="createProfileBtn">Create</button>
              </div>
            </div>
          </div>\`;

        // Back button
        document.getElementById('backBtn').addEventListener('click', () => renderUsernameStep());

        // Profile card clicks
        document.querySelectorAll('.profile-card:not(.new-profile)').forEach(card => {
          card.addEventListener('click', () => loginAs(username, card.dataset.profile));
        });

        // New profile toggle
        const newBtn = document.getElementById('newProfileBtn');
        if (newBtn) {
          newBtn.addEventListener('click', () => {
            showNewForm = true;
            render();
            document.getElementById('newProfileName').focus();
          });
        }

        // Create profile
        const createBtn = document.getElementById('createProfileBtn');
        const nameInput = document.getElementById('newProfileName');
        if (createBtn && nameInput) {
          const doCreate = () => {
            const name = nameInput.value.trim();
            if (!name) return;
            loginAs(username, name);
          };
          createBtn.addEventListener('click', doCreate);
          nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doCreate(); });
        }
      }

      render();
    }

    async function loginAs(username, profile) {
      try {
        await api('/api/login', {
          method: 'POST',
          body: JSON.stringify({ username, profile }),
        });
        location.reload();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }

    async function renderDashboard() {
      // Fetch profiles for the add-to selector
      try {
        allProfiles = await api('/api/profiles?username=' + encodeURIComponent(currentUser.username));
      } catch (e) {
        allProfiles = [currentUser.profile];
      }
      if (!allProfiles.includes(currentUser.profile)) {
        allProfiles.push(currentUser.profile);
      }

      const profileOptions = allProfiles.map(p =>
        \`<option value="\${esc(p)}" \${p === currentUser.profile ? 'selected' : ''}>\${esc(p)}</option>\`
      ).join('');

      app.innerHTML = \`
        <header>
          <h1>IDP Middleware Dashboard</h1>
          <div class="user-badge">
            <strong>\${esc(currentUser.username)}</strong>
            <button id="logoutBtn">Logout</button>
          </div>
        </header>
        <div class="container">
          <div class="section">
            <div class="section-header">
              <h2>Add to profile</h2>
              <select id="addProfileSelect" style="background:#18181b;color:#fafafa;border:1px solid #3f3f46;padding:4px 8px;border-radius:6px;font-size:13px;">
                \${profileOptions}
                <option value="__new__">+ New profile</option>
              </select>
            </div>
            <div style="display:flex;gap:8px;padding:12px 20px;">
              <input type="url" id="mcpUrl" placeholder="MCP server URL" style="flex:1;padding:8px 12px;background:#09090b;border:1px solid #27272a;border-radius:6px;color:#fafafa;font-size:13px;outline:none;" />
              <button class="btn-add" id="addMcpBtn">Add Server</button>
            </div>
            <div style="display:flex;gap:8px;padding:0 20px 12px;">
              <input type="url" id="ctxUrl" placeholder="Context URL" style="flex:1;padding:8px 12px;background:#09090b;border:1px solid #27272a;border-radius:6px;color:#fafafa;font-size:13px;outline:none;" />
              <button class="btn-add" id="addCtxBtn">Add Context</button>
            </div>
          </div>

          <div class="section" id="mcpSection">
            <div class="section-header">
              <h2>MCP Servers</h2>
              <span class="count" id="mcpCount">...</span>
            </div>
            <div id="mcpList"><div class="loading"><div class="spinner"></div></div></div>
          </div>

          <div class="section" id="ctxSection">
            <div class="section-header">
              <h2>Context Entries</h2>
              <span class="count" id="ctxCount">...</span>
            </div>
            <div id="ctxList"><div class="loading"><div class="spinner"></div></div></div>
          </div>
        </div>\`;

      document.getElementById('logoutBtn').addEventListener('click', async () => {
        await fetch('/api/logout', { method: 'POST' });
        location.reload();
      });

      document.getElementById('addProfileSelect').addEventListener('change', async (e) => {
        if (e.target.value === '__new__') {
          const name = prompt('New profile name:');
          if (!name || !name.trim()) {
            e.target.value = currentUser.profile;
            return;
          }
          // Switch active profile so new items go there
          await loginAs(currentUser.username, name.trim());
          return;
        }
        // Switch active profile
        await loginAs(currentUser.username, e.target.value);
      });

      document.getElementById('addMcpBtn').addEventListener('click', () => addItem('mcp'));
      document.getElementById('addCtxBtn').addEventListener('click', () => addItem('context'));
      document.getElementById('mcpUrl').addEventListener('keydown', (e) => { if (e.key === 'Enter') addItem('mcp'); });
      document.getElementById('ctxUrl').addEventListener('keydown', (e) => { if (e.key === 'Enter') addItem('context'); });

      await Promise.all([loadList('mcp'), loadList('context')]);
    }

    function renderGroupedItems(items, type) {
      // Group by profile
      const groups = {};
      items.forEach(item => {
        const p = item.profile || 'default';
        if (!groups[p]) groups[p] = [];
        groups[p].push(item);
      });

      const profileNames = Object.keys(groups).sort();
      if (profileNames.length === 0) {
        return '<div class="list-empty">No items yet.</div>';
      }

      return profileNames.map(profile => \`
        <div style="border-bottom:1px solid #27272a;">
          <div style="padding:10px 20px;background:#141416;font-size:13px;font-weight:500;color:#a1a1aa;">\${esc(profile)}</div>
          \${groups[profile].map(item => \`
            <div class="list-item">
              <div class="item-info">
                <div class="item-name">\${esc(item.name)}</div>
                <div class="item-url">\${esc(item.url)}</div>
              </div>
              <div class="item-meta">
                \${item.public ? '<span class="badge badge-public">Public</span>' : '<span class="badge badge-auth">Auth</span>'}
                <a class="btn-reauth" href="\${esc(item.reauthorizeUrl)}" target="_blank">Reauth</a>
                <button class="btn-remove" data-type="\${type}" data-url="\${esc(item.url)}" data-profile="\${esc(item.profile || 'default')}">Remove</button>
              </div>
            </div>\`).join('')}
        </div>\`).join('');
    }

    async function loadList(type) {
      const isMcp = type === 'mcp';
      const listEl = document.getElementById(isMcp ? 'mcpList' : 'ctxList');
      const countEl = document.getElementById(isMcp ? 'mcpCount' : 'ctxCount');
      const endpoint = isMcp ? '/api/mcp-servers' : '/api/context-entries';

      try {
        const items = await api(endpoint);
        countEl.textContent = items.length;

        if (items.length === 0) {
          listEl.innerHTML = '<div class="list-empty">No items yet.</div>';
          return;
        }

        listEl.innerHTML = renderGroupedItems(items, type);

        listEl.querySelectorAll('.btn-remove').forEach(btn => {
          btn.addEventListener('click', () => removeItem(btn.dataset.type, btn.dataset.url, btn.dataset.profile));
        });
      } catch (err) {
        listEl.innerHTML = '<div class="list-empty">Failed to load.</div>';
        showToast(err.message, 'error');
      }
    }

    async function addItem(type) {
      const isMcp = type === 'mcp';
      const input = document.getElementById(isMcp ? 'mcpUrl' : 'ctxUrl');
      const url = input.value.trim();
      if (!url) return;

      // Open the OAuth login flow in a new tab
      const loginPath = isMcp ? '/oauth/login/mcp' : '/oauth/login/context';
      const loginUrl = loginPath + '?url=' + encodeURIComponent(url);
      window.open(loginUrl, '_blank');
      input.value = '';

      showToast('Auth flow opened in new tab. Refresh to see changes.');

      // Poll for changes
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        if (attempts > 30) { clearInterval(poll); return; }
        await loadList(type);
      }, 3000);
      setTimeout(() => clearInterval(poll), 90000);
    }

    async function removeItem(type, url, profile) {
      if (!confirm('Remove this item?')) return;
      const isMcp = type === 'mcp';
      const endpoint = isMcp ? '/api/mcp-servers' : '/api/context-entries';
      try {
        await api(endpoint, {
          method: 'DELETE',
          body: JSON.stringify({ url, profile }),
        });
        showToast('Removed successfully');
        await loadList(type);
      } catch (err) {
        showToast(err.message, 'error');
      }
    }

    function esc(s) {
      const d = document.createElement('div');
      d.textContent = s;
      return d.innerHTML;
    }

    // Boot
    if (currentUser) {
      renderDashboard();
    } else {
      renderUsernameStep();
    }
  </script>
</body>
</html>`;
}

export default {
  async fetch(
    request: Request,
    env: Env
  ): Promise<Response> {
    const url = new URL(request.url);
    const isLocalhost = url.hostname === "localhost";
    const user = getUserFromCookie(request);

    // --- API routes ---

    if (url.pathname === "/api/login" && request.method === "POST") {
      const body = (await request.json()) as {
        username: string;
        profile: string;
      };
      if (!body.username || !body.profile) {
        return Response.json({ error: "Missing fields" }, { status: 400 });
      }
      // Register this profile in the user's DO
      const loginIdp = getIdpForUser(body.username, body.profile, env, `${url.protocol}//${url.host}`);
      await loginIdp.registerProfile(body.profile);
      return Response.json(
        { ok: true },
        {
          headers: {
            "Set-Cookie": setUserCookie(
              body.username,
              body.profile,
              isLocalhost
            )
          }
        }
      );
    }

    // Profiles API (no auth required, just needs a username)
    if (url.pathname === "/api/profiles" && request.method === "GET") {
      const username = url.searchParams.get("username");
      if (!username) {
        return Response.json({ error: "Missing username" }, { status: 400 });
      }
      const profileIdp = getIdpForUser(username, "default", env, `${url.protocol}//${url.host}`);
      const profiles = await profileIdp.getProfiles();
      return Response.json(profiles);
    }

    if (url.pathname === "/api/logout" && request.method === "POST") {
      return Response.json(
        { ok: true },
        {
          headers: { "Set-Cookie": clearUserCookie(isLocalhost) }
        }
      );
    }

    // All remaining API/oauth routes need a user
    if (user) {
      const baseUrl = `${url.protocol}//${url.host}`;
      const idp = getIdpForUser(user.username, user.profile, env, baseUrl);

      // OAuth middleware (login + callback)
      const oauthResponse = await idp.middleware(request);
      if (oauthResponse) return oauthResponse;

      // API: list MCP servers (all profiles)
      if (url.pathname === "/api/mcp-servers" && request.method === "GET") {
        const servers = await idp.getMcpServers();
        return Response.json(servers);
      }

      // API: list context entries (all profiles)
      if (url.pathname === "/api/context-entries" && request.method === "GET") {
        const entries = await idp.getContextEntries();
        return Response.json(entries);
      }

      // API: remove MCP server
      if (url.pathname === "/api/mcp-servers" && request.method === "DELETE") {
        const body = (await request.json()) as {
          url: string;
          profile: string;
        };
        if (!body.url || !body.profile) {
          return Response.json(
            { error: "Missing url or profile" },
            { status: 400 }
          );
        }
        await idp.removeMcpServer(body.url, body.profile);
        return Response.json({ ok: true });
      }

      // API: remove context entry
      if (
        url.pathname === "/api/context-entries" &&
        request.method === "DELETE"
      ) {
        const body = (await request.json()) as {
          url: string;
          profile: string;
        };
        if (!body.url || !body.profile) {
          return Response.json(
            { error: "Missing url or profile" },
            { status: 400 }
          );
        }
        await idp.removeContext(body.url, body.profile);
        return Response.json({ ok: true });
      }
    } else if (
      url.pathname.startsWith("/api/") ||
      url.pathname.startsWith("/oauth/")
    ) {
      return Response.json({ error: "Not logged in" }, { status: 401 });
    }

    // --- Dashboard ---
    return new Response(getDashboardHTML(user), {
      headers: { "Content-Type": "text/html" }
    });
  }
};
