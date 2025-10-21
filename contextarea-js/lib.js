/**
 * ContextArea Library
 * Enhances textareas with smart paste handling, file uploads, and URL context analysis
 * @author Jan Wilmake
 * @version 1.0.0
 */

(function () {
  "use strict";

  // Configuration
  const CONFIG = {
    pasteApiUrl: "https://pastebin.contextarea.com",
    contextApiUrl: "https://context.contextarea.com",
    regularPasteThreshold: 1000, // character count
    debounceDelay: 1000, // ms
  };

  // Cache for context API results
  const contextCache = new Map();

  // Initialize when DOM is fully loaded
  document.addEventListener("DOMContentLoaded", () => {
    const textareas = document.querySelectorAll("textarea#contextarea");
    textareas.forEach(initializeContextArea);
  });

  /**
   * Initialize a textarea with ContextArea functionality
   * @param {HTMLTextAreaElement} textarea - The textarea element to enhance
   */
  function initializeContextArea(textarea) {
    // Create container for the entire component
    const container = document.createElement("div");
    container.className = "contextarea-container";
    textarea.parentNode.insertBefore(container, textarea);
    container.appendChild(textarea);

    // Create context list container
    const contextList = document.createElement("div");
    contextList.className = "contextarea-context-list";
    container.appendChild(contextList);

    // Create upload button
    const uploadButton = document.createElement("button");
    uploadButton.setAttribute("type", "button");
    uploadButton.className = "contextarea-upload-btn";
    uploadButton.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>';
    uploadButton.title = "Upload files";
    container.appendChild(uploadButton);

    // Create hidden file input
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.multiple = true;
    fileInput.className = "contextarea-file-input";
    container.appendChild(fileInput);

    // Set up event listeners
    textarea.addEventListener("paste", handlePaste);
    textarea.addEventListener(
      "input",
      debounce(updateContextList, CONFIG.debounceDelay)
    );
    textarea.addEventListener("dragover", handleDragOver);
    textarea.addEventListener("dragleave", handleDragLeave);
    textarea.addEventListener("drop", handleDrop);
    uploadButton.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", handleFileSelect);

    // Initial context scan
    updateContextList({ target: textarea });
  }

  /**
   * Handle paste events in the textarea
   * @param {ClipboardEvent} event - The paste event
   */
  function handlePaste(event) {
    const textarea = event.target;
    const shiftHeld = event.shiftKey;

    // If shift is held, allow normal paste behavior
    if (shiftHeld) {
      return;
    }

    // Get clipboard data
    if (event.clipboardData && event.clipboardData.getData) {
      const text = event.clipboardData.getData("text/plain");

      // Check if text is a URL or short enough for regular paste
      if (isUrl(text.trim()) || text.length <= CONFIG.regularPasteThreshold) {
        return; // Allow regular paste
      }

      // Prevent default paste and handle with pastebin
      event.preventDefault();
      sendToPastebin(text)
        .then((url) => {
          // Insert the URL at current cursor position
          const startPos = textarea.selectionStart;
          const endPos = textarea.selectionEnd;
          const textBefore = textarea.value.substring(0, startPos);
          const textAfter = textarea.value.substring(endPos);

          textarea.value = textBefore + url + textAfter;

          // Set cursor position after the inserted URL
          textarea.selectionStart = textarea.selectionEnd =
            startPos + url.length;

          // Trigger input event to update context list
          textarea.dispatchEvent(new Event("input"));
        })
        .catch((error) => {
          console.error("Error creating paste:", error);
          alert(
            "Failed to create paste. The original text will be pasted instead."
          );
          textarea.setRangeText(
            text,
            textarea.selectionStart,
            textarea.selectionEnd,
            "end"
          );
        });
    }
  }

  /**
   * Handle drag over events
   * @param {DragEvent} event - The drag event
   */
  function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    event.target.classList.add("contextarea-dragover");
  }

  /**
   * Handle drag leave events
   * @param {DragEvent} event - The drag event
   */
  function handleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();
    event.target.classList.remove("contextarea-dragover");
  }

  /**
   * Handle drop events
   * @param {DragEvent} event - The drop event
   */
  function handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();

    const textarea = event.target;
    textarea.classList.remove("contextarea-dragover");

    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      handleFiles(event.dataTransfer.files, textarea);
    } else if (event.dataTransfer.getData("text")) {
      // Allow normal text drop
      const text = event.dataTransfer.getData("text");
      const startPos = textarea.selectionStart;
      textarea.setRangeText(
        text,
        textarea.selectionStart,
        textarea.selectionEnd,
        "end"
      );
      textarea.dispatchEvent(new Event("input"));
    }
  }

  /**
   * Handle file select from the file input
   * @param {Event} event - The change event
   */
  function handleFileSelect(event) {
    const files = event.target.files;
    if (files && files.length > 0) {
      const textarea = event.target.parentNode.querySelector(
        "textarea#contextarea"
      );
      handleFiles(files, textarea);
    }
    // Reset file input so the same file can be selected again
    event.target.value = "";
  }

  /**
   * Process dropped or selected files
   * @param {FileList} files - The files to process
   * @param {HTMLTextAreaElement} textarea - The textarea to update
   */
  function handleFiles(files, textarea) {
    // Process each file
    Array.from(files).forEach((file) => {
      const reader = new FileReader();

      if (file.type.startsWith("text/")) {
        // Handle text files
        reader.onload = function (e) {
          const text = e.target.result;
          if (text.length <= CONFIG.regularPasteThreshold) {
            insertTextAtCursor(textarea, text);
          } else {
            sendToPastebin(text)
              .then((url) => {
                insertTextAtCursor(textarea, url);
              })
              .catch((error) => {
                console.error("Error creating paste for file:", error);
                alert(
                  `Failed to upload ${file.name}. Inserting file name instead.`
                );
                insertTextAtCursor(textarea, file.name);
              });
          }
        };
        reader.readAsText(file);
      } else {
        // Handle binary files
        reader.onload = function (e) {
          const blob = new Blob([e.target.result], { type: file.type });
          sendBlobToPastebin(blob, file.name)
            .then((url) => {
              insertTextAtCursor(textarea, url);
            })
            .catch((error) => {
              console.error("Error uploading file:", error);
              alert(
                `Failed to upload ${file.name}. Inserting file name instead.`
              );
              insertTextAtCursor(textarea, file.name);
            });
        };
        reader.readAsArrayBuffer(file);
      }
    });
  }

  /**
   * Insert text at the current cursor position in textarea
   * @param {HTMLTextAreaElement} textarea - The textarea element
   * @param {string} text - The text to insert
   */
  function insertTextAtCursor(textarea, text) {
    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;
    const textBefore = textarea.value.substring(0, startPos);
    const textAfter = textarea.value.substring(endPos);

    textarea.value = textBefore + text + textAfter;
    textarea.selectionStart = textarea.selectionEnd = startPos + text.length;
    textarea.dispatchEvent(new Event("input"));
  }

  /**
   * Update the context list based on URLs in the textarea
   * @param {Event} event - The input event
   */
  function updateContextList(event) {
    const textarea = event.target;
    const contextList = textarea.parentNode.querySelector(
      ".contextarea-context-list"
    );

    // Extract URLs from textarea
    const urls = extractUrls(textarea.value);

    // Keep track of processed URLs for this update
    const processedUrls = new Set();

    // Process each URL
    urls.forEach((url) => {
      processedUrls.add(url);

      // Check if we already have this URL in the list
      const existingItem = contextList.querySelector(
        `[data-url="${encodeURIComponent(url)}"]`
      );

      if (!existingItem) {
        // Create a new context item if it doesn't exist
        const contextItem = document.createElement("div");
        contextItem.className = "contextarea-context-item";
        contextItem.dataset.url = encodeURIComponent(url);
        contextItem.innerHTML = `
                    <div class="contextarea-context-img"><div class="contextarea-context-placeholder"></div></div>
                    <div class="contextarea-context-info">
                        <a href="${url}" target="_blank" class="contextarea-context-url">${truncateMiddle(
          url,
          50
        )}</a>
                        <div class="contextarea-context-details">Loading...</div>
                    </div>
                `;
        contextList.appendChild(contextItem);

        // Fetch context data for the URL
        fetchContext(url)
          .then((data) => {
            updateContextItem(contextItem, data);
          })
          .catch((error) => {
            console.error("Error fetching context for URL:", url, error);
            contextItem.querySelector(
              ".contextarea-context-details"
            ).textContent = "Failed to load context";
          });
      }
    });

    // Remove items for URLs that are no longer in the textarea
    Array.from(contextList.children).forEach((item) => {
      const itemUrl = decodeURIComponent(item.dataset.url);
      if (!processedUrls.has(itemUrl)) {
        contextList.removeChild(item);
      }
    });
  }

  /**
   * Update a context item with fetched data
   * @param {HTMLElement} contextItem - The context item element
   * @param {Object} data - The context data
   */
  function updateContextItem(contextItem, data) {
    const imgContainer = contextItem.querySelector(".contextarea-context-img");
    const detailsElement = contextItem.querySelector(
      ".contextarea-context-details"
    );

    // Update image if available
    if (data.ogImageUrl) {
      imgContainer.innerHTML = `<img src="${data.ogImageUrl}" alt="Preview">`;
    } else {
      // Set content type icon if no image
      const iconClass = getIconClassForType(data.type);
      imgContainer.innerHTML = `<div class="contextarea-context-icon ${iconClass}"></div>`;
    }

    // Update details
    let details = data.title || "Untitled";

    if (data.type) {
      details += ` • ${capitalizeFirstLetter(data.type)}`;
    }

    if (data.tokens) {
      details += ` • ${data.tokens} tokens`;
    }

    detailsElement.textContent = details;
  }

  /**
   * Send text to the pastebin API
   * @param {string} text - The text to send
   * @returns {Promise<string>} - A promise that resolves to the pastebin URL
   */
  function sendToPastebin(text) {
    return fetch(CONFIG.pasteApiUrl, {
      method: "POST",
      body: text,
      headers: {
        "Content-Type": "text/plain;charset=utf8",
      },
    }).then((response) => {
      if (!response.ok) {
        throw new Error(`Pastebin API error: ${response.status}`);
      }
      return response.text();
    });
  }

  /**
   * Send a binary blob to the pastebin API
   * @param {Blob} blob - The blob to send
   * @param {string} filename - The name of the file
   * @returns {Promise<string>} - A promise that resolves to the pastebin URL
   */
  function sendBlobToPastebin(blob, filename) {
    return fetch(CONFIG.pasteApiUrl, {
      method: "POST",
      body: blob,
      headers: {
        "Content-Type": blob.type,
        "X-Filename": filename,
      },
    }).then((response) => {
      if (!response.ok) {
        throw new Error(`Pastebin API error: ${response.status}`);
      }
      return response.text();
    });
  }

  /**
   * Fetch context information for a URL
   * @param {string} url - The URL to get context for
   * @returns {Promise<Object>} - A promise that resolves to the context data
   */
  function fetchContext(url) {
    // Check cache first
    if (contextCache.has(url)) {
      return Promise.resolve(contextCache.get(url));
    }

    // Fetch from API if not in cache
    return fetch(`${CONFIG.contextApiUrl}?url=${encodeURIComponent(url)}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Context API error: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        // Cache the result
        contextCache.set(url, data);
        return data;
      });
  }

  /**
   * Extract URLs from text
   * @param {string} text - The text to extract URLs from
   * @returns {string[]} - Array of extracted URLs
   */
  function extractUrls(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = text.match(urlRegex);
    return matches ? Array.from(new Set(matches)) : [];
  }

  /**
   * Check if a string is a URL
   * @param {string} text - The text to check
   * @returns {boolean} - True if the text is a URL
   */
  function isUrl(text) {
    try {
      new URL(text);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Truncate a string in the middle
   * @param {string} str - The string to truncate
   * @param {number} maxLength - The maximum length
   * @returns {string} - The truncated string
   */
  function truncateMiddle(str, maxLength) {
    if (str.length <= maxLength) return str;
    const ellipsis = "...";
    const charsToShow = maxLength - ellipsis.length;
    const frontChars = Math.ceil(charsToShow / 2);
    const backChars = Math.floor(charsToShow / 2);
    return (
      str.substring(0, frontChars) +
      ellipsis +
      str.substring(str.length - backChars)
    );
  }

  /**
   * Capitalize the first letter of a string
   * @param {string} string - The string to capitalize
   * @returns {string} - The capitalized string
   */
  function capitalizeFirstLetter(string) {
    if (!string) return "";
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  /**
   * Get icon class for content type
   * @param {string} type - The content type
   * @returns {string} - CSS class for the icon
   */
  function getIconClassForType(type) {
    switch (type) {
      case "image":
        return "contextarea-icon-image";
      case "video":
        return "contextarea-icon-video";
      default:
        return "contextarea-icon-text";
    }
  }

  /**
   * Debounce function to limit function calls
   * @param {Function} func - The function to debounce
   * @param {number} wait - The debounce delay in milliseconds
   * @returns {Function} - The debounced function
   */
  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }
})();
