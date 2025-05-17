// markdown-highlighter.js

// Main class to handle markdown highlighting and code block functionality
class MarkdownHighlighter {
  constructor() {
    this.setupComplete = false;
    this.injectStyles();
  }

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
      .code-block-container {
        position: relative;
        margin: 0;
        font-size: 0;
      }

      .code-block-wrapper {
        position: relative;
        margin: 0;
        padding: 0;
        font-size: 0;
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
        color: #ff6b6b;
        font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      }

      .md-codeblock {
        color: #ff6b6b;
        font-size: 10px;
        font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      }

      /* Copy button styles */
      .code-copy-button {
        position: absolute;
        top: 8px;
        right: 8px;
        background-color: rgba(42, 42, 42, 0.6);
        border: 1px solid #4a4a4a;
        border-radius: 4px;
        color: #e5e5e5;
        padding: 4px 6px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        opacity: 0;
        z-index: 10;
      }

      /* Show the copy button on hover over the code block */
      .code-block-wrapper:hover .code-copy-button {
        opacity: 1;
      }

      .code-copy-button:hover {
        background-color: rgba(74, 74, 74, 0.8);
      }

      .code-copy-button svg {
        width: 12px;
        height: 12px;
      }

      /* For mobile devices, keep the button visible always */
      @media (max-width: 768px) {
        .code-copy-button {
          opacity: 0.7;
        }
      }

      /* Style for bold text */
      .md-bold {
        color: #feca57;
        font-weight: bold;
      }

      /* Style for italic text */
      .md-italic {
        color: #b5b5b5;
        font-style: italic;
      }

      /* Style for headings */
      .md-heading {
        color: #4a9eff;
      }

      /* Style for list items */
      .md-list-item {
        color: #e5e5e5;
      }

      /* Style for blockquotes */
      .md-blockquote {
        color: #b5b5b5;
      }

      /* Style for inline code */
      .hljs-inline {
        color: #ff6b6b;
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

      /* Mobile responsive adjustments */
      @media (max-width: 768px) {
        pre {
          white-space: pre-wrap;
          word-break: break-word;
        }

        .code-block-wrapper {
          max-width: 100%;
          overflow-x: auto;
        }

        .hljs {
          white-space: pre-wrap;
          word-break: break-word;
        }

        .code-copy-button {
          opacity: 0.9;
          top: 3px;
          right: 3px;
          padding: 2px 4px;
          border-radius: 4px;
        }
      }
    `;

    document.head.appendChild(styleElement);
  }

  // Main function to highlight markdown text
  highlightMarkdown(text) {
    // Save code blocks first (to protect them from HTML escaping)
    const codeBlocks = [];
    let codeBlockIndex = 0;

    // 1. Extract and save code blocks with a placeholder
    const extractedText = text.replace(
      /(```[a-zA-Z0-9_]*\n)([\s\S]*?)(```)/g,
      (match, opening, code, closing) => {
        const placeholder = `__CODE_BLOCK_${codeBlockIndex}__`;
        codeBlocks.push({
          opening: opening,
          code: code,
          closing: closing,
        });
        codeBlockIndex++;
        return placeholder;
      },
    );

    // 2. Also handle inline code
    const inlineCodeBlocks = [];
    let inlineCodeIndex = 0;

    const extractedTextWithInlineCodes = extractedText.replace(
      /(`)(.*?)(`)/g,
      (match, opening, code, closing) => {
        const placeholder = `__INLINE_CODE_${inlineCodeIndex}__`;
        inlineCodeBlocks.push({
          opening: opening,
          code: code,
          closing: closing,
        });
        inlineCodeIndex++;
        return placeholder;
      },
    );

    // 3. Now escape HTML in the remaining text (not code blocks)
    let escapedText = this.escapeHTML(extractedTextWithInlineCodes);

    // 4. Process Markdown elements on the escaped text

    // Handle bold (double asterisks)
    escapedText = escapedText.replace(
      /(\*\*)([^*]+?)(\*\*)/g,
      '<span class="md-bold">$1$2$3</span>',
    );

    // Handle italic (single asterisk)
    escapedText = escapedText.replace(
      /([^*]|^)(\*)([^*]+?)(\*)([^*]|$)/g,
      function (match, before, open, content, close, after) {
        return (
          before +
          '<span class="md-italic">' +
          open +
          content +
          close +
          "</span>" +
          after
        );
      },
    );

    // Handle headings
    escapedText = escapedText.replace(
      /^((#{1,6})\s+)(.+)$/gm,
      '<span class="md-heading">$1$3</span>',
    );

    // Handle lists
    escapedText = escapedText.replace(
      /^(\s*[-*+]\s+)(.+)$/gm,
      '<span class="md-list-item">$1$2</span>',
    );
    escapedText = escapedText.replace(
      /^(\s*\d+\.\s+)(.+)$/gm,
      '<span class="md-list-item">$1$2</span>',
    );

    // Handle blockquotes
    escapedText = escapedText.replace(
      /^(\s*>\s+)(.+)$/gm,
      '<span class="md-blockquote">$1$2</span>',
    );

    // 5. Replace code block placeholders with properly highlighted code
    for (let i = 0; i < codeBlocks.length; i++) {
      const block = codeBlocks[i];
      const language = block.opening.trim().replace("```", "") || "plaintext";
      const blockId = `code-block-${i}-${Date.now()}`;

      // Apply syntax highlighting to the code (without escaping the HTML in the code)
      const highlightedCode = hljs.highlight(block.code, {
        language: language,
      }).value;

      // Create the HTML for the code block with a more compact structure
      const html = `<div class="code-block-container"><span class="md-codeblock">${this.escapeHTML(
        block.opening,
      )}</span><div class="code-block-wrapper"><button class="code-copy-button" data-block-id="${blockId}" title="Copy code"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg><span class="copy-text">Copy</span></button><pre id="${blockId}"><code class="hljs language-${language}">${highlightedCode}</code></pre></div><span class="md-codeblock">${this.escapeHTML(
        block.closing,
      )}</span></div>`;

      escapedText = escapedText.replace(`__CODE_BLOCK_${i}__`, html);
    }

    // 6. Replace inline code placeholders
    for (let i = 0; i < inlineCodeBlocks.length; i++) {
      const block = inlineCodeBlocks[i];
      const html = `<span class="hljs-inline">${this.escapeHTML(
        block.opening,
      )}${this.escapeHTML(block.code)}${this.escapeHTML(block.closing)}</span>`;
      escapedText = escapedText.replace(`__INLINE_CODE_${i}__`, html);
    }

    return escapedText;
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

  // Setup copy buttons for code blocks
  setupCopyButtons() {
    const copyButtons = document.querySelectorAll(".code-copy-button");

    copyButtons.forEach((button) => {
      // Remove existing event listeners to prevent duplicates
      const newButton = button.cloneNode(true);
      button.parentNode.replaceChild(newButton, button);

      newButton.addEventListener("click", async () => {
        const blockId = newButton.getAttribute("data-block-id");
        const codeBlock = document.getElementById(blockId);
        const code = codeBlock.textContent;

        try {
          await navigator.clipboard.writeText(code);
          const buttonText = newButton.querySelector(".copy-text");
          buttonText.textContent = "Copied!";

          setTimeout(() => {
            buttonText.textContent = "Copy";
          }, 1000);
        } catch (err) {
          console.error("Failed to copy code:", err);
        }
      });
    });
  }

  // Process content and set up all functionality
  processContent(element, content) {
    if (!element) return;

    element.innerHTML = this.highlightMarkdown(content);
    this.setupCopyButtons();

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
