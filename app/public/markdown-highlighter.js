// Main class to handle markdown highlighting and code block functionality
class MarkdownHighlighter {
  constructor() {
    this.setupComplete = false;
    this.loading = false;
    this.injectStyles();
    this.codeBlockView = localStorage.getItem("codeblockView") || "code"; // Default to 'code' if not set
    this.initializeMarked();
    this.initializeDOMPurify();
    this.setupIframeResizeListener();
  }

  // Initialize marked with custom renderer
  initializeMarked() {
    // Check if marked is available
    if (typeof marked === "undefined") {
      console.warn("Marked library not found. Loading from CDN...");
      this.loadMarked();
      return;
    }

    this.setupMarkedRenderer();
  }

  // Load marked from CDN if not available
  loadMarked() {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/marked@9.1.6/marked.min.js";
    script.onload = () => {
      this.setupMarkedRenderer();
    };
    script.onerror = () => {
      console.error("Failed to load marked library");
    };
    document.head.appendChild(script);
  }

  // Initialize DOMPurify for HTML sanitization
  initializeDOMPurify() {
    if (typeof DOMPurify === "undefined") {
      console.warn("DOMPurify not found. Loading from CDN...");
      this.loadDOMPurify();
    }
  }

  // Load DOMPurify from CDN if not available
  loadDOMPurify() {
    const script = document.createElement("script");
    script.src =
      "https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.min.js";
    script.onerror = () => {
      console.error("Failed to load DOMPurify library");
    };
    document.head.appendChild(script);
  }

  // Listen for postMessage-based height reports from sandboxed iframes
  setupIframeResizeListener() {
    window.addEventListener("message", (event) => {
      if (
        event.data?.type === "iframe-resize" &&
        event.data.id &&
        event.data.height
      ) {
        const iframe = document.getElementById(event.data.id);
        if (iframe) {
          iframe.style.height = `${event.data.height + 20}px`;
        }
      }
    });
  }

