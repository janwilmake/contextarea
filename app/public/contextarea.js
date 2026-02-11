/**
 * ContextArea — Monaco editor with URL context, smart paste, drag & drop, and @suggestions.
 *
 * Usage:
 *   const ca = ContextArea.create(element, {
 *     pasteApiUrl: '/paste',
 *     contextApiUrl: '/context',
 *     suggestions: [{ name, url, icon, description, insertText? }],  // @-triggered autocomplete
 *     onSubmit: (value, instance) => { ... },            // Shift+Enter callback
 *   });
 *   ca.editor   // underlying Monaco editor instance
 *   ca.dispose() // clean up
 */
(function (global) {
  "use strict";

  // ── helpers ──────────────────────────────────────────────────────────

  function createEventEmitter() {
    let listeners = [];
    return {
      event(listener) {
        listeners.push(listener);
        return {
          dispose() {
            listeners = listeners.filter((l) => l !== listener);
          }
        };
      },
      fire(data) {
        listeners.forEach((l) => l(data));
      }
    };
  }

  const URL_REGEX = /(https?:\/\/[^\s]+)/g;
  const MD_LINK_REGEX = /\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g;

  // Inject CSS once
  let cssInjected = false;
  function injectCss() {
    if (cssInjected) return;
    cssInjected = true;
    const style = document.createElement("style");
    style.textContent = `
            .monaco-editor .url-decoration { text-decoration: underline; color: #4da6ff !important; cursor: pointer; }
            .monaco-editor .url-decoration:hover { background: rgba(77,166,255,0.1) !important; }
            .monaco-editor .url-decoration-error { text-decoration: underline wavy #ff4d4d; cursor: pointer; }
            .monaco-editor .url-decoration-error:hover { background: rgba(255,77,77,0.1) !important; }
            .monaco-editor .ca-mention { color: #7cb7ff !important; font-weight: 600; background: rgba(124,183,255,0.1); border-radius: 3px; padding: 0 2px; }
            .monaco-editor .ca-mention-error { text-decoration: underline wavy #ff4d4d; cursor: pointer; color: #ff6b6b !important; }
            .monaco-editor .ca-mention-error:hover { background: rgba(255,77,77,0.1) !important; }
            .ca-drop-overlay { position:absolute;inset:0;background:rgba(0,42,226,.95);border:4px dashed #fff;border-radius:10px;display:none;align-items:center;justify-content:center;z-index:10000;pointer-events:none; }
            .ca-drop-overlay.active { display:flex; }
            .ca-drop-content { text-align:center;color:#fff; }
            .ca-drop-content .icon { font-size:64px;margin-bottom:20px; }
            .ca-drop-content h2 { margin:0 0 10px; font-size:2em; }
        `;
    document.head.appendChild(style);
  }

  // ── ContextArea class ───────────────────────────────────────────────

  class ContextAreaInstance {
    constructor(element, options) {
      injectCss();

      this.config = {
        pasteApiUrl: options.pasteApiUrl ?? "/paste",
        contextApiUrl: options.contextApiUrl ?? "/context",
        pasteThreshold: options.pasteThreshold ?? 1000,
        contextDebounce: options.contextDebounce ?? 500
      };

      this.suggestions = options.suggestions || [];

      this.element = element;
      this.element.style.position = "relative"; // for drop overlay

      this.contextCache = new Map();
      this.pendingContextFetches = new Map();
      this.currentUrlsInText = new Map();
      this.urlDecorations = [];
      this.mentionDecorations = [];
      this.unknownMcpDecorations = [];
      this.unknownMcpUrls = new Map();
      this._mcpFetchTimeout = null;
      this.disposables = [];
      this.dragCounter = 0;
      this.contextFetchTimeout = null;
      this.scrollTopBeforePaste = 0;

      this.codeLensChange = createEventEmitter();
      this.inlayHintsChange = createEventEmitter();

      this.onStatus = options.onStatus || (() => {});
      this.onSubmit = options.onSubmit || null;
      this.onChange = options.onChange || null;

      this._initEditor(options);
    }

    // ── init ────────────────────────────────────────────────────────

    _initEditor(options) {
      const editorOpts = Object.assign(
        {
          value: options.value ?? "",
          language: options.language ?? "markdown",
          theme:
            options.theme ??
            (matchMedia("(prefers-color-scheme:dark)").matches
              ? "vs-dark"
              : "vs"),
          fontSize: 14,
          lineNumbers: "on",
          wordWrap: "on",
          minimap: { enabled: false },
          automaticLayout: true,
          inlayHints: { enabled: "on", fontSize: 12 },
          codeLens: false,
          links: false,
          fixedOverflowWidgets: true,
          quickSuggestions: false,
          suggestOnTriggerCharacters: options.suggestions?.length > 0
        },
        options.editorOptions
      );

      this.editor = monaco.editor.create(this.element, editorOpts);

      // Register the expand-url command (global, idempotent)
      if (!ContextAreaInstance._commandRegistered) {
        ContextAreaInstance._commandRegistered = true;
        monaco.editor.addCommand({
          id: "expandUrl",
          run: (_accessor, url, range) => {
            if (ContextAreaInstance._active) {
              ContextAreaInstance._active._handleExpandUrl(url, range);
            }
          }
        });
        monaco.editor.addCommand({
          id: "openMcpAuth",
          run: (_accessor, url) => {
            window.open("/dashboard?mcp=" + encodeURIComponent(url), "_blank");
          }
        });
        monaco.editor.addCommand({
          id: "openUrl",
          run: (_accessor, url) => {
            window.open(url, "_blank");
          }
        });
      }
      ContextAreaInstance._active = this;

      this.editor.onDidFocusEditorText(() => {
        ContextAreaInstance._active = this;
      });

      this._setupKeybindings();
      this._registerProviders();
      this._setupPasteHandler();
      this._setupDragAndDrop();

      if (this.suggestions.length) {
        this._setupSuggestions();
      }

      this.editor.onDidChangeModelContent(() => {
        this._updateUrlDecorations();
        if (this.suggestions.length) this._updateMentionDecorations();
        this._updateUnknownMcpDecorations();
        if (this.onChange) this.onChange(this.editor.getValue());
      });
      this._updateUrlDecorations();
      if (this.suggestions.length) this._updateMentionDecorations();
      this._updateUnknownMcpDecorations();
      this.editor.focus();
    }

    // ── keybindings ──────────────────────────────────────────────────

    _setupKeybindings() {
      const self = this;

      // Shift+Enter → onSubmit
      this.editor.addAction({
        id: "contextarea.submit",
        label: "Submit",
        keybindings: [monaco.KeyMod.Shift | monaco.KeyCode.Enter],
        run() {
          if (self.onSubmit) {
            const value = self.editor.getValue();
            self.onSubmit(value, self);
          }
        }
      });
    }

    // ── URL detection & decorations ─────────────────────────────────

    _updateUrlDecorations() {
      const model = this.editor.getModel();
      const text = model.getValue();
      const lines = text.split("\n");
      const decorations = [];
      const urlsInText = new Map();

      lines.forEach((line, i) => {
        const mdLinkRanges = [];
        let m;

        // 1. Markdown links: [text](url)
        const mdRe = new RegExp(MD_LINK_REGEX.source, "g");
        while ((m = mdRe.exec(line)) !== null) {
          const url = m[2];
          const fullStart = m.index;
          const fullEnd = m.index + m[0].length;
          mdLinkRanges.push({ start: fullStart, end: fullEnd });
          const range = new monaco.Range(
            i + 1,
            fullStart + 1,
            i + 1,
            fullEnd + 1
          );
          if (!urlsInText.has(url)) urlsInText.set(url, []);
          urlsInText.get(url).push({ range, lineIndex: i + 1 });
          const cached = this.contextCache.get(url);
          const isError = cached && cached.error;
          decorations.push({
            range,
            options: {
              inlineClassName: isError
                ? "url-decoration-error"
                : "url-decoration"
            }
          });
        }

        // 2. Bare URLs (skip those inside markdown links or prepended with @)
        const re = new RegExp(URL_REGEX.source, "g");
        while ((m = re.exec(line)) !== null) {
          const matchStart = m.index;
          const matchEnd = m.index + m[0].length;
          if (
            mdLinkRanges.some((r) => matchStart >= r.start && matchEnd <= r.end)
          )
            continue;
          if (matchStart > 0 && line[matchStart - 1] === "@") continue;
          const url = m[0].replace(/[)\].,;:!?'"]+$/, "");
          const range = new monaco.Range(
            i + 1,
            m.index + 1,
            i + 1,
            m.index + 1 + url.length
          );
          if (!urlsInText.has(url)) urlsInText.set(url, []);
          urlsInText.get(url).push({ range, lineIndex: i + 1 });
          const cached = this.contextCache.get(url);
          const isError = cached && cached.error;
          decorations.push({
            range,
            options: {
              inlineClassName: isError
                ? "url-decoration-error"
                : "url-decoration"
            }
          });
        }
      });

      this.urlDecorations = this.editor.deltaDecorations(
        this.urlDecorations,
        decorations
      );
      this.currentUrlsInText = urlsInText;

      this.codeLensChange.fire();
      this.inlayHintsChange.fire();
      this._debouncedFetchContexts(urlsInText);
    }

    // ── context fetching ────────────────────────────────────────────

    _fetchContext(url) {
      if (this.contextCache.has(url))
        return Promise.resolve(this.contextCache.get(url));
      if (this.pendingContextFetches.has(url))
        return this.pendingContextFetches.get(url);

      const p = (async () => {
        try {
          const r = await fetch(
            `${this.config.contextApiUrl}?url=${encodeURIComponent(url)}`
          );
          if (!r.ok) throw new Error(r.status);
          const data = await r.json();

          // Handle 401/404 with action redirect
          if (data.status === 401 || data.status === 404) {
            this.contextCache.set(url, data);
            if (this.onStatus) {
              this.onStatus(`${data.error}: ${url}`, false, data.action);
            }
            return data;
          }

          this.contextCache.set(url, data);
          return data;
        } finally {
          this.pendingContextFetches.delete(url);
        }
      })();

      this.pendingContextFetches.set(url, p);
      return p;
    }

    _debouncedFetchContexts(urlsInText) {
      clearTimeout(this.contextFetchTimeout);
      this.contextFetchTimeout = setTimeout(async () => {
        const promises = [];
        for (const url of urlsInText.keys()) {
          if (
            !this.contextCache.has(url) &&
            !this.pendingContextFetches.has(url)
          ) {
            promises.push(this._fetchContext(url).catch(() => null));
          }
        }
        if (promises.length) {
          await Promise.all(promises);
          this._updateUrlDecorations();
        }
      }, this.config.contextDebounce);
    }

    // ── Monaco providers (registered once) ─────────────────────────

    _registerProviders() {
      const self = this;

      // Hover
      this.disposables.push(
        monaco.languages.registerHoverProvider("markdown", {
          provideHover(model, position) {
            for (const [url, positions] of self.currentUrlsInText.entries()) {
              for (const { range } of positions) {
                if (!range.containsPosition(position)) continue;
                const data = self.contextCache.get(url);
                if (!data && self.pendingContextFetches.has(url)) {
                  return {
                    range,
                    contents: [
                      { value: "\u23f3 Loading context...", isTrusted: true }
                    ]
                  };
                }
                if (!data) return null;
                if (data.error && data.action) {
                  const authArgs = encodeURIComponent(
                    JSON.stringify([data.action])
                  );
                  return {
                    range,
                    contents: [
                      {
                        value: `**${data.error}**\n\n[Authorize in Dashboard](command:openUrl?${authArgs})`,
                        isTrusted: true
                      }
                    ]
                  };
                }
                if (data.error) {
                  return {
                    range,
                    contents: [
                      { value: `**Error:** ${data.error}`, isTrusted: true }
                    ]
                  };
                }
                let msg = `**${data.title || "Untitled"}**\n\n`;
                if (data.type) msg += `Type: ${data.type}\n`;
                if (data.tokens) msg += `Tokens: ${data.tokens}\n`;
                if (data.description) msg += `\n${data.description}\n`;
                const args = encodeURIComponent(JSON.stringify([url, range]));
                msg += `\n[\ud83d\udd0d Expand](command:expandUrl?${args})`;
                return {
                  range,
                  contents: [{ value: msg, isTrusted: true, supportHtml: true }]
                };
              }
            }
            return null;
          }
        })
      );

      // Inlay hints
      this.disposables.push(
        monaco.languages.registerInlayHintsProvider("markdown", {
          onDidChangeInlayHints: self.inlayHintsChange.event,
          provideInlayHints(model, range) {
            const hints = [];
            for (const [url, positions] of self.currentUrlsInText.entries()) {
              const data = self.contextCache.get(url);
              const loading = self.pendingContextFetches.has(url);
              for (const { range: ur, lineIndex } of positions) {
                if (
                  lineIndex < range.startLineNumber ||
                  lineIndex > range.endLineNumber
                )
                  continue;
                let label = "";
                if (loading) label = "\u23f3 loading";
                else if (data && data.error && data.action)
                  label = `\ud83d\udd12 ${data.error}`;
                else if (data && data.error) label = `\u26a0 ${data.error}`;
                else if (data) {
                  if (data.tokens) label += `${data.tokens} tokens`;
                  if (data.type)
                    label += label ? ` \u2022 ${data.type}` : data.type;
                }
                if (label) {
                  hints.push({
                    kind: monaco.languages.InlayHintKind.Type,
                    position: { column: ur.endColumn, lineNumber: lineIndex },
                    label: `: ${label}`,
                    tooltip: data?.title
                      ? { value: data.title, supportHtml: false }
                      : undefined
                  });
                }
              }
            }
            return { hints, dispose() {} };
          }
        })
      );

      // Hover for unknown @https:// MCP mentions
      this.disposables.push(
        monaco.languages.registerHoverProvider("markdown", {
          provideHover(model, position) {
            for (const [url, positions] of self.unknownMcpUrls.entries()) {
              for (const { range } of positions) {
                if (!range.containsPosition(position)) continue;
                if (self.pendingContextFetches.has(url)) {
                  return {
                    range,
                    contents: [
                      { value: "Checking MCP server...", isTrusted: true }
                    ]
                  };
                }
                const data = self.contextCache.get(url);
                if (data && data.error && data.status !== 401) {
                  return {
                    range,
                    contents: [
                      { value: "**MCP could not be found**", isTrusted: true }
                    ]
                  };
                }
                const args = encodeURIComponent(JSON.stringify([url]));
                return {
                  range,
                  contents: [
                    {
                      value: `**MCP server not authenticated**\n\n[Authenticate](command:openMcpAuth?${args})`,
                      isTrusted: true
                    }
                  ]
                };
              }
            }
            return null;
          }
        })
      );

      // Code actions (quick-fix)
      this.disposables.push(
        monaco.languages.registerCodeActionProvider("markdown", {
          provideCodeActions(model, range) {
            const actions = [];
            for (const [url, positions] of self.currentUrlsInText.entries()) {
              for (const { range: ur } of positions) {
                if (!ur.intersectRanges(range)) continue;
                const data = self.contextCache.get(url);
                actions.push({
                  title: `\ud83d\udd0d Expand ${data?.title || "URL"}`,
                  kind: "quickfix",
                  isPreferred: true,
                  command: {
                    id: "expandUrl",
                    title: "Expand URL",
                    arguments: [url, ur]
                  }
                });
              }
            }
            return { actions, dispose() {} };
          }
        })
      );
    }

    // ── expand URL ──────────────────────────────────────────────────

    async _handleExpandUrl(url, range) {
      this.onStatus("Fetching URL content...", true);
      try {
        const data = await this._fetchContext(url);
        if (!data || !data.content) throw new Error("No content");
        this.editor.executeEdits("expand-url", [
          { range, text: data.content, forceMoveMarkers: true }
        ]);
        this.onStatus(`Expanded: ${url}`);
      } catch (err) {
        this.onStatus(`Failed to expand: ${err.message}`);
      }
    }

    // ── paste handling ──────────────────────────────────────────────

    _setupPasteHandler() {
      let shiftPressed = false;
      const self = this;

      document.addEventListener("keydown", (e) => {
        if (e.key === "Shift") shiftPressed = true;
      });
      document.addEventListener("keyup", (e) => {
        if (e.key === "Shift") shiftPressed = false;
      });

      // Capture scroll position before Monaco processes the paste
      this.editor.getDomNode().addEventListener(
        "paste",
        () => {
          self.scrollTopBeforePaste = self.editor.getScrollTop();
        },
        true
      );

      this.editor.onDidPaste(async (e) => {
        if (shiftPressed) return;

        const range = e.range;
        const pastedText = self.editor.getModel().getValueInRange(range);

        if (
          pastedText.length <= self.config.pasteThreshold ||
          /^https?:\/\//.test(pastedText.trim())
        ) {
          return;
        }

        // Remove pasted text, restore scroll
        self.editor.executeEdits("paste-intercept", [
          { range, text: "", forceMoveMarkers: true }
        ]);
        self.editor.setScrollTop(self.scrollTopBeforePaste);

        self.onStatus("Uploading to pastebin...", true);

        try {
          const r = await fetch(self.config.pasteApiUrl, {
            method: "POST",
            body: pastedText,
            headers: { "Content-Type": "text/plain" }
          });
          if (!r.ok) {
            const msg = await r.text().catch(() => "");
            if (r.status === 401)
              throw new Error(msg || "Login required to paste");
            throw new Error(msg || r.status);
          }
          const url = await r.text();
          self._insertTextAtCursor(url);
          self.editor.setScrollTop(self.scrollTopBeforePaste);
          self.onStatus(`Uploaded: ${url}`);
        } catch (err) {
          self.onStatus(`Upload failed: ${err.message}`);
          self._insertTextAtCursor(pastedText);
        }
      });
    }

    // ── drag & drop ─────────────────────────────────────────────────

    _setupDragAndDrop() {
      const self = this;
      const overlay = document.createElement("div");
      overlay.className = "ca-drop-overlay";
      overlay.innerHTML =
        '<div class="ca-drop-content"><div class="icon">\ud83d\udcc1</div><h2>Drop Files Here</h2><p>Files will be uploaded and inserted as links</p></div>';
      this.element.appendChild(overlay);

      ["dragenter", "dragover", "dragleave", "drop"].forEach((ev) => {
        document.body.addEventListener(
          ev,
          (e) => {
            e.preventDefault();
            e.stopPropagation();
          },
          false
        );
      });

      this.element.addEventListener("dragenter", () => {
        self.dragCounter++;
        overlay.classList.add("active");
      });

      this.element.addEventListener("dragleave", () => {
        self.dragCounter--;
        if (self.dragCounter === 0) overlay.classList.remove("active");
      });

      this.element.addEventListener("drop", async (e) => {
        self.dragCounter = 0;
        overlay.classList.remove("active");
        const files = Array.from(e.dataTransfer.files);
        if (!files.length) return;

        self.onStatus(`Uploading ${files.length} file(s)...`, true);
        try {
          const urls = [];
          for (const file of files) {
            const body = file.type.startsWith("text/")
              ? await file.text()
              : await file
                  .arrayBuffer()
                  .then((b) => new Blob([b], { type: file.type }));
            const r = await fetch(self.config.pasteApiUrl, {
              method: "POST",
              body,
              headers: {
                "Content-Type":
                  typeof body === "string" ? "text/plain" : body.type
              }
            });
            if (!r.ok) {
              const msg = await r.text().catch(() => "");
              if (r.status === 401)
                throw new Error(msg || "Login required to upload");
              throw new Error(msg || r.status);
            }
            urls.push(await r.text());
          }
          self._insertTextAtCursor(urls.join("\n") + "\n");
          self.onStatus(`Uploaded ${files.length} file(s)`);
        } catch (err) {
          self.onStatus(`Upload failed: ${err.message}`);
        }
      });
    }

    // ── @suggestions ────────────────────────────────────────────────

    _setupSuggestions() {
      const self = this;
      const items = this.suggestions;

      // @ completion provider
      this.disposables.push(
        monaco.languages.registerCompletionItemProvider("markdown", {
          triggerCharacters: ["@"],
          provideCompletionItems(model, position) {
            const line = model.getLineContent(position.lineNumber);
            const before = line.substring(0, position.column - 1);
            const atIdx = before.lastIndexOf("@");
            if (atIdx === -1) return { suggestions: [] };

            const range = new monaco.Range(
              position.lineNumber,
              atIdx + 1,
              position.lineNumber,
              position.column
            );

            return {
              suggestions: items.map((s, i) => ({
                label: {
                  label: s.name
                  // description: s.description
                },
                kind: monaco.languages.CompletionItemKind.Module,
                insertText: s.insertText ?? `@${s.name}`,
                range,
                sortText: String(i).padStart(3, "0"),
                detail: null,
                documentation: {
                  value: `<img src="${s.icon}" width="16" height="16">&nbsp; **${s.name}**\n\n${s.description}\n\n[${s.url}](${s.url})`,
                  supportHtml: true,
                  isTrusted: true
                },
                filterText: `@${s.name}`
              }))
            };
          }
        })
      );

      // Hover on @mentions
      this.disposables.push(
        monaco.languages.registerHoverProvider("markdown", {
          provideHover(model, position) {
            const line = model.getLineContent(position.lineNumber);
            const word = model.getWordAtPosition(position);
            if (!word) return null;
            if (line[word.startColumn - 2] !== "@") return null;

            const server = items.find((s) => s.name === word.word);
            if (!server) return null;

            const range = new monaco.Range(
              position.lineNumber,
              word.startColumn - 1,
              position.lineNumber,
              word.endColumn
            );
            return {
              range,
              contents: [
                {
                  value: `<img src="${server.icon}" width="16" height="16">&nbsp; **${server.name}**\n\n${server.description}\n\n[${server.url}](${server.url})`,
                  supportHtml: true,
                  isTrusted: true
                }
              ]
            };
          }
        })
      );

      // Patch suggest-widget icons via MutationObserver
      const patchIcons = () => {
        const widget = document.querySelector(".suggest-widget");
        if (!widget) return;
        widget.querySelectorAll(".monaco-list-row").forEach((row) => {
          const text = row.textContent || "";
          const server = items.find((s) => text.includes(s.name));
          const codicon = row.querySelector('[class*="codicon-symbol"]');
          if (!codicon) return;
          if (server) {
            if (codicon.dataset.caSuggestion === server.name) return;
            codicon.dataset.caSuggestion = server.name;
            codicon.style.setProperty("font-size", "0", "important");
            codicon.style.width = "16px";
            codicon.style.height = "16px";
            codicon.style.display = "inline-block";
            codicon.style.backgroundImage = `url('${server.icon}')`;
            codicon.style.backgroundSize = "contain";
            codicon.style.backgroundRepeat = "no-repeat";
            codicon.style.backgroundPosition = "center";
          } else if (codicon.dataset.caSuggestion) {
            delete codicon.dataset.caSuggestion;
            codicon.removeAttribute("style");
          }
        });
      };

      const suggestObs = new MutationObserver(() =>
        requestAnimationFrame(patchIcons)
      );
      suggestObs.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true
      });
      this.disposables.push({ dispose: () => suggestObs.disconnect() });

      // Auto-expand suggestion details on first open
      let detailsOpened = false;
      const detailsObs = new MutationObserver(() => {
        if (detailsOpened) return;
        const widget = document.querySelector(".suggest-widget");
        if (widget && !widget.classList.contains("hidden")) {
          detailsOpened = true;
          setTimeout(
            () => this.editor.trigger("api", "toggleSuggestionDetails"),
            50
          );
        }
      });
      detailsObs.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true
      });
      this.disposables.push({ dispose: () => detailsObs.disconnect() });
    }

    _updateMentionDecorations() {
      // Build patterns from custom insertText values
      const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const patterns = [];
      const patternToSuggestion = new Map();
      for (const s of this.suggestions) {
        if (s.insertText && s.insertText.startsWith("@")) {
          const afterAt = s.insertText.slice(1);
          patterns.push(escRe(afterAt));
          patternToSuggestion.set(afterAt, s);
        }
      }
      if (!patterns.length) return;

      const re = new RegExp(`@(${patterns.join("|")})(?=\\s|$)`, "g");
      const model = this.editor.getModel();
      const lines = model.getValue().split("\n");
      const decorations = [];

      lines.forEach((line, i) => {
        let m;
        while ((m = re.exec(line)) !== null) {
          const s = patternToSuggestion.get(m[1]);
          decorations.push({
            range: new monaco.Range(
              i + 1,
              m.index + 1,
              i + 1,
              m.index + 1 + m[0].length
            ),
            options: {
              inlineClassName: "ca-mention",
              hoverMessage: { value: `**${s?.name || m[1]}**` }
            }
          });
        }
      });

      this.mentionDecorations = this.editor.deltaDecorations(
        this.mentionDecorations,
        decorations
      );
    }

    // ── unknown @https:// MCP detection ─────────────────────────────

    _updateUnknownMcpDecorations() {
      const model = this.editor.getModel();
      const lines = model.getValue().split("\n");
      const decorations = [];
      const unknownUrls = new Map();

      // Build set of known MCP URLs from suggestions
      const knownUrls = new Set();
      for (const s of this.suggestions) {
        if (s.insertText && s.insertText.startsWith("@")) {
          knownUrls.add(s.insertText.slice(1));
        }
      }

      const re = /@(https:\/\/[^\s]+)/g;
      lines.forEach((line, i) => {
        let m;
        while ((m = re.exec(line)) !== null) {
          const url = m[1];
          if (knownUrls.has(url)) continue;
          const range = new monaco.Range(
            i + 1,
            m.index + 1,
            i + 1,
            m.index + 1 + m[0].length
          );
          if (!unknownUrls.has(url)) unknownUrls.set(url, []);
          unknownUrls.get(url).push({ range, lineIndex: i + 1 });
          decorations.push({
            range,
            options: { inlineClassName: "ca-mention-error" }
          });
        }
      });

      this.unknownMcpDecorations = this.editor.deltaDecorations(
        this.unknownMcpDecorations,
        decorations
      );
      this.unknownMcpUrls = unknownUrls;
      this._debouncedFetchUnknownMcp(unknownUrls);
    }

    _debouncedFetchUnknownMcp(urlsMap) {
      clearTimeout(this._mcpFetchTimeout);
      this._mcpFetchTimeout = setTimeout(async () => {
        const promises = [];
        for (const url of urlsMap.keys()) {
          if (
            !this.contextCache.has(url) &&
            !this.pendingContextFetches.has(url)
          ) {
            promises.push(this._fetchContext(url).catch(() => null));
          }
        }
        if (promises.length) {
          await Promise.all(promises);
          this._updateUnknownMcpDecorations();
        }
      }, this.config.contextDebounce);
    }

    // ── helpers ─────────────────────────────────────────────────────

    _insertTextAtCursor(text) {
      const pos = this.editor.getPosition();
      const range = new monaco.Range(
        pos.lineNumber,
        pos.column,
        pos.lineNumber,
        pos.column
      );
      this.editor.executeEdits("paste", [
        { range, text, forceMoveMarkers: true }
      ]);

      const lines = text.split("\n");
      const last = lines[lines.length - 1];
      this.editor.setPosition(
        new monaco.Position(
          pos.lineNumber + lines.length - 1,
          lines.length === 1 ? pos.column + text.length : last.length + 1
        )
      );
      this.editor.focus();
    }

    /** Update configuration at runtime. */
    setConfig(partial) {
      Object.assign(this.config, partial);
    }

    /** Clean up. */
    getValue() {
      return this.editor.getValue();
    }

    setValue(value) {
      this.editor.setValue(value);
    }

    dispose() {
      clearTimeout(this.contextFetchTimeout);
      this.disposables.forEach((d) => d.dispose());
      this.editor.dispose();
    }
  }

  ContextAreaInstance._commandRegistered = false;
  ContextAreaInstance._active = null;

  // ── public API ──────────────────────────────────────────────────────

  global.ContextArea = {
    /** Create a ContextArea inside `element`. Returns instance with `.editor` and `.dispose()`. */
    create(element, options = {}) {
      return new ContextAreaInstance(element, options);
    }
  };
})(window);
