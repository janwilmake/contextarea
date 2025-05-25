document.addEventListener("DOMContentLoaded", function () {
  const contextarea = document.getElementById("contextarea");
  const uploadButton = document.querySelector(".upload-button");
  const fileInput = document.querySelector(".file-input");
  const cardsContainer = document.querySelector(".context-cards");

  // Constants
  const URL_REGEX = /(https?:\/\/[^\s]+)/g;
  const CONTEXT_API_URL = "https://context.contextarea.com/";
  const PASTEBIN_API_URL = "https://pastebin.contextarea.com/";
  const MAX_REGULAR_PASTE_LENGTH = 1000;

  if (!contextarea) return;

  // Setup event listeners
  contextarea.addEventListener("paste", handlePaste);
  contextarea.addEventListener("dragover", handleDragOver);
  contextarea.addEventListener("drop", handleDrop);
  contextarea.addEventListener("input", debounce(processUrls, 500));
  contextarea.addEventListener("keyup", handleCursorMove);
  contextarea.addEventListener("click", handleCursorMove);
  uploadButton.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", handleFileSelect);

  // Initialize
  processUrls();

  // Paste handler
  async function handlePaste(e) {
    // Allow regular paste if shift key is held
    if (e.shiftKey) return;

    const clipboardData = e.clipboardData || window.clipboardData;
    const pastedData = clipboardData.getData("text");

    // If it's a URL itself or short text, allow regular paste
    if (
      isUrl(pastedData.trim()) ||
      pastedData.length <= MAX_REGULAR_PASTE_LENGTH
    ) {
      return;
    }

    // Otherwise, handle with pastebin
    e.preventDefault();

    // Check if there are files in the clipboard
    if (clipboardData.files && clipboardData.files.length > 0) {
      handleFiles(clipboardData.files);
      return;
    }

    // Send the text to pastebin
    try {
      const pastebinUrl = await sendToPastebin(pastedData);
      insertTextAtCursor(contextarea, pastebinUrl);
      processUrls();
    } catch (error) {
      console.error("Failed to create paste:", error);
      // Fallback to regular paste
      insertTextAtCursor(contextarea, pastedData);
    }
  }

  // Drag and drop handlers
  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    contextarea.style.borderColor = "#3498db";
  }

  async function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    contextarea.style.borderColor = "";

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    } else {
      const text = e.dataTransfer.getData("text");
      if (
        text &&
        !isUrl(text.trim()) &&
        text.length > MAX_REGULAR_PASTE_LENGTH
      ) {
        try {
          const pastebinUrl = await sendToPastebin(text);
          insertTextAtCursor(contextarea, pastebinUrl);
          processUrls();
        } catch (error) {
          console.error("Failed to create paste:", error);
          insertTextAtCursor(contextarea, text);
        }
      } else {
        insertTextAtCursor(contextarea, text);
      }
    }
  }

  // File handling
  async function handleFileSelect(e) {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  }

  async function handleFiles(files) {
    for (const file of files) {
      try {
        const fileContent = await readFileAsArrayBuffer(file);
        const pastebinUrl = await sendToPastebin(fileContent, file.type);
        insertTextAtCursor(contextarea, `${pastebinUrl} `);
      } catch (error) {
        console.error(`Failed to upload file ${file.name}:`, error);
      }
    }
    processUrls();
  }

  // Process URLs in textarea
  async function processUrls() {
    const text = contextarea.value;
    const urls = text.match(URL_REGEX) || [];

    // Clear existing cards
    cardsContainer.innerHTML = "";

    // Process each URL
    for (const url of urls) {
      try {
        const contextData = await fetchContextData(url);
        createContextCard(contextData, url);
      } catch (error) {
        console.error(`Failed to fetch context for ${url}:`, error);
      }
    }
  }

  // Handle cursor movement to highlight relevant card
  function handleCursorMove() {
    const cursorPosition = contextarea.selectionStart;
    const text = contextarea.value;
    const urls = [...text.matchAll(URL_REGEX)];

    // Remove active class from all cards
    document.querySelectorAll(".context-card.active").forEach((card) => {
      card.classList.remove("active");
    });

    // Find if cursor is on any URL
    for (const match of urls) {
      const urlStart = match.index;
      const urlEnd = urlStart + match[0].length;

      if (cursorPosition >= urlStart && cursorPosition <= urlEnd) {
        const card = document.querySelector(
          `.context-card[data-url="${match[0]}"]`,
        );
        if (card) {
          card.classList.add("active");
          card.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
        break;
      }
    }
  }

  // Create a card for URL context data
  function createContextCard(data, url) {
    const card = document.createElement("div");
    card.className = "context-card";
    card.dataset.url = url;

    const hasImage = data.ogImageUrl || false;

    card.innerHTML = `
      ${
        hasImage
          ? `<img src="${data.ogImageUrl}" alt="${
              data.title || "Preview"
            }" class="card-image">`
          : ""
      }
      <div class="card-content">
        <h3 class="card-title">${data.title || "No Title"}</h3>
        <div class="card-description">${
          data.description || "No description available"
        }</div>
        <div class="card-meta">
          ${data.type ? `<div>Type: ${data.type}</div>` : ""}
          ${data.tokens ? `<div>Tokens: ${data.tokens}</div>` : ""}
          ${
            data.twitterUsername
              ? `<div>Twitter: @${data.twitterUsername}</div>`
              : ""
          }
          ${data.githubOwner ? `<div>GitHub: ${data.githubOwner}</div>` : ""}
        </div>
        <div class="card-actions">
          <button class="card-button goto-url-btn">Go to URL</button>
          <button class="card-button goto-cursor-btn">Find in Text</button>
        </div>
      </div>
    `;

    // Add event listeners to card buttons
    card.querySelector(".goto-url-btn").addEventListener("click", () => {
      window.open(url, "_blank");
    });

    card.querySelector(".goto-cursor-btn").addEventListener("click", () => {
      const text = contextarea.value;
      const urlIndex = text.indexOf(url);
      if (urlIndex !== -1) {
        contextarea.focus();
        contextarea.setSelectionRange(
          urlIndex + url.length,
          urlIndex + url.length,
        );
      }
    });

    cardsContainer.appendChild(card);
  }

  // API Functions
  async function fetchContextData(url) {
    const response = await fetch(
      `${CONTEXT_API_URL}?url=${encodeURIComponent(url)}`,
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch context: ${response.status}`);
    }
    return await response.json();
  }

  async function sendToPastebin(content, contentType = "text/plain") {
    let body;

    if (typeof content === "string") {
      body = content;
    } else {
      // It's an ArrayBuffer
      body = new Blob([content], { type: contentType });
    }

    const response = await fetch(PASTEBIN_API_URL, {
      method: "POST",
      body: body,
      headers: {
        "Content-Type": contentType,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to create paste: ${response.status}`);
    }

    return await response.text();
  }

  // Utility Functions
  function isUrl(text) {
    try {
      new URL(text);
      return true;
    } catch {
      return false;
    }
  }

  function insertTextAtCursor(textarea, text) {
    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;
    textarea.value =
      textarea.value.substring(0, startPos) +
      text +
      textarea.value.substring(endPos);
    textarea.selectionStart = textarea.selectionEnd = startPos + text.length;
  }

  function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  function debounce(func, delay) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), delay);
    };
  }
});
