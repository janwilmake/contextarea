// lib.js - ContextArea Demo library
// Implements paste, drag-drop, upload, URL extraction and Context API metadata cards.

document.addEventListener("DOMContentLoaded", () => {
  const textarea = document.getElementById("contextarea");
  const uploadButton = document.querySelector(".contextarea-upload-button");
  const fileInput = document.querySelector(".contextarea-file-input");
  const cardsContainer = document.querySelector(".contextarea-cards");

  // Constants
  const CONTEXT_API_URL = "https://context.contextarea.com/";
  const PASTEBIN_API_URL = "https://pastebin.contextarea.com/";
  const URL_REGEX =
    /(https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b(?:[-a-zA-Z0-9@:%_\+.~#()?&\/=]*))/gi;
  const MAX_REGULAR_PASTE_LENGTH = 1000;

  if (!textarea) return;

  // Map url -> card element for caching displayed cards and for update sync
  const processedUrls = new Map();

  // Setup event listeners
  textarea.addEventListener("paste", handlePaste);
  textarea.addEventListener("dragover", handleDragOver);
  textarea.addEventListener("dragleave", handleDragLeave);
  textarea.addEventListener("drop", handleDrop);
  textarea.addEventListener("input", debounce(processUrls, 1000));
  textarea.addEventListener("keyup", handleCursorMove);
  textarea.addEventListener("click", handleCursorMove);
  uploadButton.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", handleFileSelect);

  // Initial processing on load
  processUrls();

  // Shift key held: regular paste.
  async function handlePaste(event) {
    if (event.shiftKey) return; // allow regular paste when shift held

    const clipboard = event.clipboardData || window.clipboardData;
    if (!clipboard) return;

    // Check if clipboardData has files; handle files separately
    if (clipboard.files && clipboard.files.length > 0) {
      event.preventDefault();
      await handleFiles(clipboard.files);
      return;
    }

    const pastedText = clipboard.getData("text");
    if (!pastedText) return; // no text to process

    const trimmedText = pastedText.trim();

    // If pasted text is a url itself (or trimmed is) OR length <= max regular length => regular paste allowed
    if (isUrl(trimmedText) || pastedText.length <= MAX_REGULAR_PASTE_LENGTH) {
      return; // allow regular paste
    }

    // Else: prevent default paste and send text to pastebin, then paste pastebin URL instead
    event.preventDefault();
    try {
      const pasteUrl = await sendToPastebin(pastedText);
      insertTextAtCursor(textarea, pasteUrl);
      processUrls();
    } catch (err) {
      // fallback to regular paste if pastebin fails
      console.error("Pastebin upload failed", err);
      insertTextAtCursor(textarea, pastedText);
      processUrls();
    }
  }

  // Drag over handler: highlight border and prevent default
  function handleDragOver(evt) {
    evt.preventDefault();
    evt.stopPropagation();
    textarea.classList.add("contextarea-dragover");
  }

  // Drag leave handler: remove highlight
  function handleDragLeave(evt) {
    evt.preventDefault();
    evt.stopPropagation();
    // Only remove if leaving textarea
    if (evt.target === textarea) {
      textarea.classList.remove("contextarea-dragover");
    }
  }

  // Drop handler - files or text
  async function handleDrop(evt) {
    evt.preventDefault();
    evt.stopPropagation();
    textarea.classList.remove("contextarea-dragover");

    const dt = evt.dataTransfer;
    if (!dt) return;

    // If files present in dataTransfer use upload flow
    if (dt.files && dt.files.length > 0) {
      await handleFiles(dt.files);
      return;
    }

    // Else handle dropped text
    const droppedText = dt.getData("text");
    if (!droppedText) return;

    const trimmedText = droppedText.trim();

    // If dropped text is very long and not a single url, upload to pastebin
    if (trimmedText.length > MAX_REGULAR_PASTE_LENGTH && !isUrl(trimmedText)) {
      try {
        const pasteUrl = await sendToPastebin(trimmedText);
        insertTextAtCursor(textarea, pasteUrl);
        processUrls();
      } catch (err) {
        console.error("Pastebin upload failed for dropped text", err);
        insertTextAtCursor(textarea, droppedText);
        processUrls();
      }
      return;
    }

    // Otherwise insert dropped text normally
    insertTextAtCursor(textarea, droppedText);
    processUrls();
  }

  // File input change event handler
  async function handleFileSelect(evt) {
    if (evt.target.files && evt.target.files.length > 0) {
      await handleFiles(evt.target.files);
    }
  }

  // Handle uploading multiple files to pastebin and inserting URLs
  async function handleFiles(fileList) {
    for (const file of fileList) {
      try {
        const contentBuffer = await readFileAsArrayBuffer(file);
        const pasteUrl = await sendToPastebin(contentBuffer, file.type);
        // Insert URL plus trailing space for better UX
        insertTextAtCursor(textarea, pasteUrl + " ");
      } catch (error) {
        console.error(`Upload failed for file ${file.name}`, error);
        // Skip file on failure, no insert
      }
    }
    processUrls();
  }

  // Debounce helper
  function debounce(fn, ms) {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), ms);
    };
  }

  // Process all URLs found in textarea content.
  // Update cards: remove cards no longer present,
  // add cards for new urls, update old cards only if changed.
  async function processUrls() {
    const text = textarea.value;
    if (!text) {
      // Clear all cards
      cardsContainer.innerHTML = "";
      processedUrls.clear();
      return;
    }

    const foundUrls = [...text.matchAll(URL_REGEX)].map((m) => m[0]);
    const uniqueUrls = Array.from(new Set(foundUrls));

    // Remove cards for URLs no longer present
    for (const [url, cardElem] of processedUrls.entries()) {
      if (!uniqueUrls.includes(url)) {
        cardElem.remove();
        processedUrls.delete(url);
      }
    }

    // Add cards for new URLs or update existing cards
    for (const url of uniqueUrls) {
      if (!processedUrls.has(url)) {
        // Add loading placeholder card
        const loadingCard = createLoadingCard(url);
        cardsContainer.appendChild(loadingCard);
        processedUrls.set(url, loadingCard);

        // Fetch context data async
        fetchContextData(url)
          .then((data) => {
            // Create card from data
            const newCard = createContextCard(data, url);
            // Replace loading placeholder
            if (processedUrls.has(url)) {
              const oldElem = processedUrls.get(url);
              if (oldElem === loadingCard) {
                cardsContainer.replaceChild(newCard, loadingCard);
                processedUrls.set(url, newCard);
              } else {
                // If changed by user? Just append new card
                cardsContainer.appendChild(newCard);
                processedUrls.set(url, newCard);
              }
            }
          })
          .catch((error) => {
            // Replace loading card with error card
            const errorCard = createErrorCard(url, error.message);
            if (processedUrls.has(url)) {
              const oldElem = processedUrls.get(url);
              if (oldElem === loadingCard) {
                cardsContainer.replaceChild(errorCard, loadingCard);
                processedUrls.set(url, errorCard);
              } else {
                cardsContainer.appendChild(errorCard);
                processedUrls.set(url, errorCard);
              }
            }
          });
      }
    }

    // After delay, update highlight based on cursor position
    handleCursorMove();
  }

  // Highlight the card whose URL is under the cursor in the textarea
  function handleCursorMove() {
    const cursorPos = textarea.selectionStart;
    const text = textarea.value;
    const urls = [...text.matchAll(URL_REGEX)];

    // Remove active highlights from all cards
    cardsContainer
      .querySelectorAll(".contextarea-card-active")
      .forEach((el) => {
        el.classList.remove("contextarea-card-active");
      });

    // Find if cursor is inside any URL
    for (const match of urls) {
      const start = match.index;
      const end = start + match[0].length;
      if (cursorPos >= start && cursorPos <= end) {
        const url = match[0];
        const card = processedUrls.get(url);
        if (card) card.classList.add("contextarea-card-active");
        card?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        break;
      }
    }
  }

  // Create a loading card for a URL
  function createLoadingCard(url) {
    const card = document.createElement("article");
    card.className = "contextarea-card";
    card.dataset.url = url;
    const hostname = safeHostname(url);

    card.innerHTML = /*html*/ `
      <div class="contextarea-loading" aria-live="polite" aria-busy="true" role="status">
        <span class="contextarea-spinner" aria-hidden="true"></span>
        Loading context for <strong>${hostname}</strong>...
      </div>
    `;
    return card;
  }

  // Create an error card for a URL load failure
  function createErrorCard(url, message) {
    const card = document.createElement("article");
    card.className = "contextarea-card";
    card.dataset.url = url;
    const hostname = safeHostname(url);

    card.innerHTML = /*html*/ `
      <div class="contextarea-card-content">
        <h3 class="contextarea-card-title">${hostname}</h3>
        <p class="contextarea-card-description" style="color:#b34747;">Failed to load context: ${escapeHTML(
          message,
        )}</p>
        <div class="contextarea-card-actions">
          <button class="contextarea-card-button goto-url-btn" type="button" aria-label="Open URL ${escapeHTML(
            url,
          )} in new tab">Go to URL</button>
          <button class="contextarea-card-button goto-cursor-btn" type="button" aria-label="Find URL in text area">Find in Text</button>
        </div>
      </div>
    `;

    card.querySelector(".goto-url-btn").addEventListener("click", () => {
      window.open(url, "_blank", "noopener");
    });

    card.querySelector(".goto-cursor-btn").addEventListener("click", () => {
      findInTextarea(url);
    });

    return card;
  }

  // Create a fully rendered context card from context API data
  function createContextCard(data, url) {
    const card = document.createElement("article");
    card.className = "contextarea-card";
    card.dataset.url = url;

    const hasImage = !!data.ogImageUrl;
    const hostname = safeHostname(url);

    // Escape helper for user/text content:
    function esc(s) {
      return escapeHTML(s || "");
    }

    card.innerHTML = /*html*/ `
      ${
        hasImage
          ? `<img class="contextarea-card-image" src="${esc(
              data.ogImageUrl,
            )}" alt="${esc(data.title || "Preview Image")}" loading="lazy">`
          : ""
      }
      <div class="contextarea-card-content">
        <h3 class="contextarea-card-title">${esc(data.title || hostname)}</h3>
        <p class="contextarea-card-description">${esc(
          data.description || "No description available",
        )}</p>
        <div class="contextarea-card-meta" aria-label="Metadata">
          ${
            data.type
              ? `<div class="contextarea-card-meta-item" title="Content Type">Type: <strong>${esc(
                  data.type,
                )}</strong></div>`
              : ""
          }
          ${
            typeof data.tokens === "number"
              ? `<div class="contextarea-card-meta-item" title="Estimated token count">Tokens: <strong>${data.tokens}</strong></div>`
              : ""
          }
          ${
            data.twitterUsername
              ? `<div class="contextarea-card-meta-item" title="Twitter Username">Twitter: <strong>@${esc(
                  data.twitterUsername,
                )}</strong></div>`
              : ""
          }
          ${
            data.githubOwner
              ? `<div class="contextarea-card-meta-item" title="GitHub Owner">GitHub: <strong>${esc(
                  data.githubOwner,
                )}</strong></div>`
              : ""
          }
        </div>
        <div class="contextarea-card-actions">
          <button class="contextarea-card-button goto-url-btn" type="button" aria-label="Open URL ${esc(
            url,
          )} in new tab">Go to URL</button>
          <button class="contextarea-card-button goto-cursor-btn" type="button" aria-label="Find URL in text area">Find in Text</button>
        </div>
      </div>
    `;

    // Button: Open original URL in new tab/window securely
    card.querySelector(".goto-url-btn").addEventListener("click", () => {
      window.open(url, "_blank", "noopener");
    });

    // Button: Scroll textarea to the URL location, focus and move cursor after it
    card.querySelector(".goto-cursor-btn").addEventListener("click", () => {
      findInTextarea(url);
    });

    return card;
  }

  // Scroll textarea selection to the first occurrence of url text in textarea
  function findInTextarea(url) {
    const text = textarea.value;
    const idx = text.indexOf(url);
    if (idx === -1) return;
    textarea.focus();
    textarea.setSelectionRange(idx, idx + url.length);
    textarea.scrollTop = lineScrollTop(textarea, idx);
  }

  // Calculates approximate vertical scroll offset so selection is visible
  // based on textarea line height and position - rough, but works reasonably.
  function lineScrollTop(textarea, index) {
    // Count line number of index
    const value = textarea.value;
    const substring = value.slice(0, index);
    const lines = substring.split("\n").length - 1;
    const lineHeight = parseInt(
      window.getComputedStyle(textarea).lineHeight,
      10,
    );
    return lines * lineHeight;
  }

  // Fetch context area data from API for given URL
  async function fetchContextData(url) {
    const query = `?url=${encodeURIComponent(url)}`;
    const response = await fetch(CONTEXT_API_URL + query);
    if (!response.ok) {
      throw new Error(`Context API error ${response.status}`);
    }
    const data = await response.json();
    return data;
  }

  // Send text or ArrayBuffer content to pastebin and return paste URL
  async function sendToPastebin(content, contentType = "text/plain") {
    let body;

    if (typeof content === "string") {
      body = content;
      contentType = "text/plain";
    } else {
      // ArrayBuffer, wrap in blob
      body = new Blob([content], { type: contentType });
    }

    const response = await fetch(PASTEBIN_API_URL, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body,
    });

    if (!response.ok) {
      throw new Error(`Pastebin API error ${response.status}`);
    }
    return await response.text();
  }

  // Check if string is a valid URL
  function isUrl(text) {
    if (!text || typeof text !== "string") return false;
    try {
      new URL(text);
      return true;
    } catch {
      return false;
    }
  }

  // Inserts text at current cursor position in textarea without overwriting
  function insertTextAtCursor(textarea, text) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const oldValue = textarea.value;
    const prefix = oldValue.substring(0, start);
    const suffix = oldValue.substring(end);
    textarea.value = prefix + text + suffix;
    const pos = start + text.length;
    textarea.selectionStart = textarea.selectionEnd = pos;
  }

  // Reads a File as ArrayBuffer (Promise based)
  function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => resolve(reader.result);
      reader.readAsArrayBuffer(file);
    });
  }

  // Returns safe hostname string from url
  function safeHostname(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }

  // Escape HTML entities for safe insertion into the DOM text content
  function escapeHTML(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
});
