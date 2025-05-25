/**
 * ContextArea - Enhanced textarea with URL context cards and file upload capabilities
 * @author Jan Wilmake
 * @version 1.0.0
 */

(function () {
  // Core DOM elements
  let textarea;
  let cardsContainer;
  let uploadButton;
  let fileInput;

  // Cache for context data
  const contextCache = new Map();

  // URL regex pattern
  const urlPattern =
    /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;

  // Initialize when DOM is ready
  document.addEventListener("DOMContentLoaded", initialize);

  /**
   * Initialize the ContextArea functionality
   */
  function initialize() {
    textarea = document.getElementById("contextarea");
    if (!textarea) return;

    // Create file input for upload button
    fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.multiple = true;
    fileInput.style.display = "none";
    document.body.appendChild(fileInput);

    // Find or create cards container
    cardsContainer = document.getElementById("contextarea-cards");
    if (!cardsContainer) {
      cardsContainer = document.createElement("div");
      cardsContainer.id = "contextarea-cards";
      cardsContainer.className = "contextarea-cards-container";
      textarea.parentNode.insertBefore(cardsContainer, textarea.nextSibling);
    }

    // Find upload button
    uploadButton = document.querySelector(".contextarea-upload-btn");

    // Setup event listeners
    setupEventListeners();
  }

  /**
   * Setup all required event listeners
   */
  function setupEventListeners() {
    // Paste handling
    textarea.addEventListener("paste", handlePaste);

    // Drag and drop handling
    textarea.addEventListener("dragover", handleDragOver);
    textarea.addEventListener("dragenter", handleDragEnter);
    textarea.addEventListener("dragleave", handleDragLeave);
    textarea.addEventListener("drop", handleDrop);

    // Text input handling with debounce for URL detection
    let debounceTimer;
    textarea.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        processUrlsInTextarea();
      }, 1000);
    });

    // Upload button click
    if (uploadButton) {
      uploadButton.addEventListener("click", () => fileInput.click());
    }

    // File input change
    fileInput.addEventListener("change", handleFileSelect);
  }

  /**
   * Handle paste events in the textarea
   * @param {Event} e - Paste event
   */
  async function handlePaste(e) {
    // Regular paste if Shift key is pressed
    if (e.shiftKey) return;

    const clipboardData = e.clipboardData || window.clipboardData;

    // Check if pasted content is text
    if (clipboardData.types.includes("text/plain")) {
      const text = clipboardData.getData("text/plain").trim();

      // If text is a URL or short text, allow regular paste
      if (isUrl(text) || text.length <= 1000) return;

      // Otherwise, upload the text content
      e.preventDefault();
      await uploadContent(text, "text/plain");
      return;
    }

    // Check if pasted content contains files
    if (clipboardData.files && clipboardData.files.length > 0) {
      e.preventDefault();
      await handleFiles(Array.from(clipboardData.files));
      return;
    }
  }

  /**
   * Handle dragover event
   * @param {Event} e - Dragover event
   */
  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    textarea.classList.add("contextarea-dragover");
  }

  /**
   * Handle dragenter event
   * @param {Event} e - Dragenter event
   */
  function handleDragEnter(e) {
    e.preventDefault();
    e.stopPropagation();
    textarea.classList.add("contextarea-dragover");
  }

  /**
   * Handle dragleave event
   * @param {Event} e - Dragleave event
   */
  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    textarea.classList.remove("contextarea-dragover");
  }

  /**
   * Handle drop event
   * @param {Event} e - Drop event
   */
  async function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    textarea.classList.remove("contextarea-dragover");

    // Regular drop if Shift key is pressed
    if (e.shiftKey) return;

    const items = e.dataTransfer.items;
    const files = e.dataTransfer.files;

    if (files.length > 0) {
      await handleFiles(Array.from(files));
    }
  }

  /**
   * Handle file selection from file input
   * @param {Event} e - Change event from file input
   */
  async function handleFileSelect(e) {
    if (e.target.files.length > 0) {
      await handleFiles(Array.from(e.target.files));
      // Reset file input to allow selecting the same file again
      e.target.value = "";
    }
  }

  /**
   * Process multiple files for upload
   * @param {File[]} files - Array of files to process
   */
  async function handleFiles(files) {
    const cursorPosition = textarea.selectionStart;
    let insertedText = "";

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const url = await uploadFile(file);

      if (url) {
        // Add a newline between URLs if there are multiple
        if (i > 0) insertedText += "\n";
        insertedText += url;
      }
    }

    if (insertedText) {
      // Insert at cursor position
      const beforeText = textarea.value.substring(0, cursorPosition);
      const afterText = textarea.value.substring(cursorPosition);

      textarea.value = beforeText + insertedText + afterText;

      // Set cursor position after inserted text
      const newPosition = cursorPosition + insertedText.length;
      textarea.setSelectionRange(newPosition, newPosition);

      // Trigger input event to process URLs
      textarea.dispatchEvent(new Event("input"));
    }
  }

  /**
   * Upload a file to the pastebin service
   * @param {File} file - File to upload
   * @returns {Promise<string>} URL of the uploaded content
   */
  async function uploadFile(file) {
    try {
      const response = await fetch("https://pastebin.contextarea.com/", {
        method: "POST",
        body: file,
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      return await response.text();
    } catch (error) {
      console.error("Error uploading file:", error);
      return null;
    }
  }

  /**
   * Upload text content to the pastebin service
   * @param {string} content - Text content to upload
   * @param {string} contentType - MIME type of the content
   */
  async function uploadContent(content, contentType = "text/plain") {
    try {
      const cursorPosition = textarea.selectionStart;

      const response = await fetch("https://pastebin.contextarea.com/", {
        method: "POST",
        body: content,
        headers: {
          "Content-Type": contentType,
        },
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      const url = await response.text();

      // Insert the URL at cursor position
      const beforeText = textarea.value.substring(0, cursorPosition);
      const afterText = textarea.value.substring(cursorPosition);

      textarea.value = beforeText + url + afterText;

      // Set cursor position after inserted URL
      const newPosition = cursorPosition + url.length;
      textarea.setSelectionRange(newPosition, newPosition);

      // Trigger input event to process URLs
      textarea.dispatchEvent(new Event("input"));
    } catch (error) {
      console.error("Error uploading content:", error);
    }
  }

  /**
   * Process URLs in the textarea and create context cards
   */
  function processUrlsInTextarea() {
    const text = textarea.value;
    const urls = [...new Set(text.match(urlPattern) || [])];

    // Track existing cards to update or remove
    const existingCards = new Map();
    Array.from(cardsContainer.children).forEach((card) => {
      existingCards.set(card.dataset.url, card);
    });

    // Process each URL
    urls.forEach(async (url) => {
      // Skip if card already exists
      if (existingCards.has(url)) {
        existingCards.delete(url); // Remove from tracking map to keep it
        return;
      }

      // Create and add new card
      const card = createContextCard(url);
      cardsContainer.appendChild(card);

      // Fetch context data for the URL
      await fetchAndUpdateContext(url, card);
    });

    // Remove cards for URLs that are no longer in the textarea
    existingCards.forEach((card) => {
      cardsContainer.removeChild(card);
    });
  }

  /**
   * Create a context card for a URL
   * @param {string} url - URL to create card for
   * @returns {HTMLElement} Created card element
   */
  function createContextCard(url) {
    const card = document.createElement("div");
    card.className = "contextarea-card";
    card.dataset.url = url;

    const image = document.createElement("div");
    image.className = "contextarea-card-image";

    const content = document.createElement("div");
    content.className = "contextarea-card-content";

    const urlLine = document.createElement("div");
    urlLine.className = "contextarea-card-url";
    urlLine.textContent = url;

    const infoLine = document.createElement("div");
    infoLine.className = "contextarea-card-info";
    infoLine.textContent = "Loading...";

    content.appendChild(urlLine);
    content.appendChild(infoLine);

    card.appendChild(image);
    card.appendChild(content);

    return card;
  }

  /**
   * Fetch context data for a URL and update its card
   * @param {string} url - URL to fetch context for
   * @param {HTMLElement} card - Card element to update
   */
  async function fetchAndUpdateContext(url, card) {
    try {
      // Use cached data if available
      if (contextCache.has(url)) {
        updateCardWithContext(card, contextCache.get(url));
        return;
      }

      // Fetch context data
      const response = await fetch(
        `https://context.contextarea.com/?url=${encodeURIComponent(url)}`,
      );

      if (!response.ok) {
        throw new Error(`Context fetch failed: ${response.status}`);
      }

      const contextData = await response.json();

      // Cache the result
      contextCache.set(url, contextData);

      // Update the card
      updateCardWithContext(card, contextData);
    } catch (error) {
      console.error("Error fetching context:", error);
      updateCardWithError(card);
    }
  }

  /**
   * Update a context card with fetched data
   * @param {HTMLElement} card - Card element to update
   * @param {Object} data - Context data
   */
  function updateCardWithContext(card, data) {
    // Update image
    const imageDiv = card.querySelector(".contextarea-card-image");
    if (data.ogImageUrl) {
      imageDiv.style.backgroundImage = `url(${data.ogImageUrl})`;
    } else {
      // Use icon based on content type
      imageDiv.innerHTML = getIconForType(data.type);
    }

    // Update info line
    const infoLine = card.querySelector(".contextarea-card-info");
    infoLine.innerHTML = "";

    if (data.title) {
      const titleSpan = document.createElement("span");
      titleSpan.className = "contextarea-card-title";
      titleSpan.textContent = data.title;
      infoLine.appendChild(titleSpan);
    }

    if (data.type) {
      const typeSpan = document.createElement("span");
      typeSpan.className = "contextarea-card-type";
      typeSpan.textContent = data.type;
      infoLine.appendChild(typeSpan);
    }

    if (data.tokens) {
      const tokensSpan = document.createElement("span");
      tokensSpan.className = "contextarea-card-tokens";
      tokensSpan.textContent = `${data.tokens} tokens`;
      infoLine.appendChild(tokensSpan);
    }
  }

  /**
   * Update a context card with error state
   * @param {HTMLElement} card - Card element to update
   */
  function updateCardWithError(card) {
    const imageDiv = card.querySelector(".contextarea-card-image");
    imageDiv.innerHTML = `
            <svg viewBox="0 0 24 24" width="24" height="24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
        `;

    const infoLine = card.querySelector(".contextarea-card-info");
    infoLine.textContent = "Unable to load context";
  }

  /**
   * Get an icon SVG based on content type
   * @param {string} type - Content type
   * @returns {string} SVG markup
   */
  function getIconForType(type) {
    switch (type) {
      case "image":
        return `
                    <svg viewBox="0 0 24 24" width="24" height="24">
                        <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                    </svg>
                `;
      case "video":
        return `
                    <svg viewBox="0 0 24 24" width="24" height="24">
                        <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                    </svg>
                `;
      default:
        return `
                    <svg viewBox="0 0 24 24" width="24" height="24">
                        <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                    </svg>
                `;
    }
  }

  /**
   * Check if a string is a URL
   * @param {string} text - Text to check
   * @returns {boolean} True if text is a URL
   */
  function isUrl(text) {
    return urlPattern.test(text);
  }
})();
