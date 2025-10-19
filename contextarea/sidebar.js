(function () {
  function goBackWithFallback(url) {
    const currentUrl = window.location.href;

    // Set a timeout to check if navigation happened
    const timeoutId = setTimeout(() => {
      // If we're still on the same page after timeout
      if (window.location.href === currentUrl) {
        console.log("Back navigation failed or no history");
        // Do your fallback action here
        window.location.href = url;
        // or window.close();
        // or redirect somewhere else
      }
    }, 200);

    // Listen for page changes
    const cleanup = () => clearTimeout(timeoutId);
    window.addEventListener("beforeunload", cleanup, { once: true });

    // Attempt to go back
    window.history.back();
  }

  // Create the sidebar
  const sidebar = document.createElement("div");
  sidebar.id = "discord-sidebar";

  // Check if mobile
  const isMobile = window.innerWidth <= 768;

  // Sidebar styles - different for mobile and desktop
  const sidebarStyles = isMobile
    ? `
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100vw;
    height: 72px;
    background-color: #202225;
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 0 12px;
    box-sizing: border-box;
    z-index: 10000;
    overflow-x: auto;
    overflow-y: hidden;
    gap: 8px;
    -webkit-overflow-scrolling: touch;
  `
    : `
    position: fixed;
    top: 0;
    left: 0;
    width: 72px;
    height: 100vh;
    background-color: #202225;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 12px 0;
    box-sizing: border-box;
    z-index: 10000;
    overflow-y: auto;
    gap: 8px;
  `;

  // Apply styles to sidebar
  Object.assign(
    sidebar.style,
    Object.fromEntries(
      sidebarStyles
        .split(";")
        .map((s) => s.trim().split(":"))
        .filter((s) => s.length === 2),
    ),
  );

  // Website data with their respective URLs and logo URLs
  const websites = [
    {
      name: "XYText",
      url: "https://letmeprompt.com/notes", // "https://xytext.com/:user/context",
      logo: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiByeD0iOCIgZmlsbD0iI2ZkN2QzNCIvPgo8cGF0aCBkPSJNOCAxMEgzMlYzMkg4VjEwWiIgZmlsbD0iI0ZGRjNBMCIvPgo8cGF0aCBkPSJNOSAzMUgzMVYzM0g5VjMxWiIgZmlsbD0iI2ZkN2QzNCIvPgo8cGF0aCBkPSJNMTIgMTRIMjhWMTZIMTJWMTRaIiBmaWxsPSIjRUY0NDQ0Ii8+CjxwYXRoIGQ9Ik0xMiAxOEgyNFYyMEgxMlYxOFoiIGZpbGw9IiNFRjQ0NDQiLz4KPHBhdGggZD0iTTEyIDIySDI2VjI0SDEyVjIyWiIgZmlsbD0iI0VGNDQ0NCIvPgo8cGF0aCBkPSJNMTIgMjZIMjJWMjhIMTJWMjZaIiBmaWxsPSIjRUY0NDQ0Ii8+Cjwvc3ZnPgo=",
    },
    {
      name: "LLMs.txt",
      url: "https://llmstxt.site/",
      logo: "https://raw.githubusercontent.com/AnswerDotAI/llms-txt/refs/heads/main/logo.png",
    },
    {
      name: "XYMake",
      url: "https://xymake.com",
      logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/X_logo.jpg/1024px-X_logo.jpg",
    },
    {
      name: "GitHub",
      url: "https://uithub.com",
      logo: "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png",
    },
    {
      name: "Google",
      url: "https://googllm.com",
      logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_%22G%22_logo.svg/800px-Google_%22G%22_logo.svg.png",
    },
    {
      name: "Cloudflare",
      url: "https://flaredream.com",
      logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Cloudflare_Logo.png/512px-Cloudflare_Logo.png",
    },
    {
      name: "OpenAPI Search",
      url: "https://openapisearch.com",
      logo: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiByeD0iMjAiIGZpbGw9IiM2REE1NTQiLz4KPHN2ZyB4PSI4IiB5PSI4IiB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSI+CjxwYXRoIGQ9Ik0xNS41IDE0SDE0LjcxTDE0LjQzIDEzLjcyQzE1LjQxIDEyLjU5IDE2IDExLjExIDE2IDkuNUMxNiA1LjkxIDEzLjA5IDMgOS41IDNTMyA1LjkxIDMgOS41IDUuOTEgMTYgOS41IDE2QzExLjExIDE2IDEyLjU5IDE1LjQxIDEzLjcyIDE0LjQzTDE0IDEzLjcxVjE0LjVMMTkgMTkuNDlMMjAuNDkgMThMMTUuNSAxNFpNOS41IDE0QzcgMTQgNSAxMiA1IDkuNVM3IDUgOS41IDVTMTQgNyAxNCA5LjUgMTIgMTQgOS41IDE0WiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+Cjwvc3ZnPg==",
    },
    {
      name: "ArXiv",
      url: "https://arxivmd.org",
      logo: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiByeD0iMjAiIGZpbGw9IiNCMzEyMTIiLz4KPHN2ZyB4PSI4IiB5PSI4IiB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSI+CjxwYXRoIGQ9Ik0xNCAySDZBMiAyIDAgMCAwIDQgNFYyMEEyIDIgMCAwIDAgNiAyMkgxOEEyIDIgMCAwIDAgMjAgMjBWOEwxNCAyWk0xOCAyMEg2VjRIOUwxNSAxMFYyMEgxOFpNOSA2LjVWMTAuNUgxM1Y2LjVIOVoiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPgo8L3N2Zz4=",
    },
  ];

  // Check if current URL matches the first website's URL
  const isOnFirstWebsite =
    window.location.href === websites[0].url ||
    window.location.href.startsWith(websites[0].url);

  // Back arrow SVG
  const backArrowSVG =
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiByeD0iOCIgZmlsbD0iI2ZkN2QzNCIvPgo8cGF0aCBkPSJNMjQgMjBIMTZNMTYgMjBMMjAgMTZNMTYgMjBMMjAgMjQiIHN0cm9rZT0iI0ZGRjNBMCIgc3Ryb2tlLXdpZHRoPSIyLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgo8L3N2Zz4=";

  // Create icon elements
  websites.forEach((site, index) => {
    const iconContainer = document.createElement("div");
    iconContainer.className = "sidebar-icon";

    const iconStyles = `
      width: 48px;
      height: 48px;
      min-width: 48px;
      border-radius: 50%;
      background-color: #36393f;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;
      overflow: hidden;
    `;

    Object.assign(
      iconContainer.style,
      Object.fromEntries(
        iconStyles
          .split(";")
          .map((s) => s.trim().split(":"))
          .filter((s) => s.length === 2),
      ),
    );

    // Create the image
    const img = document.createElement("img");

    // Check if this is the first icon and we're on that website
    if (index === 0 && isOnFirstWebsite) {
      img.src = backArrowSVG;
      img.alt = "Back";
    } else {
      img.src = site.logo;
      img.alt = site.name;
    }

    // Determine initial filter based on conditions
    const isFirstIcon = index === 0;
    const shouldBeGrayscale = !isMobile && !isFirstIcon;

    img.style.cssText = `
      width: 40px;
      height: 40px;
      border-radius: 50%;
      object-fit: cover;
      filter: ${shouldBeGrayscale ? "grayscale(100%)" : "grayscale(0%)"};
      transition: filter 0.2s ease;
    `;

    // Handle image load errors with fallback
    img.onerror = function () {
      this.style.display = "none";
      const fallback = document.createElement("div");
      fallback.style.cssText = `
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background-color: #72767d;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 16px;
        filter: ${shouldBeGrayscale ? "grayscale(100%)" : "grayscale(0%)"};
        transition: filter 0.2s ease;
      `;

      // Use back arrow symbol if this is first icon and we're on that website
      if (index === 0 && isOnFirstWebsite) {
        fallback.textContent = "←";
        fallback.style.backgroundColor = "#fd7d34";
        fallback.style.color = "#FFF3A0";
        fallback.style.fontSize = "24px";
      } else {
        fallback.textContent = site.name.charAt(0).toUpperCase();
      }

      iconContainer.appendChild(fallback);

      // Update hover effects for fallback (only on desktop and not first icon)
      if (!isMobile && !isFirstIcon) {
        iconContainer.addEventListener("mouseenter", () => {
          iconContainer.style.borderRadius = "16px";
          fallback.style.filter = "grayscale(0%)";
          if (!(index === 0 && isOnFirstWebsite)) {
            fallback.style.backgroundColor = "#ff7e36";
          }
        });

        iconContainer.addEventListener("mouseleave", () => {
          iconContainer.style.borderRadius = "50%";
          fallback.style.filter = "grayscale(100%)";
          if (!(index === 0 && isOnFirstWebsite)) {
            fallback.style.backgroundColor = "#72767d";
          }
        });
      } else {
        // For mobile or first icon, only change border radius
        iconContainer.addEventListener("mouseenter", () => {
          iconContainer.style.borderRadius = "16px";
        });

        iconContainer.addEventListener("mouseleave", () => {
          iconContainer.style.borderRadius = "50%";
        });
      }
    };

    iconContainer.appendChild(img);

    // Add hover effects - behavior depends on mobile/desktop and first icon
    if (!isMobile && !isFirstIcon) {
      // Desktop: change border radius and remove grayscale (except first icon)
      iconContainer.addEventListener("mouseenter", () => {
        iconContainer.style.borderRadius = "16px";
        img.style.filter = "grayscale(0%)";
      });

      iconContainer.addEventListener("mouseleave", () => {
        iconContainer.style.borderRadius = "50%";
        img.style.filter = "grayscale(100%)";
      });
    } else {
      // Mobile or first icon: only change border radius
      iconContainer.addEventListener("mouseenter", () => {
        iconContainer.style.borderRadius = "16px";
      });

      iconContainer.addEventListener("mouseleave", () => {
        iconContainer.style.borderRadius = "50%";
      });
    }

    // Add click handler
    iconContainer.addEventListener("click", () => {
      if (index === 0 && isOnFirstWebsite) {
        // Go back in history
        goBackWithFallback("https://letmeprompt.com");
      } else {
        // Open the website
        window.open(site.url, "_blank");
      }
    });

    sidebar.appendChild(iconContainer);

    // Add separator after 1st icon (XYText) and after 3rd icon (only on desktop)
    if (!isMobile && (index === 0 || index === 3)) {
      const separator = document.createElement("div");
      separator.style.cssText = `
        width: 32px;
        height: 2px;
        background-color: #36393f;
        border-radius: 1px;
        margin: 4px 0;
      `;
      sidebar.appendChild(separator);
    }
  });

  // Add sidebar to page
  document.body.appendChild(sidebar);

  // Adjust body margins based on screen size
  if (isMobile) {
    // Add bottom margin to prevent content overlay
    document.body.style.marginBottom = "100px";
  } else {
    // Push content to the right on desktop
    document.body.style.marginLeft = "72px";
  }

  // Handle window resize to switch between mobile and desktop layouts
  window.addEventListener("resize", () => {
    const newIsMobile = window.innerWidth <= 768;
    if (newIsMobile !== isMobile) {
      // Remove the current sidebar and recreate with new layout
      sidebar.remove();
      // Reset body margins
      document.body.style.marginLeft = "";
      document.body.style.marginBottom = "";
      // Re-run the script
      setTimeout(() => {
        arguments.callee();
      }, 100);
    }
  });
})();
