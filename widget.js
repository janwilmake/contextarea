(function () {
  // Widget class to handle initialization and rendering
  class LmpifyWidget {
    constructor(targetElement, options = {}) {
      this.targetElement = targetElement;
      this.options = {
        width: options.width || "100%",
        height: options.height || "auto",
        theme: options.theme || "dark",
        defaultModel: options.defaultModel || "gpt-4.1-mini",
        placeholder: options.placeholder || "Type your prompt...",
        ...options,
      };

      this.init();
    }

    init() {
      // Create and inject styles
      this.injectStyles();

      // Load the model-modal.js script
      // Render the widget after model modal script is loaded
      this.render();

      // Initialize event listeners
      this.setupEventListeners();
    }

    injectStyles() {
      // Only inject styles once
      if (document.getElementById("lmpify-styles")) return;

      const styleEl = document.createElement("style");
      styleEl.id = "lmpify-styles";
      styleEl.textContent = `
          .lmpify-container * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          .lmpify-container {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background-color: #2a2a2a;
            color: #e5e5e5;
            border-radius: 12px;
            overflow: hidden;
            width: 100%;
            max-width: 700px;
            margin: 0 auto;
          }
          
          .lmpify-header {
            display: flex;
            align-items: center;
            padding: 12px 16px;
            border-bottom: 1px solid #4a4a4a;
          }
          
          .lmpify-logo {
            display: flex;
            align-items: center;
            text-decoration: none;
            color: #e5e5e5;
            font-weight: 300;
            font-size: 16px;
          }
          
          .lmpify-logo img {
            width: 24px;
            height: 24px;
            margin-right: 8px;
          }
          
          .lmpify-form-container {
            padding: 16px;
            position: relative;
          }
          
          .lmpify-textarea-wrapper {
            position: relative;
            width: 100%;
          }
          
          .lmpify-textarea {
            width: 100%;
            background-color: #3a3a3a;
            border: 1px solid #4a4a4a;
            border-radius: 12px;
            color: #e5e5e5;
            font-size: 16px;
            padding: 16px;
            padding-bottom: 50px;
            resize: none;
            outline: none;
            font-family: inherit;
            line-height: 1.5;
            min-height: 120px;
            max-height: 300px;
            overflow-y: auto;
            transition: border-color 0.2s ease;
          }
          
          .lmpify-textarea:focus {
            border-color: #6a6a6a;
          }
          
          .lmpify-textarea::placeholder {
            color: #8a8a8a;
          }
          
          .lmpify-button-container {
            position: absolute;
            bottom: 12px;
            right: 12px;
            display: flex;
            gap: 8px;
            align-items: center;
          }
          
          .lmpify-left-button-container {
            position: absolute;
            bottom: 12px;
            left: 12px;
            display: flex;
            gap: 8px;
            align-items: center;
          }
          
          .lmpify-submit-button {
            background-color: #e5e5e5;
            color: #2a2a2a;
            font-weight: 500;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 14px;
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 4px;
            transition: background-color 0.2s ease;
          }
          
          .lmpify-submit-button:hover {
            background-color: #d5d5d5;
          }
          
          .lmpify-submit-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          
          .lmpify-icon-button {
            background-color: transparent;
            border: 0.5px solid #e5e5e575;
            cursor: pointer;
            padding: 8px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background-color 0.2s ease;
          }
          
          .lmpify-icon-button:hover {
            background-color: #4a4a4a;
          }
          
          .lmpify-icon-button svg {
            width: 16px;
            height: 16px;
            stroke: #e5e5e5;
            fill: none;
          }
          
          .lmpify-footer {
            padding: 10px 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-top: 1px solid #4a4a4a;
            font-size: 12px;
            color: #8a8a8a;
          }
          
          .lmpify-footer a {
            color: #a5a5a5;
            text-decoration: none;
          }
          
          .lmpify-footer a:hover {
            text-decoration: underline;
          }
          
          /* Scrollbar styling */
          .lmpify-textarea::-webkit-scrollbar {
            width: 8px;
          }
          
          .lmpify-textarea::-webkit-scrollbar-track {
            background: transparent;
          }
          
          .lmpify-textarea::-webkit-scrollbar-thumb {
            background-color: #5a5a5a;
            border-radius: 4px;
          }
          
          .lmpify-textarea::-webkit-scrollbar-thumb:hover {
            background-color: #6a6a6a;
          }
          
          /* Light theme */
          .lmpify-container.light-theme {
            background-color: #f5f5f5;
            color: #333333;
          }
          
          .lmpify-container.light-theme .lmpify-header {
            border-bottom: 1px solid #e0e0e0;
          }
          
          .lmpify-container.light-theme .lmpify-logo {
            color: #333333;
          }
          
          .lmpify-container.light-theme .lmpify-textarea {
            background-color: #ffffff;
            border: 1px solid #e0e0e0;
            color: #333333;
          }
          
          .lmpify-container.light-theme .lmpify-textarea::placeholder {
            color: #999999;
          }
          
          .lmpify-container.light-theme .lmpify-submit-button {
            background-color: #333333;
            color: #ffffff;
          }
          
          .lmpify-container.light-theme .lmpify-submit-button:hover {
            background-color: #555555;
          }
          
          .lmpify-container.light-theme .lmpify-icon-button {
            border: 0.5px solid #33333375;
          }
          
          .lmpify-container.light-theme .lmpify-icon-button svg {
            stroke: #333333;
          }
          
          .lmpify-container.light-theme .lmpify-footer {
            border-top: 1px solid #e0e0e0;
            color: #999999;
          }
          
          .lmpify-container.light-theme .lmpify-footer a {
            color: #666666;
          }
          
          /* Mobile responsive */
          @media (max-width: 768px) {
            .lmpify-container {
              border-radius: 8px;
            }
            
            .lmpify-header {
              padding: 10px 12px;
            }
            
            .lmpify-form-container {
              padding: 12px;
            }
            
            .lmpify-textarea {
              font-size: 14px;
              padding: 12px;
              padding-bottom: 50px;
              min-height: 100px;
            }
            
            .lmpify-submit-button {
              padding: 6px 12px;
              font-size: 13px;
            }
            
            .lmpify-icon-button {
              padding: 6px;
            }
          }
        `;

      document.head.appendChild(styleEl);
    }

    render() {
      // Create the widget container
      const container = document.createElement("div");
      container.className = `lmpify-container ${
        this.options.theme === "light" ? "light-theme" : ""
      }`;
      container.style.width = this.options.width;
      container.style.height = this.options.height;

      // Create the header
      const header = document.createElement("div");
      header.className = "lmpify-header";

      const logo = document.createElement("a");
      logo.className = "lmpify-logo";
      logo.href = "https://lmpify.com";
      logo.target = "_blank";
      logo.innerHTML = `
          <img src="https://lmpify.com/android-chrome-192x192.png" alt="lmpify logo" />
          <span>let me prompt it for you</span>
        `;

      header.appendChild(logo);

      // Create the form container
      const formContainer = document.createElement("div");
      formContainer.className = "lmpify-form-container";

      const textareaWrapper = document.createElement("div");
      textareaWrapper.className = "lmpify-textarea-wrapper";

      const leftButtonContainer = document.createElement("div");
      leftButtonContainer.className = "lmpify-left-button-container";

      // Create model selector container
      const modelSelectorContainer = document.createElement("div");
      modelSelectorContainer.id = "model-modal";

      leftButtonContainer.appendChild(modelSelectorContainer);

      // Create the textarea
      const textarea = document.createElement("textarea");
      textarea.className = "lmpify-textarea";
      textarea.placeholder = this.options.placeholder;
      textarea.rows = 3;

      // Create the button container
      const buttonContainer = document.createElement("div");
      buttonContainer.className = "lmpify-button-container";

      const submitButton = document.createElement("button");
      submitButton.className = "lmpify-submit-button";
      submitButton.type = "button";
      submitButton.disabled = true;
      submitButton.innerHTML = `
          <span>Submit</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M7 11l5-5 5 5M12 6v12"></path>
          </svg>
        `;

      buttonContainer.appendChild(submitButton);

      textareaWrapper.appendChild(leftButtonContainer);
      textareaWrapper.appendChild(textarea);
      textareaWrapper.appendChild(buttonContainer);

      formContainer.appendChild(textareaWrapper);

      // Create the footer
      const footer = document.createElement("div");
      footer.className = "lmpify-footer";
      footer.innerHTML = `
          <div>Powered by <a href="https://lmpify.com" target="_blank">lmpify.com</a></div>
          <div><a href="https://lmpify.com/privacy" target="_blank">Privacy Policy</a></div>
        `;

      // Assemble the widget
      container.appendChild(header);
      container.appendChild(formContainer);
      container.appendChild(footer);

      // Clear and append to target element
      this.targetElement.innerHTML = "";
      this.targetElement.appendChild(container);

      // Save references to elements
      this.elements = {
        container,
        textarea,
        submitButton,
        modelSelectorContainer,
      };
    }

    setupEventListeners() {
      const { textarea, submitButton } = this.elements;

      // Auto-resize textarea
      const adjustTextareaHeight = () => {
        textarea.style.height = "auto";
        textarea.style.height = Math.min(textarea.scrollHeight, 300) + "px";

        // Enable/disable submit button based on content
        submitButton.disabled = textarea.value.trim() === "";
      };

      textarea.addEventListener("input", adjustTextareaHeight);

      // Handle shift+enter for newline, enter for submit
      textarea.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          if (textarea.value.trim()) {
            submitButton.click();
          }
        }
      });

      // Submit button click
      submitButton.addEventListener("click", () => {
        this.handleSubmit();
      });
    }

    // Slugify function
    slugify(text) {
      return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
    }

    // Simple hash function for 7-character SHA-like string
    simpleHash(str) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
      }
      return Math.abs(hash).toString(36).substring(0, 7).padEnd(7, "0");
    }

    handleSubmit() {
      const { textarea } = this.elements;
      const promptText = textarea.value.trim();

      if (!promptText) return;

      // Generate slug from first 20 characters
      const first20 = promptText.substring(0, 20);
      const slug = this.slugify(first20);
      const hash = this.simpleHash(promptText);

      // Create the URL path
      const path = `/${slug}-${hash}`;

      // Get selected model from the modal
      const modelId = this.options.defaultModel;

      // Create form data
      const formData = new FormData();
      formData.append("prompt", promptText);
      formData.append("model", modelId);

      // Create a form and submit it
      const form = document.createElement("form");
      form.method = "POST";
      form.action = `https://lmpify.com${path}`;
      form.target = "_blank";
      form.style.display = "none";

      // Add all form data as hidden inputs
      for (const [key, value] of formData.entries()) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        input.value = value;
        form.appendChild(input);
      }

      document.body.appendChild(form);
      form.submit();

      // Clean up
      setTimeout(() => {
        document.body.removeChild(form);
      }, 100);
    }
  }

  // Initialize the widget when the script loads
  function initializeWidgets() {
    const targetElements = document.querySelectorAll("#lmpify");

    targetElements.forEach((element) => {
      // Get options from data attributes
      const options = {
        width: element.dataset.width,
        height: element.dataset.height,
        theme: element.dataset.theme,
        defaultModel: element.dataset.model,
        placeholder: element.dataset.placeholder,
      };

      // Initialize widget
      new LmpifyWidget(element, options);
    });
  }

  // Check if DOM is already loaded
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeWidgets);
  } else {
    initializeWidgets();
  }

  // Expose the widget class globally
  window.LmpifyWidget = LmpifyWidget;
})();