  calculateCodeHash(code) {
    let hash = 0;

    // Simple hash function based on string content
    for (let i = 0; i < code.length; i++) {
      const char = code.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    // Convert to positive number and create base-36 string
    const positiveHash = Math.abs(hash);
    let hashString = positiveHash.toString(36);

    // Ensure we have exactly 7 characters
    if (hashString.length < 7) {
      // Pad with the hash of the string length to avoid collisions
      const lengthHash = (code.length * 7919) % 1000000; // 7919 is a prime
      const paddingString = lengthHash.toString(36);
      hashString = (paddingString + hashString).slice(-7);
    } else if (hashString.length > 7) {
      // Take first 7 characters
      hashString = hashString.slice(0, 7);
    }

    return hashString;
  }

  // Setup custom marked renderer
  setupMarkedRenderer() {
    this.renderer = new marked.Renderer();

    // Override code block rendering
    this.renderer.code = (code, lang = "plaintext", escaped) => {
      const blockId = `code-block-${this.calculateCodeHash(code)}`;
      const tokenCount = this.calculateTokens(code);

      const language = lang.split(" ")[0];
      const parameters = lang.slice(language.length + 1);

      // Return placeholder that will be replaced later
      return this.generateCodeBlockHtml({
        code,
        language,
        tokenCount,
        blockId,
        parameters,
      });
    };

    // Override inline code rendering
    this.renderer.codespan = (code) => {
      return `<span class="hljs-inline">\`${code}\`</span>`;
    };

    // Override other elements to add custom classes
    this.renderer.strong = (text) => {
      return `<span class="md-bold">**${text}**</span>`;
    };

    this.renderer.em = (text) => {
      return `<span class="md-italic">*${text}*</span>`;
    };

    this.renderer.heading = (text, level) => {
      const hashes = "#".repeat(level);
      return `<span class="md-heading">${hashes} ${text}</span>\n`;
    };

    this.renderer.list = (body, ordered, start) => {
      const type = ordered ? "ol" : "ul";
      const startatt = ordered && start !== 1 ? ` start="${start}"` : "";
      // Remove the extra newlines that are causing whitespace issues
      return `<${type}${startatt} class="md-list md-list-${
        ordered ? "ordered" : "unordered"
      }">${body.trim()}</${type}>`;
    };

    this.renderer.listitem = (text) => {
      // Remove trailing newlines from list items
      return `<li class="md-list-item">${text.trim()}</li>`;
    };

    this.renderer.link = (href, title, text) => {
      const urlPrefix =
        text === href ? "" : `<span class="md-italic">[${text}](</span>`;
      const urlSuffix = text === href ? "" : `<span class="md-italic">)</span>`;
      const titleAttr = title ? ` title="${title}"` : "";
      const urlPart = `<a href="${this.escapeHTML(
        href
      )}" class="md-link" target="_blank" rel="noopener noreferrer"${titleAttr}>${href}</a>`;

      return `${urlPrefix}${urlPart}${urlSuffix}`;
    };

    this.renderer.image = (href, title, text) => {
      const titlePart = title ? ` "${title}"` : "";
      const altText = text || "";
      return `<span class="md-italic">![${altText}](</span><a href="${this.escapeHTML(
        href
      )}" class="md-link md-image-link" target="_blank" rel="noopener noreferrer">${href}${titlePart}</a><span class="md-italic">)</span>`;
    };

    this.renderer.blockquote = (quote) => {
      // Clean up the quote content by removing any existing HTML tags
      const cleanedQuote = quote
        .replace(/<\/?p>/g, "") // Remove paragraph tags
        .replace(/<br\s*\/?>/g, "\n") // Convert br tags to newlines
        .trim();

      // Split into lines and add > prefix to each line
      const lines = cleanedQuote.split("\n");
      const quotedLines = lines
        .map((line) => {
          const trimmedLine = line.trim();
          if (trimmedLine) {
            return `<span style="color: #74b9ff; font-weight: bold;">&gt;</span> <span style="color: #e5e5e5;">${trimmedLine}</span>`;
          }
          return "";
        })
        .filter((line) => line); // Remove empty lines

      return quotedLines.join("\n") + "\n";
    };

    marked.setOptions({
      renderer: this.renderer,
      highlight: null, // We'll handle highlighting ourselves
      breaks: true,
      gfm: true,
    });
  }

  // Inject required CSS styles into the document
  // Inject required CSS styles into the document
  injectStyles() {
    // Only inject styles once
    if (document.getElementById("markdown-highlighter-styles")) {
      return;
    }

    const styleElement = document.createElement("style");
    styleElement.id = "markdown-highlighter-styles";
    styleElement.textContent = `
        /* Code block container styles */
        .md-image-link {
            color: var(--success-color);
            text-decoration: underline;
            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
            font-size: 0.9em;
        }

        .md-image-link:hover {
            color: var(--accent-primary);
        }

        .md-link {
            color: var(--success-color);
            text-decoration: underline;
            transition: color 0.2s ease;
        }

        .md-link:hover {
            color: var(--accent-primary);
            text-decoration: underline;
        }

        .md-link:visited {
            color: var(--accent-secondary);
        }

        .md-link:visited:hover {
            color: var(--accent-primary);
        }

        .code-block-container {
            position: relative;
            margin: 0;
            font-size: 0;
            border: 1px solid var(--border-primary);
            border-radius: 6px;
            margin-bottom: 16px;
            overflow: hidden;
        }

        .code-block-wrapper {
            position: relative;
            margin: 0;
            padding: 0;
            font-size: 0;
        }

        /* Common button styles */
        .code-button {
            background-color: var(--backdrop-blur);
            border: 1px solid var(--border-primary);
            border-radius: 4px;
            color: var(--text-primary);
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            height: 24px;
            padding: 0;
            min-width: 24px;
        }

        .code-button:hover {
            background-color: var(--bg-tertiary);
        }

        .code-button svg {
            width: 12px;
            height: 12px;
        }

        .code-button-with-text {
            padding: 0 6px;
            gap: 4px;
        }

        /* Restore font-size for the actual content */
        .code-block-wrapper pre {
            margin: 0;
            padding: 0;
            font-size: 14px;
        }

        .code-block-wrapper pre code {
            padding: 8px;
            display: block;
            font-size: 14px;
        }

        /* Markdown code fence marker styling */
        .md-codeblock {
            display: inline-block;
            padding: 0;
            margin: 0;
            line-height: 1;
            font-size: 12px;
            color: var(--error-color);
            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
        }

        /* Code block header */
        .code-block-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px;
            background-color: var(--bg-secondary);
            border-bottom: 1px solid var(--border-primary);
        }

        .code-block-title {
            display: flex;
            align-items: center;
            gap: 8px;
            color: var(--text-primary);
            font-size: 12px;
            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
        }

        .code-block-actions {
            display: flex;
            gap: 8px;
        }

        /* Collapsed view */
        .code-block-collapsed {
            padding: 16px;
            background-color: var(--bg-secondary);
            color: var(--text-primary);
            font-size: 14px;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .code-block-collapsed:hover {
            background-color: var(--bg-tertiary);
        }

        /* Render iframe */
        .code-render-container {
            width: 100%;
            border: none;
            background-color: white;
            min-height: 200px;
        }

        /* For mobile devices, keep the button visible always */
        @media (max-width: 768px) {
            .code-button {
                opacity: 0.7;
            }
        }

        /* Style for bold text */
        .md-bold {
            color: var(--warning-color);
            font-weight: bold;
        }

        /* Style for italic text */
        .md-italic {
            color: var(--text-secondary);
            font-style: italic;
        }

        /* Style for headings */
        .md-heading {
            color: var(--success-color);
        }

        /* Style for blockquotes */
        .md-blockquote {
            color: var(--text-secondary);
        }

        /* Style for inline code */
        .hljs-inline {
            color: var(--error-color);
        }

        /* Make sure we don't lose the original markdown formatting */
        .result-content {
            white-space: pre-wrap;
            word-wrap: break-word;
            font-family: monospace;
            line-height: 1.6;
        }

        /* Code blocks */
        .result-content pre {
            margin: 0;
            padding: 0;
            background: none;
            display: block;
        }

        .result-content code {
            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
            font-size: 10px;
            background: none;
        }

        pre {
            white-space: pre-wrap;
            word-break: break-word;
        }

        /* Mobile responsive adjustments */
        @media (max-width: 768px) {
            .code-block-wrapper {
                max-width: 100%;
                overflow-x: auto;
            }

            .hljs {
                white-space: pre-wrap;
                word-break: break-word;
            }
        }

        .md-list {
            margin: 0.5em 0; /* Reduced margin */
            padding-left: 2em;
            color: var(--text-primary);
        }

        .md-list-ordered {
            list-style-type: decimal;
        }

        .md-list-unordered {
            list-style-type: disc;
        }

        .md-list-item {
            margin: 0.2em 0; /* Reduced margin between items */
            color: var(--text-primary);
        }

        /* Nested lists - reduce spacing */
        .md-list .md-list {
            margin: 0.1em 0; /* Much smaller margin for nested lists */
        }

        .md-list .md-list-unordered {
            list-style-type: circle;
        }

        .md-list .md-list .md-list-unordered {
            list-style-type: square;
        }

        /* Ensure proper spacing for lists with blank lines */
        .md-list-item p {
            margin: 0;
        }

        /* Additional fix: control spacing between lists and other elements */
        .md-list + * {
            margin-top: 0.5em;
        }

        * + .md-list {
            margin-top: 0.5em;
        }
    `;

    document.head.appendChild(styleElement);
  }

  // Calculate estimated tokens (length/5 is a simple approximation)
  calculateTokens(text) {
    return Math.ceil(text.length / 5);
  }

  // Set view mode for code blocks
  setCodeBlockView(view) {
    if (["collapsed", "code", "render"].includes(view)) {
      this.codeBlockView = view;
      localStorage.setItem("codeblockView", view);
    }
  }

  // Create an iframe for HTML rendering (sandboxed — no same-origin access)
  createRenderIframe(htmlContent, blockId) {
    const iframeId = `iframe-${blockId}`;
    const iframe = document.createElement("iframe");
    iframe.id = iframeId;
    iframe.className = "code-render-container";
    // allow-scripts lets the content run JS, but without allow-same-origin
    // the iframe cannot access parent cookies, fetch authenticated endpoints,
    // or read parent DOM — preventing token theft via /user.
    iframe.setAttribute("sandbox", "allow-scripts");
    iframe.style.height = `${Math.max(
      200,
      Math.min(600, htmlContent.length / 10)
    )}px`;

    // Use srcdoc so content works within the sandbox.
    // Append a height-reporter script that uses postMessage.
    iframe.srcdoc = `<!DOCTYPE html><html><head><style>body{margin:0;}</style></head><body>${htmlContent}<script>function _rh(){window.parent.postMessage({type:'iframe-resize',id:'${iframeId}',height:document.documentElement.scrollHeight},'*');}setTimeout(_rh,0);window.addEventListener('load',_rh);<\/script></body></html>`;

    return iframe;
  }

  // No-op: content is now set via srcdoc in createRenderIframe
  injectHtmlIntoIframe(iframeId, htmlContent) {}

  // Generate code block HTML
  generateCodeBlockHtml(blockData) {
    const {
      code,
      language,
      tokenCount,
      blockId,
      // string with params
      parameters,
    } = blockData;
    const defaultView = this.loading ? "code" : this.codeBlockView;

    let highlightedCode = code;

    // Apply syntax highlighting to the code if hljs is available
    if (typeof hljs !== "undefined") {
      try {
        if (language && language !== "plaintext") {
          try {
            highlightedCode = hljs.highlight(code, { language }).value;
          } catch (e) {
            highlightedCode = this.escapeHTML(code);
          }
        } else {
          try {
            highlightedCode = hljs.highlightAuto(code).value;
          } catch (e) {
            highlightedCode = this.escapeHTML(code);
          }
        }
      } catch (e) {
        highlightedCode = this.escapeHTML(code);
      }
    } else {
      highlightedCode = this.escapeHTML(code);
    }

    // Create the HTML for the code block with all the features
    let html = `<div class="code-block-container" data-block-id="${blockId}" data-language="${language}" data-view="${defaultView}">`;

    const actionsPart = this.loading
      ? ""
      : `<div class="code-block-actions">
        
        <button class="code-button code-collapse-toggle" data-block-id="${blockId}" title="Toggle Collapse">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>

        <button class="code-button code-copy-button" data-block-id="${blockId}" title="Copy code">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span class="copy-text"></span>
        </button>

        ${
          language === "html"
            ? `
          <button class="code-button code-open-new-tab" data-block-id="${blockId}" title="Open in New Tab">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </button>
          <button class="code-button code-button-with-text code-render-toggle" data-block-id="${blockId}" title="Toggle Render">
            ${
              defaultView === "code"
                ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="1 12 8 12 11 4 14 20 17 12 24 12"></polyline>
          </svg>`
                : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
            </svg>`
            }
            ${defaultView === "code" ? "Render" : "Code"}
          </button>
        `
            : ""
        }
      </div>`;
    // Header with language and actions
    //  ${this.loading? "": `
    html += `
    <div class="code-block-header">
      <div class="code-block-title">
        <span>${language}${parameters ? ` ${parameters}` : ""}</span>
        <span>${tokenCount} tokens</span>
      </div>
    
      ${actionsPart}
    </div>`;
    //`}
    // Collapsed view (hidden by default if not in collapsed mode)
    html += `
    <div class="code-block-collapsed" style="${
      defaultView === "collapsed" ? "" : "display: none;"
    }" data-block-id="${blockId}">
      <div><strong>${language}</strong> code block (${tokenCount} tokens)</div>
      <div>Click to expand</div>
    </div>`;

    // Code view
    html += `
    <div class="code-block-wrapper" style="${
      defaultView === "code" ? "" : "display: none;"
    }" data-block-id="${blockId}-code">
      <pre id="${blockId}"><code class="hljs language-${language}">${highlightedCode}</code></pre>
    </div>`;

    // Render view (only for HTML)
    if (language === "html") {
      html += `
      <div class="code-render-wrapper" style="${
        defaultView === "render" ? "" : "display: none;"
      }" data-block-id="${blockId}-render"></div>`;
    }

    html += `</div>`;
    return html;
  }

  // Render a <details> block with lightweight code handling (no heavy code block UI)
  renderDetailsBlock(inner) {
    const rendered = inner.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
      const trimmed = code.trimEnd();
      let highlighted = this.escapeHTML(trimmed);
      if (typeof hljs !== "undefined" && lang) {
        try {
          highlighted = hljs.highlight(trimmed, { language: lang }).value;
        } catch (e) {}
      }
      return `<pre style="margin:4px 0;"><code class="hljs language-${lang || "plaintext"}">${highlighted}</code></pre>`;
    });
    return `<details>${rendered}</details>`;
  }

  // Main function to highlight markdown text using marked
  highlightMarkdown(text) {
    // Check if marked is available
    if (typeof marked === "undefined") {
      console.warn("Marked library not loaded, falling back to escaped text");
      return this.escapeHTML(text);
    }

    try {
      // Extract <details> blocks before marked processing so their code fences
      // don't go through the heavy code block renderer (buttons, iframes, etc.)
      const detailsBlocks = [];
      const processed = text.replace(/<details>([\s\S]*?)<\/details>/g, (_, inner) => {
        const idx = detailsBlocks.length;
        detailsBlocks.push(this.renderDetailsBlock(inner));
        return `<div data-details-idx="${idx}"></div>`;
      });

      let parsedHtml = marked.parse(processed);

      // Restore details blocks (marked passes through block-level HTML as-is)
      for (let i = 0; i < detailsBlocks.length; i++) {
        parsedHtml = parsedHtml.replace(`<div data-details-idx="${i}"></div>`, detailsBlocks[i]);
      }

      // Sanitize to strip <script>, event handlers, javascript: URIs, etc.
      if (typeof DOMPurify !== "undefined") {
        parsedHtml = DOMPurify.sanitize(parsedHtml, {
          USE_PROFILES: { html: true, svg: true },
          ALLOW_DATA_ATTR: true,
        });
      }

      return parsedHtml;
    } catch (error) {
      console.error("Error parsing markdown:", error);
      return this.escapeHTML(text);
    }
  }

  // Helper function to escape HTML
  escapeHTML(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  setupOpenInNewTabButtons() {
    const openButtons = document.querySelectorAll(".code-open-new-tab");

    openButtons.forEach((button) => {
      // Remove existing event listeners to prevent duplicates
      const newButton = button.cloneNode(true);
      button.parentNode.replaceChild(newButton, button);

      newButton.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent event bubbling
        const blockId = newButton.getAttribute("data-block-id");
        const codeElement = document.getElementById(blockId);
        const htmlContent = codeElement ? codeElement.textContent : "";

        if (htmlContent) {
          // Create a data URL from the HTML content
          const blob = new Blob([htmlContent], { type: "text/html" });
          const blobUrl = URL.createObjectURL(blob);
          window.open(blobUrl, "_blank");
        }
      });
    });
  }

  // Setup all interactive elements for code blocks
  setupInteractiveElements() {
    // Setup copy buttons
    this.setupCopyButtons();

    // Setup collapse toggles
    this.setupCollapseToggles();

    // Setup render toggles (for HTML code blocks)
    this.setupRenderToggles();

    this.setupOpenInNewTabButtons();

    // Initialize HTML renders if any are set to render view by default
    this.initializeHtmlRenders();
  }

  // Setup copy buttons for code blocks
  setupCopyButtons() {
    const copyButtons = document.querySelectorAll(".code-copy-button");

    copyButtons.forEach((button) => {
      // Remove existing event listeners to prevent duplicates
      const newButton = button.cloneNode(true);
      button.parentNode.replaceChild(newButton, button);

      newButton.addEventListener("click", async (e) => {
        e.stopPropagation(); // Prevent event bubbling
        const blockId = newButton.getAttribute("data-block-id");
        const codeBlock = document.getElementById(blockId);
        const code = codeBlock ? codeBlock.textContent : "";

        try {
          await navigator.clipboard.writeText(code);
          const buttonText = newButton.querySelector(".copy-text");
          buttonText.textContent = "Copied!";

          setTimeout(() => {
            buttonText.textContent = "";
          }, 1000);
        } catch (err) {
          console.error("Failed to copy code:", err);
        }
      });
    });
  }

  // Setup collapse toggles for code blocks
  setupCollapseToggles() {
    const collapseToggles = document.querySelectorAll(".code-collapse-toggle");
    const collapsedBlocks = document.querySelectorAll(".code-block-collapsed");

    // Expand when clicking on the collapsed view
    collapsedBlocks.forEach((block) => {
      block.addEventListener("click", () => {
        const blockId = block.getAttribute("data-block-id");
        const container = document.querySelector(
          `.code-block-container[data-block-id="${blockId}"]`
        );

        if (container) {
          // Show the code view instead
          block.style.display = "none";
          const codeWrapper = container.querySelector(
            `.code-block-wrapper[data-block-id="${blockId}-code"]`
          );
          if (codeWrapper) {
            codeWrapper.style.display = "";

            // Update the toggle button text
            const toggleButton = container.querySelector(
              ".code-collapse-toggle"
            );
            if (toggleButton) {
              toggleButton.innerHTML = `
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="18 15 12 9 6 15"></polyline>
                  </svg>
                `;
            }

            // Update the container's view state
            container.setAttribute("data-view", "code");

            // Update localStorage preference
            this.setCodeBlockView("code");
          }
        }
      });
    });

    // Toggle collapse/expand with the button
    collapseToggles.forEach((button) => {
      // Remove existing event listeners to prevent duplicates
      const newButton = button.cloneNode(true);
      button.parentNode.replaceChild(newButton, button);

      newButton.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent event bubbling
        const blockId = newButton.getAttribute("data-block-id");
        const container = document.querySelector(
          `.code-block-container[data-block-id="${blockId}"]`
        );

        if (container) {
          const currentView = container.getAttribute("data-view");
          const collapsedBlock = container.querySelector(
            `.code-block-collapsed`
          );
          const codeWrapper = container.querySelector(
            `.code-block-wrapper[data-block-id="${blockId}-code"]`
          );
          const renderWrapper = container.querySelector(
            `.code-render-wrapper[data-block-id="${blockId}-render"]`
          );

          if (currentView === "collapsed") {
            // Expand to code view
            collapsedBlock.style.display = "none";
            codeWrapper.style.display = "";
            if (renderWrapper) renderWrapper.style.display = "none";

            newButton.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="18 15 12 9 6 15"></polyline>
                </svg>
              `;

            container.setAttribute("data-view", "code");
            this.setCodeBlockView("code");
          } else {
            // Collapse
            collapsedBlock.style.display = "";
            codeWrapper.style.display = "none";
            if (renderWrapper) renderWrapper.style.display = "none";

            newButton.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              `;

            container.setAttribute("data-view", "collapsed");
            this.setCodeBlockView("collapsed");
          }
        }
      });
    });
  }

  // Setup render toggles for HTML code blocks
  setupRenderToggles() {
    const renderToggles = document.querySelectorAll(".code-render-toggle");

    renderToggles.forEach((button) => {
      // Remove existing event listeners to prevent duplicates
      const newButton = button.cloneNode(true);
      button.parentNode.replaceChild(newButton, button);

      let lastRender = 0;

      newButton.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent event bubbling

        const now = Date.now();
        if (now - lastRender < 100) return; // • If less than 100 ms passed, ignore
        lastRender = now; // • Otherwise, record the time

        const blockId = newButton.getAttribute("data-block-id");
        const container = document.querySelector(
          `.code-block-container[data-block-id="${blockId}"]`
        );

        if (container) {
          const currentView = container.getAttribute("data-view");
          const collapsedBlock = container.querySelector(
            `.code-block-collapsed`
          );
          const codeWrapper = container.querySelector(
            `.code-block-wrapper[data-block-id="${blockId}-code"]`
          );
          const renderWrapper = container.querySelector(
            `.code-render-wrapper[data-block-id="${blockId}-render"]`
          );

          if (currentView === "render") {
            // Switch to code view
            collapsedBlock.style.display = "none";
            codeWrapper.style.display = "";
            renderWrapper.style.display = "none";

            newButton.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="1 12 8 12 11 4 14 20 17 12 24 12"></polyline>
                </svg>
                Render
              `;

            container.setAttribute("data-view", "code");
            this.setCodeBlockView("code");
          } else {
            // Switch to render view and create iframe if needed
            collapsedBlock.style.display = "none";
            codeWrapper.style.display = "none";
            renderWrapper.style.display = "";

            // Check if we need to create the iframe
            if (!renderWrapper.querySelector("iframe")) {
              const codeElement = document.getElementById(blockId);
              const htmlContent = codeElement ? codeElement.textContent : "";

              const iframe = this.createRenderIframe(htmlContent, blockId);
              renderWrapper.appendChild(iframe);
              this.injectHtmlIntoIframe(iframe.id, htmlContent);
            }

            newButton.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="2" y1="12" x2="22" y2="12"></line>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
                Code
              `;

            container.setAttribute("data-view", "render");
            this.setCodeBlockView("render");
          }
        }
      });
    });
  }

  // Initialize HTML renders for blocks set to render view by default
  initializeHtmlRenders() {
    const htmlBlocks = document.querySelectorAll(
      `.code-block-container[data-language="html"][data-view="render"]`
    );

    htmlBlocks.forEach((container) => {
      const blockId = container.getAttribute("data-block-id");
      const renderWrapper = container.querySelector(
        `.code-render-wrapper[data-block-id="${blockId}-render"]`
      );

      if (renderWrapper && !renderWrapper.querySelector("iframe")) {
        const codeElement = document.getElementById(blockId);
        const htmlContent = codeElement ? codeElement.textContent : "";

        const iframe = this.createRenderIframe(htmlContent, blockId);
        renderWrapper.appendChild(iframe);
        this.injectHtmlIntoIframe(iframe.id, htmlContent);
      }
    });
  }

  // Process content and set up all functionality
  processContent(element, content, loading = false) {
    if (!element) return;

    if (this._lastRender && Date.now() - this._lastRender < 100) {
      clearTimeout(this._renderTimeout);
      this._renderTimeout = setTimeout(
        () => this.processContent(element, content, loading),
        100 - (Date.now() - this._lastRender)
      );
      return;
    }
    this._lastRender = Date.now();

    this.loading = loading;

    // Wait for marked to be ready if it's still loading
    if (typeof marked === "undefined") {
      if (loading === false) {
        setTimeout(() => {
          this.processContent(element, content, loading);
        }, 100);
      }
      return;
    }

    element.innerHTML = this.highlightMarkdown(content);

    // if (!loading) {
    this.setupInteractiveElements();
    // }

    return element;
  }
}

// Create and export a singleton instance
const markdownHighlighter = new MarkdownHighlighter();

// For use in browser environments
if (typeof window !== "undefined") {
  window.markdownHighlighter = markdownHighlighter;
}

// For use in module environments
if (typeof module !== "undefined" && module.exports) {
  module.exports = markdownHighlighter;
}
