// Modal that allows selecting the model and other configuration

(function () {
  // Hardcoded models array
  const serverDataElement = document.getElementById("server-data");

  const data = serverDataElement
    ? JSON.parse(serverDataElement.textContent)
    : {};

  // SVG icons
  const ICONS = {
    vision:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>',
    globe:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
    doc: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
    settings:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6m-3.5-5.5L4 8m12.5 7.5L21 20M1 12h6m6 0h6M4 20l4.5-4.5M16.5 7.5L20 4"/></svg>',
    close:
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    check:
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>',
    search:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    filter:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>',
    lock: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    user: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    logout:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
  };

  // CSS styles
  const STYLES = `
    .model-modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
        transition: opacity 0.3s ease, visibility 0.3s ease;
        
        /* These are crucial for fullscreen behavior */
        width: 100vw;
        height: 100vh;
        margin: 0;
        padding: 0;
    }

    .model-modal-backdrop.active {
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
    }

    .model-modal {
        background-color: var(--bg-secondary);
        color: var(--text-primary);
        width: 90%;
        max-width: 600px;
        max-height: 80vh;
        border-radius: 16px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        box-shadow: 0 20px 60px var(--shadow);
        transform: scale(0.9);
        opacity: 0;
        transition: all 0.3s ease;
        
        /* Ensure modal is centered and doesn't inherit parent constraints */
        position: relative;
        z-index: 10001;
        margin: auto;
    }

    .model-modal-backdrop.active .model-modal {
        transform: scale(1);
        opacity: 1;
    }

    .model-modal-header {
        position: relative;
        padding: 20px;
    }

    .model-modal-close {
        position: absolute;
        top: 16px;
        right: 16px;
        background: transparent;
        border: none;
        padding: 8px;
        cursor: pointer;
        color: var(--text-muted);
        transition: color 0.2s ease;
    }

    .model-modal-close:hover {
        color: var(--text-primary);
    }

    .model-modal-heading {
        font-size: 18px;
        font-weight: 500;
        text-align: center;
        margin: 0;
        color: var(--text-muted);
    }

    .model-modal-search {
        padding: 0 20px 20px;
    }

    .model-modal-search-input {
        width: 100%;
        background-color: var(--bg-primary);
        border: 1px solid var(--border-primary);
        border-radius: 8px;
        color: var(--text-primary);
        font-size: 16px;
        padding: 12px 16px 12px 48px;
        outline: none;
        font-family: inherit;
        transition: border-color 0.2s ease;
    }

    .model-modal-search-input:focus {
        border-color: var(--border-secondary);
    }

    .model-modal-search-icon {
        position: absolute;
        left: 24px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--text-muted);
        pointer-events: none;
    }

    .model-modal-content {
        flex: 1;
        overflow-y: auto;
        padding: 0 20px 20px;
    }

    .model-modal-content::-webkit-scrollbar {
        width: 8px;
    }

    .model-modal-content::-webkit-scrollbar-track {
        background: transparent;
    }

    .model-modal-content::-webkit-scrollbar-thumb {
        background-color: var(--bg-quaternary);
        border-radius: 4px;
    }

    .model-modal-content::-webkit-scrollbar-thumb:hover {
        background-color: var(--border-secondary);
    }

    .model-modal-upgrade {
        background-color: var(--bg-primary);
        border: 1px solid var(--border-primary);
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 20px;
    }

    .model-modal-upgrade-title {
        font-size: 18px;
        font-weight: 500;
        margin-bottom: 8px;
        color: var(--text-primary);
    }

    .model-modal-upgrade-price {
        font-size: 32px;
        font-weight: 300;
        color: var(--accent-primary);
        margin-bottom: 16px;
    }

    .model-modal-upgrade-price span {
        font-size: 18px;
        color: var(--text-primary);
    }

    .model-modal-upgrade-button {
        background-color: var(--accent-primary);
        color: #ffffff;
        border: none;
        border-radius: 8px;
        padding: 10px 24px;
        font-size: 16px;
        font-weight: 500;
        cursor: pointer;
        text-decoration: none;
        display: inline-block;
        transition: background-color 0.2s ease;
    }

    .model-modal-upgrade-button:hover {
        background-color: var(--accent-secondary);
    }

    .model-modal-upgrade-button:disabled {
        background-color: var(--bg-tertiary);
        color: var(--text-muted);
        cursor: not-allowed;
    }

    .model-modal-login-button {
        background-color: #1da1f2;
        color: #ffffff;
        border: none;
        border-radius: 8px;
        padding: 10px 24px;
        font-size: 16px;
        font-weight: 500;
        cursor: pointer;
        text-decoration: none;
        display: inline-block;
        transition: background-color 0.2s ease;
    }

    .model-modal-login-button:hover {
        background-color: #1a91da;
    }

    .model-modal-user-info {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
        padding-bottom: 16px;
        border-bottom: 1px solid var(--border-primary);
    }

    .model-modal-user-avatar {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        object-fit: cover;
    }

    .model-modal-user-details {
        flex: 1;
    }

    .model-modal-user-name {
        font-size: 16px;
        font-weight: 500;
        color: var(--text-primary);
        margin: 0 0 4px 0;
    }

    .model-modal-user-username {
        font-size: 14px;
        color: var(--text-muted);
        margin: 0;
    }

    .model-modal-logout-button {
        background-color: transparent;
        color: var(--text-muted);
        border: 1px solid var(--border-primary);
        border-radius: 8px;
        padding: 6px 12px;
        font-size: 14px;
        cursor: pointer;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s ease;
    }

    .model-modal-logout-button:hover {
        background-color: var(--bg-tertiary);
        color: var(--text-primary);
        border-color: var(--border-secondary);
    }

    .model-modal-list {
        list-style: none;
        padding: 0;
        margin: 0;
    }

    .model-modal-item {
        display: flex;
        align-items: center;
        padding: 16px;
        border-radius: 12px;
        cursor: pointer;
        transition: background-color 0.2s ease;
        position: relative;
    }

    .model-modal-item:hover {
        background-color: var(--bg-tertiary);
    }

    .model-modal-item.selected {
        background-color: var(--bg-tertiary);
    }

    .model-modal-item.disabled {
        cursor: not-allowed;
        opacity: 0.5;
    }

    .model-modal-item.disabled:hover {
        background-color: transparent;
    }

    .model-modal-item-icon {
        font-size: 24px;
        margin-right: 16px;
        width: 32px;
        text-align: center;
    }

    .model-modal-item-info {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .model-modal-item-name {
        font-size: 16px;
        font-weight: 400;
        color: var(--text-primary);
    }

    .model-modal-item-status {
        font-size: 12px;
        color: var(--warning-color);
        background-color: rgba(254, 202, 87, 0.2);
        padding: 2px 8px;
        border-radius: 4px;
    }

    .model-modal-item-premium {
        font-size: 12px;
        color: var(--accent-primary);
        background-color: rgba(255, 136, 0, 0.2);
        padding: 2px 8px;
        border-radius: 4px;
    }

    .model-modal-item-check {
        color: var(--success-color);
        margin-left: auto;
    }

    .model-modal-item-actions {
        display: flex;
        gap: 8px;
        align-items: center;
    }

    .model-modal-item-action {
        background: transparent;
        border: none;
        padding: 4px;
        cursor: pointer;
        color: var(--text-muted);
        transition: color 0.2s ease;
    }

    .model-modal-item-action:hover {
        color: var(--text-primary);
    }

    .model-modal-search-container {
        position: relative;
    }

    /* Button styles for the trigger button */
    .model-modal-trigger {
        background-color: transparent;
        border: 0.5px solid var(--text-muted);
        color: var(--text-primary);
        cursor: pointer;
        padding: 8px 12px;
        border-radius: 8px;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        transition: background-color 0.2s ease;
        font-size: 14px;
        font-family: inherit;
    }

    .model-modal-trigger:hover {
        background-color: var(--bg-tertiary);
    }

    .model-modal-trigger-icon {
        width: 16px;
        height: 16px;
    }

    .model-modal-trigger-text {
        font-weight: 400;
    }

    .model-modal-trigger-tag {
        color: var(--text-muted);
        font-size: 12px;
        margin-left: 4px;
    }

    /* Hide model name on mobile */
    @media (max-width: 768px) {
        .model-modal-trigger-text {
            display: none;
        }
    }
`;

  // Create and inject styles
  function injectStyles() {
    const styleElement = document.createElement("style");
    styleElement.textContent = STYLES;
    document.head.appendChild(styleElement);
  }

  // Create user info section
  function createUserInfoHTML(me) {
    if (!me || Object.keys(me).length === 0) {
      return ``;
    }

    return `
      <div class="model-modal-user-info">
        <img src="${me.profile_image_url}" alt="${me.name}" class="model-modal-user-avatar" />
        <div class="model-modal-user-details">
          <p class="model-modal-user-name">${me.name}</p>
          <p class="model-modal-user-username">@${me.username}</p>
        </div>
        <a href="/logout" class="model-modal-logout-button">
          ${ICONS.logout}
          Logout
        </a>
      </div>
    `;
  }

  // Create modal HTML
  function createModalHTML(models, selectedModelId = null, me) {
    const isLoggedIn = me && Object.keys(me).length > 0;

    const modalHTML = `
              <div class="model-modal-backdrop" id="modelModalBackdrop">
                  <div class="model-modal">
                      <div class="model-modal-header">
                          <button class="model-modal-close" id="modelModalClose">
                              ${ICONS.close}
                          </button>
                          <h2 class="model-modal-heading">Select a model</h2>
                      </div>
                      
                      <div class="model-modal-search">
                          <div class="model-modal-search-container">
                              <div class="model-modal-search-icon">
                                  ${ICONS.search}
                              </div>
                              <input 
                                  type="text" 
                                  class="model-modal-search-input" 
                                  placeholder="Search models..."
                                  id="modelModalSearch"
                              />
                          </div>
                      </div>
  
                      <div class="model-modal-content">
                          <div class="model-modal-upgrade">
                              ${createUserInfoHTML(me)}
                              
                              ${
                                !isLoggedIn
                                  ? `
                                <div class="model-modal-upgrade-title">Login to start using Context Area</div>
                                <div class="model-modal-upgrade-price">Connect with X</div>
                                <a href="/authorize" target="_blank" class="model-modal-login-button">
                                  ${ICONS.user}
                                  Login with X
                                </a>
                              `
                                  : me.balance > 0
                                  ? `
                                <div class="model-modal-upgrade-title">Your balance is $${(
                                  me.balance / 100
                                ).toFixed(2)}.${
                                      me.balance < 100
                                        ? `<p style="color:orange;">Your balance is getting low. To avoid hitting limits, please add more.</p>`
                                        : ""
                                    }</div>
                                <div class="model-modal-upgrade-price"></div>
                                <a href="#" target="_blank" class="model-modal-upgrade-button" id="paymentLink">Add more</a>
                              `
                                  : `
                                ${
                                  data.ratelimited
                                    ? me.balance < 0
                                      ? `<p style="color:red;">You don't have any balance left. Please purchase tokens to continue.</p>`
                                      : `<p style="color:red;">You have been ratelimited! Try again in a bit, or please purchase tokens to continue</p>`
                                    : ""
                                }
                                <div class="model-modal-upgrade-title">Unlock premium models</div>
                                <div class="model-modal-upgrade-price">one-time payment</div>
                                <a href="#" target="_blank" class="model-modal-upgrade-button" id="paymentLink">Pay with Stripe</a>
                              `
                              }
                          </div>
  
                          <ul class="model-modal-list" id="modelModalList">
                              ${models
                                .map((model) =>
                                  createModelItem(model, selectedModelId, me)
                                )
                                .join("")}
                          </ul>
                      </div>
  
                  </div>
              </div>
          `;

    return modalHTML;
  }

  // Create individual model item
  function createModelItem(model, selectedModelId, me) {
    const isSelected = model.model === selectedModelId;
    const isPremium = model.premium === true;
    const isLoggedIn = me && Object.keys(me).length > 0;
    const isDisabled = (!isLoggedIn || me.balance <= 0) && isPremium;
    const features = model.features
      .map((feature) => ICONS[feature] || "")
      .join("");

    return `
              <li class="model-modal-item ${isSelected ? "selected" : ""} ${
      isDisabled ? "disabled" : ""
    }" data-model-id="${model.model}">
                  <div class="model-modal-item-icon"><img src="${
                    model.icon
                  }" width="32" height="32" style="border-radius:16px;" /></div>
                  <div class="model-modal-item-info">
                      <span class="model-modal-item-name">${model.name}</span>
                      ${
                        model.degraded
                          ? '<span class="model-modal-item-status">Degraded</span>'
                          : ""
                      }
                      ${
                        isPremium
                          ? '<span class="model-modal-item-premium">Premium</span>'
                          : ""
                      }
                  </div>
                  ${
                    isSelected
                      ? `<div class="model-modal-item-check">${ICONS.check}</div>`
                      : ""
                  }
                  <div class="model-modal-item-actions">
                      ${features}
                      ${isDisabled ? ICONS.lock : ""}
                  </div>
              </li>
          `;
  }

  // Modal functionality
  class ModelModal {
    constructor(model) {
      this.selectedModelId = model
        ? model
        : typeof window.localStorage.getItem("model") === "string"
        ? window.localStorage.getItem("model")
        : undefined;
      this.modalElement = null;
      this.onSelectCallback = null;
      this.showingAll = false;
      this.me = null;
      this.models = null;
      this.init();
    }

    async init() {
      // Inject styles
      injectStyles();

      // Create container
      const container = document.getElementById("model-modal");

      if (!container) {
        // retry after 100ms
        setTimeout(() => this.init(), 100);
        // console.error("Model modal container not found");
        return;
      }

      const modelsPromise = fetch("/providers.json")
        .then((res) => res.json())
        .then((models) => {
          this.models = models;
          return models;
        });

      const mePromise = fetch("/user")
        .then(async (res) => {
          if (!res.ok) {
            console.log("Not ok", res.status);
            console.log(await res.text());
            return {};
          }
          const json = await res.json();
          return json;
        })
        .then((me) => {
          console.log("set me", me);
          this.me = me;
        });

      await Promise.all([mePromise, modelsPromise]);

      // Create trigger button and modal
      this.createTriggerButton(container);
      this.createModal(container);
      this.attachEventListeners();
    }

    createTriggerButton(container) {
      // Add button styles to existing styles
      const buttonStyle = `
                  .model-modal-trigger {
                      background-color: transparent;
                      border: 0.5px #e5e5e575 solid;
                      color: #e5e5e5;
                      cursor: pointer;
                      padding: 8px 12px;
                      border-radius: 8px;
                      display: inline-flex;
                      align-items: center;
                      gap: 8px;
                      transition: background-color 0.2s ease;
                      font-size: 14px;
                      font-family: inherit;
                  }
  
                  .model-modal-trigger:hover {
                      background-color: #4a4a4a;
                  }
  
                  .model-modal-trigger-icon {
                      width: 16px;
                      height: 16px;
                  }
  
                  .model-modal-trigger-text {
                      font-weight: 400;
                  }
  
                  .model-modal-trigger-tag {
                      color: #8a8a8a;
                      font-size: 12px;
                      margin-left: 4px;
                  }

                  /* Hide model name on mobile */
                  @media (max-width: 768px) {
                      .model-modal-trigger-text {
                          display: none;
                      }
                  }
              `;

      // Add button styles
      const styleElement = document.createElement("style");
      styleElement.textContent = buttonStyle;
      document.head.appendChild(styleElement);

      // Create button
      const selectedModel =
        this.models?.find((m) => m.model === this.selectedModelId) ||
        this.models[0];

      console.log({ selected: this.selectedModelId, models: this.models });

      const button = document.createElement("button");
      button.className = "model-modal-trigger";
      //needed to not submit forms it appears in
      button.setAttribute("type", "button");
      button.innerHTML = `
                  <span class="model-modal-trigger-icon"><img src="${selectedModel.icon}" width="16" height="16"  style="border-radius:8px;" /></span>
                  <span class="model-modal-trigger-text">${selectedModel.name}</span>
                  <span class="model-modal-trigger-tag">AI</span>
              `;
      button.addEventListener("click", () => this.open());
      // Insert button before the modal container
      container.parentNode.insertBefore(button, container);
      this.triggerButton = button;
    }

    createModal(container) {
      // Create modal HTML
      const modalHTML = createModalHTML(
        this.models,
        this.selectedModelId,
        this.me
      );

      // Instead of putting it in the container, append to body
      const modalContainer = document.createElement("div");
      modalContainer.innerHTML = modalHTML;

      // Append to body to ensure it's not constrained by parent containers
      document.body.appendChild(modalContainer.firstElementChild);

      // Set payment link if user is logged in
      const paymentLink = document.getElementById("paymentLink");
      const isLoggedIn = this.me && Object.keys(this.me).length > 0;

      if (paymentLink && isLoggedIn) {
        paymentLink.href = `https://buy.stripe.com/5kAdTEfun4TXaGKeni?client_reference_id=${this.me?.id}`;
      }

      this.modalElement = document.getElementById("modelModalBackdrop");
    }

    attachEventListeners() {
      // Close button
      const closeBtn = document.getElementById("modelModalClose");
      closeBtn.addEventListener("click", () => this.close());

      // Backdrop click
      const backdrop = document.getElementById("modelModalBackdrop");
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) {
          this.close();
        }
      });

      // Model selection
      const modelList = document.getElementById("modelModalList");
      modelList.addEventListener("click", (e) => {
        const modelItem = e.target.closest(".model-modal-item");
        if (modelItem && !modelItem.classList.contains("disabled")) {
          const modelId = modelItem.dataset.modelId;
          this.selectModel(modelId);
        }
      });

      // Search functionality
      const searchInput = document.getElementById("modelModalSearch");
      searchInput.addEventListener("input", (e) => {
        this.filterModels(e.target.value);
      });

      // Escape key
      document.addEventListener("keydown", (e) => {
        if (
          e.key === "Escape" &&
          this.modalElement &&
          this.modalElement.classList.contains("active")
        ) {
          this.close();
        }
      });
    }

    selectModel(modelId) {
      const model = this.models?.find((m) => m.model === modelId);
      const isLoggedIn = this.me && Object.keys(this.me).length > 0;

      // Don't select if it's a premium model and user is not logged in or has no balance
      if (model.premium && (!isLoggedIn || this.me.balance <= 0)) {
        return;
      }

      this.selectedModelId = modelId;

      window.localStorage.setItem("model", modelId);

      // Update UI
      document.querySelectorAll(".model-modal-item").forEach((item) => {
        item.classList.remove("selected");
        const checkIcon = item.querySelector(".model-modal-item-check");
        if (checkIcon) checkIcon.remove();
      });

      const selectedItem = document.querySelector(
        `[data-model-id="${modelId}"]`
      );
      if (selectedItem) {
        selectedItem.classList.add("selected");
        // Add check icon
        const checkDiv = document.createElement("div");
        checkDiv.className = "model-modal-item-check";
        checkDiv.innerHTML = ICONS.check;
        selectedItem.insertBefore(
          checkDiv,
          selectedItem.querySelector(".model-modal-item-actions")
        );
      }

      // Update footer text
      const selectedName = document.getElementById("modelModalSelectedName");

      if (selectedName) {
        selectedName.textContent = model.name;
      }

      // Update trigger button
      if (this.triggerButton) {
        this.triggerButton.innerHTML = `
                      <span class="model-modal-trigger-icon"><img src="${model.icon}" width="16" height="16" style="border-radius:8px;" /></span>
                      <span class="model-modal-trigger-text">${model.name}</span>
                      <span class="model-modal-trigger-tag">AI</span>
                  `;
      }

      // Callback
      if (this.onSelectCallback) {
        this.onSelectCallback(model);
      }

      // Close modal
      setTimeout(() => this.close(), 200);
    }

    filterModels(query) {
      const lowerQuery = query.toLowerCase();
      const items = document.querySelectorAll(".model-modal-item");

      items.forEach((item) => {
        const modelId = item.dataset.modelId;
        const model = this.models.find((m) => m.model === modelId);
        const matches =
          model.name.toLowerCase().includes(lowerQuery) ||
          model.model.toLowerCase().includes(lowerQuery);

        item.style.display = matches ? "flex" : "none";
      });
    }

    open(onSelect) {
      this.onSelectCallback = onSelect;
      this.modalElement.classList.add("active");
      document.body.style.overflow = "hidden";
    }

    close() {
      this.modalElement.classList.remove("active");
      document.body.style.overflow = "";
    }

    destroy() {
      if (this.modalElement && this.modalElement.parentNode) {
        this.modalElement.parentNode.removeChild(this.modalElement);
      }
    }
  }

  // Initialize and expose to global scope
  window.modelModal = new ModelModal(data.model);

  // Public API
  window.openModelModal = function (onSelect) {
    window.modelModal.open(onSelect);
  };

  window.closeModelModal = function () {
    window.modelModal.close();
  };
})();
