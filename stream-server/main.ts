// @ts-check
/// <reference lib="esnext" />
/// <reference types="@cloudflare/workers-types" />
import {
  Codeblock,
  extensionToMediaType,
  findCodeblocks,
  getContentType,
} from "./util";
import { marked } from "marked";

/**
 * KV data structure for storing request/result data
 */
interface KVData {
  prompt: string;
  model: string;
  headline?: string;
  context?: string | null;
  result?: string;
  error?: string;
  timestamp?: number;
}

/**
 * LLMS JSON structure
 */
interface LLMSLink {
  title: string;
  href: string;
  description: string;
  category: string;
}

interface LLMSJSON {
  title: string;
  description: string;
  links: LLMSLink[];
}

/**
 * CORS headers to include in all responses
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/**
 * Helper function to escape HTML content for safe injection
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Generate metadata tags for HTML head
 */
function generateMetaTags(llmsJson: LLMSJSON, currentUrl: string): string {
  const escapedTitle = escapeHtml(llmsJson.title);
  const escapedDescription = escapeHtml(llmsJson.description);
  const domain = new URL(currentUrl).hostname;
  const ogImageUrl = `https://quickog.com/screenshot/${currentUrl}`;

  return `
    <!-- Injected by LMPIFY -->
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapedTitle}</title>
    <meta name="description" content="${escapedDescription}" />
    <meta name="robots" content="index, follow" />

    <!-- Facebook Meta Tags -->
    <meta property="og:url" content="${currentUrl}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapedTitle}" />
    <meta property="og:description" content="${escapedDescription}" />
    <meta property="og:image" content="${ogImageUrl}" />
    <meta property="og:image:alt" content="${escapedDescription}"/>
    <meta property="og:image:width" content="1200"/>
    <meta property="og:image:height" content="630"/>

    <!-- Twitter Meta Tags -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta property="twitter:domain" content="${domain}" />
    <meta property="twitter:url" content="${currentUrl}" />
    <meta name="twitter:title" content="${escapedTitle}" />
    <meta name="twitter:description" content="${escapedDescription}" />
    <meta name="twitter:image" content="${ogImageUrl}" />
    <!-- End LMPIFY injection -->
    `;
}

/**
 * Generate loading indicator HTML
 */
function generateLoadingIndicator(isLoading: boolean): string {
  return `
    <div id="lmpify-loading-indicator" style="
      display: ${isLoading ? "block" : "none"} !important;
      margin: 20px 0 !important;
      padding: 16px !important;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
      border-radius: 8px !important;
      color: white !important;
      text-align: center !important;
      position: relative !important;
      overflow: hidden !important;
    ">
      <div style="
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 12px !important;
        margin-bottom: 8px !important;
      ">
        <div class="lmpify-spinner" style="
          width: 20px !important;
          height: 20px !important;
          border: 2px solid rgba(255,255,255,0.3) !important;
          border-top: 2px solid white !important;
          border-radius: 50% !important;
          animation: lmpify-spin 1s linear infinite !important;
        "></div>
        <span style="
          font-weight: 600 !important;
          font-size: 14px !important;
          color: white !important;
        ">Generating Content...</span>
      </div>
      <div style="
        font-size: 12px !important;
        color: rgba(255,255,255,0.8) !important;
        margin-bottom: 12px !important;
      ">AI is processing your request. Refresh for the latest version.</div>
      
      <!-- Animated progress bar -->
      <div style="
        width: 100% !important;
        height: 4px !important;
        background: rgba(255,255,255,0.2) !important;
        border-radius: 2px !important;
        overflow: hidden !important;
        position: relative !important;
      ">
        <div class="lmpify-progress-bar" style="
          width: 100% !important;
          height: 100% !important;
          background: linear-gradient(90deg, 
            rgba(255,255,255,0.4) 0%, 
            rgba(255,255,255,0.8) 50%, 
            rgba(255,255,255,0.4) 100%) !important;
          animation: lmpify-shimmer 2s ease-in-out infinite !important;
          transform: translateX(-100%) !important;
        "></div>
      </div>
      
      <!-- Floating particles animation -->
      <div class="lmpify-particles" style="
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        pointer-events: none !important;
        overflow: hidden !important;
      ">
        <div class="lmpify-particle" style="
          position: absolute !important;
          width: 4px !important;
          height: 4px !important;
          background: rgba(255,255,255,0.6) !important;
          border-radius: 50% !important;
          animation: lmpify-float1 3s ease-in-out infinite !important;
          top: 20% !important;
          left: 20% !important;
        "></div>
        <div class="lmpify-particle" style="
          position: absolute !important;
          width: 3px !important;
          height: 3px !important;
          background: rgba(255,255,255,0.4) !important;
          border-radius: 50% !important;
          animation: lmpify-float2 4s ease-in-out infinite 0.5s !important;
          top: 60% !important;
          right: 30% !important;
        "></div>
        <div class="lmpify-particle" style="
          position: absolute !important;
          width: 2px !important;
          height: 2px !important;
          background: rgba(255,255,255,0.5) !important;
          border-radius: 50% !important;
          animation: lmpify-float3 3.5s ease-in-out infinite 1s !important;
          top: 40% !important;
          left: 70% !important;
        "></div>
      </div>
    </div>
  `;
}

/**
 * Generate sidebar categories HTML
 */
function generateSidebarCategories(
  llmsJson: LLMSJSON,
  currentPath: string,
): string {
  const categories = [...new Set(llmsJson.links.map((link) => link.category))];

  return categories
    .map((category) => {
      const categoryLinks = llmsJson.links.filter(
        (link) => link.category === category,
      );

      return `
        <div class="lmpify-toolbar-category" style="margin-bottom: 20px !important;">
          <h3 style="
            margin: 0 0 12px 0 !important;
            font-size: 14px !important;
            font-weight: 600 !important;
            color: #374151 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.5px !important;
            border-bottom: 1px solid #e5e7eb !important;
            padding-bottom: 8px !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
          ">${category}</h3>
          ${categoryLinks
            .map((link) => {
              const isActive = link.href === currentPath;
              return `
            <a href="${link.href}" class="lmpify-toolbar-link${
                isActive ? " lmpify-active" : ""
              }" style="
              display: block !important;
              padding: 8px 12px !important;
              margin-bottom: 4px !important;
              background: ${isActive ? "#3b82f6" : "#ffffff"} !important;
              border: 1px solid ${isActive ? "#3b82f6" : "#e5e7eb"} !important;
              border-radius: 6px !important;
              color: ${isActive ? "#ffffff" : "#374151"} !important;
              text-decoration: none !important;
              font-size: 13px !important;
              line-height: 1.4 !important;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
              transition: all 0.2s ease !important;
            " onmouseover="
              if (!this.classList.contains('lmpify-active')) {
                this.style.background = '#f3f4f6';
                this.style.borderColor = '#d1d5db';
              }
            " onmouseout="
              if (!this.classList.contains('lmpify-active')) {
                this.style.background = '#ffffff';
                this.style.borderColor = '#e5e7eb';
              }
            ">
              <div style="font-weight: 500 !important; margin-bottom: 2px !important; color: inherit !important;">${
                link.title
              }</div>
              <div style="font-size: 11px !important; color: ${
                isActive ? "rgba(255,255,255,0.8)" : "#6b7280"
              } !important;">${link.description}</div>
            </a>
          `;
            })
            .join("")}
        </div>
      `;
    })
    .join("");
}

/**
 * Generate sidebar HTML
 */
function generateSidebar(
  llmsJson: LLMSJSON,
  currentPath: string,
  isLoading: boolean,
): string {
  const loadingIndicator = generateLoadingIndicator(isLoading);
  const categoryHTML = generateSidebarCategories(llmsJson, currentPath);

  return `
    <div id="lmpify-prompt-sidebar" style="
      position: fixed !important;
      top: 0 !important;
      right: 0 !important;
      width: 320px !important;
      height: 100vh !important;
      background: #f8fafc !important;
      border-left: 1px solid #e5e7eb !important;
      z-index: 2147483647 !important;
      display: none !important;
      overflow-y: auto !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      box-sizing: border-box !important;
    ">
      <div style="
        padding: 20px !important;
        border-bottom: 1px solid #e5e7eb !important;
        background: #ffffff !important;
        box-sizing: border-box !important;
      ">
        <h2 style="
          margin: 0 0 8px 0 !important;
          font-size: 18px !important;
          font-weight: 700 !important;
          color: #111827 !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        ">${llmsJson.title}</h2>
        <p style="
          margin: 0 0 0 0 !important;
          font-size: 13px !important;
          color: #6b7280 !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
          line-height: 1.4 !important;
        ">${llmsJson.description}</p>
        
        ${loadingIndicator}
      </div>
      
      <div style="padding: 20px !important; box-sizing: border-box !important;">
        ${categoryHTML}
      </div>
    </div>
  `;
}

/**
 * Generate sidebar toggle button
 */
function generateSidebarToggle(isLoading: boolean): string {
  if (isLoading) return "";

  return `
    <button id="lmpify-sidebar-toggle" style="
      position: fixed !important;
      top: 20px !important;
      right: 20px !important;
      width: 40px !important;
      height: 40px !important;
      background: #ffffff !important;
      border: 1px solid #e5e7eb !important;
      border-radius: 8px !important;
      cursor: pointer !important;
      z-index: 2147483648 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-size: 16px !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1) !important;
      transition: all 0.2s ease !important;
      padding: 0 !important;
      margin: 0 !important;
      box-sizing: border-box !important;
    " onmouseover="
      this.style.background = '#f9fafb';
      this.style.transform = 'scale(1.05)';
    " onmouseout="
      this.style.background = '#ffffff';
      this.style.transform = 'scale(1)';
    ">☰</button>
  `;
}

/**
 * Generate CSS and JavaScript for sidebar functionality
 */
function generateSidebarAssets(isLoading: boolean): string {
  return `
    <style>
      .lmpify-sidebar-open {
        margin-right: 320px !important;
        transition: margin-right 0.3s ease !important;
      }
      
      /* Ensure no other styles can interfere */
      #lmpify-prompt-sidebar,
      #lmpify-prompt-sidebar *,
      #lmpify-sidebar-toggle {
        box-sizing: border-box !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      }
      
      #lmpify-prompt-sidebar * {
        max-width: none !important;
        text-align: left !important;
      }
      
      /* Loading animations */
      @keyframes lmpify-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      @keyframes lmpify-shimmer {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }
      
      @keyframes lmpify-float1 {
        0%, 100% { transform: translateY(0px) translateX(0px); opacity: 0.6; }
        33% { transform: translateY(-10px) translateX(5px); opacity: 1; }
        66% { transform: translateY(-5px) translateX(-3px); opacity: 0.8; }
      }
      
      @keyframes lmpify-float2 {
        0%, 100% { transform: translateY(0px) translateX(0px); opacity: 0.4; }
        50% { transform: translateY(-15px) translateX(-8px); opacity: 0.8; }
      }
      
      @keyframes lmpify-float3 {
        0%, 100% { transform: translateY(0px) translateX(0px); opacity: 0.5; }
        25% { transform: translateY(-8px) translateX(3px); opacity: 0.9; }
        75% { transform: translateY(-12px) translateX(-5px); opacity: 0.7; }
      }
      
      /* Styles for incomplete HTML iframe */
      #lmpify-content-iframe {
        width: 100% !important;
        height: 100vh !important;
        border: none !important;
        margin: 0 !important;
        padding: 0 !important;
        display: block !important;
        transition: margin-right 0.3s ease !important;
      }
      
      .lmpify-sidebar-open #lmpify-content-iframe {
        margin-right: 320px !important;
      }
    </style>

    <script>
      (function() {
        // Wrap in IIFE to avoid conflicts
        const LMPIFY_STORAGE_KEY = 'lmpify-sidebar-open';
        
        document.addEventListener('DOMContentLoaded', function() {
          const sidebar = document.getElementById('lmpify-prompt-sidebar');
          const toggle = document.getElementById('lmpify-sidebar-toggle');
          const body = document.body;
          const iframe = document.getElementById('lmpify-content-iframe');
          
          if (!sidebar) return;
          
          // Get saved state from localStorage
          let isOpen = ${
            isLoading
              ? "true"
              : `localStorage.getItem(LMPIFY_STORAGE_KEY) === 'true'`
          };
          
          function updateSidebar() {
            if (isOpen) {
              sidebar.style.display = 'block';
              body.classList.add('lmpify-sidebar-open');
              if(toggle){
                toggle.textContent = '✕';
              }
            } else {
              sidebar.style.display = 'none';
              body.classList.remove('lmpify-sidebar-open');
              if(toggle){
                toggle.textContent = '☰';
              }
            }
            
            // Save state to localStorage
            ${
              isLoading
                ? ""
                : `localStorage.setItem(LMPIFY_STORAGE_KEY, isOpen.toString());`
            }
          }
          
          // Set initial state
          updateSidebar();
          
          if(toggle){
            toggle.addEventListener('click', function() {
              isOpen = !isOpen;
              updateSidebar();
            });
          }
          
          // Handle escape key
          document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && isOpen) {
              isOpen = false;
              updateSidebar();
            }
          });
        });
      })();
    </script>
  `;
}

/**
 * Inject meta tags into existing HTML head
 */
function injectMetaTagsIntoHead(
  html: string,
  llmsJson: LLMSJSON,
  currentUrl: string,
): string {
  let metaTagsToInject = "";

  // Check and inject missing meta tags
  if (!html.match(/<title[^>]*>/i)) {
    metaTagsToInject += `<title>${escapeHtml(llmsJson.title)}</title>\n    `;
  }

  if (!html.match(/<meta[^>]*name=["']description["'][^>]*>/i)) {
    metaTagsToInject += `<meta name="description" content="${escapeHtml(
      llmsJson.description,
    )}" />\n    `;
  }

  if (!html.match(/<meta[^>]*name=["']robots["'][^>]*>/i)) {
    metaTagsToInject += `<meta name="robots" content="index, follow" />\n    `;
  }

  if (!html.match(/<meta[^>]*property=["']og:title["'][^>]*>/i)) {
    metaTagsToInject += `
    <!-- Facebook Meta Tags -->
    <meta property="og:url" content="${currentUrl}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(llmsJson.title)}" />
    <meta property="og:description" content="${escapeHtml(
      llmsJson.description,
    )}" />
    <meta property="og:image" content="https://quickog.com/screenshot/${currentUrl}" />
    <meta property="og:image:alt" content="${escapeHtml(
      llmsJson.description,
    )}"/>
    <meta property="og:image:width" content="1200"/>
    <meta property="og:image:height" content="630"/>
    `;
  }

  if (!html.match(/<meta[^>]*name=["']twitter:card["'][^>]*>/i)) {
    metaTagsToInject += `
    <!-- Twitter Meta Tags -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta property="twitter:domain" content="${new URL(currentUrl).hostname}" />
    <meta property="twitter:url" content="${currentUrl}" />
    <meta name="twitter:title" content="${escapeHtml(llmsJson.title)}" />
    <meta name="twitter:description" content="${escapeHtml(
      llmsJson.description,
    )}" />
    <meta name="twitter:image" content="https://quickog.com/screenshot/${currentUrl}" />
    `;
  }

  // Inject meta tags into head
  if (metaTagsToInject) {
    return html.replace(/<head([^>]*)>/i, `<head$1>\n    ${metaTagsToInject}`);
  }

  return html;
}

/**
 * Inject sidebar and meta tags into complete HTML
 */
function injectCompleteHtml(
  html: string,
  llmsJson: LLMSJSON,
  url: string,
  isLoading: boolean,
): string {
  const currentPath = new URL(url).pathname;
  const currentUrl = `https://${new URL(url).hostname}${currentPath}`;

  // Generate sidebar components
  const sidebar = generateSidebar(llmsJson, currentPath, isLoading);
  const sidebarToggle = generateSidebarToggle(isLoading);
  const sidebarAssets = generateSidebarAssets(isLoading);

  // Check if HTML has proper structure
  const hasHtmlTag = html.includes("<html");
  const hasHeadTag = html.includes("<head");
  const hasBodyTag = html.includes("<body");

  let processedHtml = html;

  if (hasHtmlTag && hasHeadTag) {
    // Full HTML document - inject meta tags and sidebar
    processedHtml = injectMetaTagsIntoHead(processedHtml, llmsJson, currentUrl);

    // Inject sidebar before </body>
    if (processedHtml.includes("</body>")) {
      processedHtml = processedHtml.replace(
        "</body>",
        `${sidebar}${sidebarToggle}${sidebarAssets}</body>`,
      );
    } else {
      processedHtml += `${sidebar}${sidebarToggle}${sidebarAssets}`;
    }
  } else if (hasBodyTag) {
    // Has body but no head - add head with meta tags
    const metaTags = generateMetaTags(llmsJson, currentUrl);
    processedHtml = processedHtml.replace(
      "<body",
      `<head>${metaTags}</head><body`,
    );

    // Inject sidebar before </body>
    if (processedHtml.includes("</body>")) {
      processedHtml = processedHtml.replace(
        "</body>",
        `${sidebar}${sidebarToggle}${sidebarAssets}</body>`,
      );
    } else {
      processedHtml += `${sidebar}${sidebarToggle}${sidebarAssets}`;
    }
  } else {
    // Fragment or incomplete HTML - wrap it properly
    const metaTags = generateMetaTags(llmsJson, currentUrl);
    processedHtml = `<html><head>${metaTags}</head><body>${html}${sidebar}${sidebarToggle}${sidebarAssets}</body></html>`;
  }

  return processedHtml;
}
/**
 * Add target="_parent" to all anchor tags in HTML content
 */
function addTargetParentToLinks(html: string): string {
  return html.replace(/<a\s+([^>]*?)>/gi, (match, attributes) => {
    // Check if target attribute already exists
    if (/target\s*=\s*["'][^"']*["']/i.test(attributes)) {
      // Replace existing target attribute with target="_parent"
      return match.replace(/target\s*=\s*["'][^"']*["']/i, 'target="_parent"');
    } else {
      // Add target="_parent" to the attributes
      return `<a ${attributes} target="_parent">`;
    }
  });
}

/**
 * Create a wrapper HTML page with iframe for incomplete HTML content
 */
function injectIncompleteHtml(
  html: string,
  llmsJson: LLMSJSON,
  url: string,
  isLoading: boolean,
): string {
  const currentPath = new URL(url).pathname;
  const currentUrl = `https://${new URL(url).hostname}${currentPath}`;
  const baseUrl = `https://${new URL(url).hostname}`;

  // Add target="_parent" to all anchor tags
  let processedHtml = addTargetParentToLinks(html);

  // Add base tag if head exists
  if (processedHtml.includes("<head>") || processedHtml.includes("<head ")) {
    processedHtml = processedHtml.replace(
      /<head([^>]*)>/i,
      `<head$1><base href="${baseUrl}/">`,
    );
  } else {
    // Add head with base tag if no head exists
    processedHtml = `<head><base href="${baseUrl}/"></head>${processedHtml}`;
  }

  // Generate sidebar components
  const sidebar = generateSidebar(llmsJson, currentPath, isLoading);
  const sidebarToggle = generateSidebarToggle(isLoading);
  const sidebarAssets = generateSidebarAssets(isLoading);

  // Generate metadata
  const metaTags = generateMetaTags(llmsJson, currentUrl);

  // Encode the processed HTML for the iframe
  const encodedHtml = encodeURIComponent(processedHtml);

  // Create wrapper HTML with iframe
  const wrapperHtml = `<!DOCTYPE html>
<html lang="en">
<head>
${metaTags}
</head>
<body style="margin: 0; padding: 0; overflow: hidden;">
  <iframe 
    id="lmpify-content-iframe"
    src="data:text/html;charset=utf-8,${encodedHtml}"
    style="width: 100%; height: 100vh; border: none; margin: 0; padding: 0; display: block; transition: margin-right 0.3s ease;"
    frameborder="0"
    scrolling="auto">
  </iframe>
  
  ${sidebar}
  ${sidebarToggle}
  ${sidebarAssets}
</body>
</html>`;

  return wrapperHtml;
}

/**
 * Generate LLMS JSON structure
 */
function generateLLMSJSON(
  subdomain: string,
  result: KVData,
  codeblocks: Codeblock[],
): LLMSJSON {
  const title = result.headline || `${subdomain} - AI Generated Content`;
  const description = `AI-generated content using ${result.model}. Created with "Let Me Prompt It For You" platform.`;
  const editUrl = `https://letmeprompt.com/${subdomain}`;

  const links: LLMSLink[] = [
    ...codeblocks.map((codeblock, index) => {
      const path = codeblock.parameters.path;
      let href: string;
      let title: string;

      if (path) {
        href = path.startsWith("/") ? path : "/" + path;
        title = path;
      } else {
        href = `/codeblock/${index}`;
        title = `Codeblock ${index}`;
      }

      const contentType = getContentType(codeblock.lang, codeblock.text);
      const fileType = contentType.split("/")[1] || codeblock.lang || "text";

      return {
        title: title,
        href: href,
        description: `${fileType.toUpperCase()} ${path ? "file" : "codeblock"}`,
        category: "Content",
      };
    }),

    {
      title: "Edit Prompt",
      href: editUrl,
      description: "Modify and regenerate this content",
      category: "Source",
    },
    {
      title: "View Prompt",
      href: "/prompt",
      description: "See the original prompt used",
      category: "Source",
    },
    result.context
      ? {
          title: "Context Data",
          href: "/context",
          description: "View the context provided",
          category: "Source",
        }
      : undefined,
    {
      title: "Raw Result",
      href: "/result",
      description: "Plain text generated content",
      category: "Source",
    },
    {
      title: "JSON Data",
      href: "/json",
      description: "Complete data including metadata",
      category: "Source",
    },
    {
      title: "LLMS.txt",
      href: "/llms.txt",
      description: "Machine-readable site structure",
      category: "Source",
    },
    {
      title: "Download",
      href: `https://download.flaredream.com/${subdomain}`,
      description: "Download complete project files",
      category: "Actions",
    },
    {
      title: "Deploy",
      href: `https://deploy.flaredream.com/https://download.flaredream.com/${subdomain}.json`,
      description: "Deploy to Cloudflare Workers",
      category: "Actions",
    },
  ].filter((x) => !!x);

  return {
    title,
    description,
    links,
  };
}

/**
 * Generate LLMS.txt markdown from JSON structure
 */
function generateLLMSTxt(llmsJson: LLMSJSON): string {
  const { title, description, links } = llmsJson;

  let markdown = `# ${title}\n\n> ${description}\n\n`;

  // Group links by category
  const categories = [...new Set(links.map((link) => link.category))];

  categories.forEach((category) => {
    const categoryLinks = links.filter((link) => link.category === category);

    markdown += `## ${category}\n\n`;

    categoryLinks.forEach((link) => {
      markdown += `- [${link.title}](${link.href}): ${link.description}\n`;
    });

    markdown += "\n";
  });

  return markdown;
}

export default {
  fetch: async (
    request: Request,
    env: { RESULTS: KVNamespace; SQL_STREAM_PROMPT_DO: DurableObjectNamespace },
  ) => {
    // Handle preflight OPTIONS requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: { ...corsHeaders },
      });
    }

    const url = new URL(request.url);
    const subdomain = url.hostname.split(".")[0];

    const pathnameWithoutExt = "/" + subdomain;
    let result = await env.RESULTS.get<KVData>(pathnameWithoutExt, "json");
    let isLoading = false;

    if (!result?.result) {
      // Not yet. Check DO
      const stub = env.SQL_STREAM_PROMPT_DO.get(
        env.SQL_STREAM_PROMPT_DO.idFromName(pathnameWithoutExt),
      );
      const response = await stub.fetch(new Request("https://do/current"));
      if (!response.ok) {
        return new Response(`Result '${subdomain}' Not found`, {
          status: 404,
          headers: { ...corsHeaders },
        });
      }
      isLoading = true;
      result = await response.json();
    }

    if (!result.result) {
      return new Response("Not found", {
        status: 404,
        headers: { ...corsHeaders },
      });
    }

    // Extract codeblocks for use in multiple places
    const codeblocks = findCodeblocks(result.result);

    // Generate LLMS JSON structure
    const llmsJson = generateLLMSJSON(subdomain, result, codeblocks);

    // Handle LLMS JSON route
    if (url.pathname === "/llms.json") {
      return new Response(JSON.stringify(llmsJson, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf8",
          ...corsHeaders,
        },
      });
    }

    // Handle LLMS.txt route - generate from JSON
    if (url.pathname === "/llms.txt") {
      const llmsTxtContent = generateLLMSTxt(llmsJson);
      return new Response(llmsTxtContent, {
        status: 200,
        headers: {
          "Content-Type": "text/markdown",
          ...corsHeaders,
        },
      });
    }

    // Handle JSON route - return all data as JSON
    if (url.pathname === "/json") {
      return new Response(JSON.stringify(result, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf8",
          ...corsHeaders,
        },
      });
    }

    // Handle individual data routes
    if (
      ["prompt", "context", "result", "data"].includes(url.pathname.slice(1))
    ) {
      const field = url.pathname.slice(1);
      const content = result[field] || "";
      return new Response(content, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf8",
          ...corsHeaders,
        },
      });
    }

    // Handle chat completions endpoint
    if (url.pathname === "/chat/completions") {
      if (request.method === "GET") {
        return new Response(
          "Should be chat completions endpoint with prompt+context in system and should be authenticated with xmoney-provided API key. Creator will earn for it! On this page, there should be lot of instructions on how to use it.",
          {
            headers: { ...corsHeaders },
          },
        );
      } else if (request.method === "POST") {
        return new Response("Coming soon", {
          status: 500,
          headers: { ...corsHeaders },
        });
      } else {
        return new Response("Method not allowed", {
          status: 405,
          headers: { ...corsHeaders },
        });
      }
    }

    // Find matching routes from codeblocks
    const route = codeblocks.find((item) => {
      const path = item.parameters.path;
      if (!path) {
        return;
      }
      const fullPath = path.startsWith("/") ? path : "/" + path;
      const isMatch = url.pathname === fullPath;
      return isMatch;
    });

    if (route) {
      let content = route.text;

      if (
        (content.split("\n").length === 1 && content.startsWith("https://")) ||
        content.startsWith("http://")
      ) {
        try {
          // if it's a url, try fetching it
          const url = new URL(content);
          return fetch(url.toString());
        } catch (e) {
          //do nothing
        }
      }
      const ext = url.pathname.split("/").pop()?.split(".").pop();
      const contentType = extensionToMediaType[ext] || "text/plain";

      // Inject sidebar for HTML content
      const isHtml = contentType.includes("text/html");
      if (isHtml) {
        const htmlWithSidebar = route.isIncomplete
          ? injectIncompleteHtml(content, llmsJson, url.href, isLoading)
          : injectCompleteHtml(content, llmsJson, url.href, isLoading);

        return new Response(htmlWithSidebar, {
          headers: {
            "Content-Type": "text/html; charset=utf8",
            ...corsHeaders,
          },
        });
      }

      return new Response(content, {
        headers: {
          "Content-Type": contentType + "; charset=utf8",
          ...corsHeaders,
        },
      });
    }

    if (url.pathname.startsWith("/codeblock/")) {
      const index = Number(url.pathname.slice("/codeblock/".length));
      if (!isNaN(index) && codeblocks[index]) {
        const codeblock = codeblocks[index];
        const path = codeblock.parameters.path;
        if (path) {
          // redirect if we actually have a path for it.
          const fullPath = path.startsWith("/") ? path : "/" + path;
          return new Response(null, {
            status: 302,
            headers: { Location: fullPath },
          });
        }

        const content = codeblock.text;
        const contentType = getContentType(codeblock.lang, content);

        // Inject sidebar for HTML content
        const isHtml = contentType.includes("text/html");
        if (isHtml) {
          const htmlWithSidebar = codeblock.isIncomplete
            ? injectIncompleteHtml(content, llmsJson, url.href, isLoading)
            : injectCompleteHtml(content, llmsJson, url.href, isLoading);

          return new Response(htmlWithSidebar, {
            headers: {
              "Content-Type": "text/html; charset=utf8",
              ...corsHeaders,
            },
          });
        }

        return new Response(content, {
          headers: {
            "Content-Type": contentType + "; charset=utf8",
            ...corsHeaders,
          },
        });
      }
    }

    // Handle root path - serve main content as HTML with sidebar
    if (url.pathname === "/") {
      // First, check if there's an index.html file
      const indexHtmlRoute = codeblocks.find((item) => {
        const path = item.parameters.path;
        if (!path) return false;
        const fullPath = path.startsWith("/") ? path : "/" + path;
        return fullPath === "/index.html";
      });

      if (indexHtmlRoute) {
        // Redirect to index.html
        return new Response(null, {
          status: 302,
          headers: {
            Location: "/index.html",
            ...corsHeaders,
          },
        });
      }

      // If no index.html, look for any HTML codeblock
      const htmlCodeblockIndex = codeblocks.findIndex((item) => {
        const content = item.text;
        const contentType = getContentType(item.lang, content);
        return contentType === "text/html";
      });
      const htmlCodeblock = codeblocks[htmlCodeblockIndex];

      if (htmlCodeblock) {
        const Location = htmlCodeblock.parameters.path?.startsWith("/")
          ? htmlCodeblock.parameters.path
          : htmlCodeblock.parameters.path
          ? "/" + htmlCodeblock.parameters.path
          : `/codeblock/${htmlCodeblockIndex}`;
        return new Response(null, {
          status: 302,
          headers: {
            Location,
            ...corsHeaders,
          },
        });
      }

      // Create a simple HTML page with the main result content
      const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${llmsJson.title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
            color: #333;
            background: #ffffff;
        }
        h1 {
            color: #111;
            border-bottom: 2px solid #eee;
            padding-bottom: 10px;
        }
        pre {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 6px;
            padding: 16px;
            overflow-x: auto;
            white-space: pre-wrap;
        }
        .meta {
            background: #f8f9fa;
            border-left: 4px solid #007bff;
            padding: 16px;
            margin: 20px 0;
            border-radius: 0 6px 6px 0;
        }
        .meta strong {
            color: #007bff;
        }
    </style>
</head>
<body>
    <h1>${llmsJson.title}</h1>
    <div class="meta">
        <strong>Model:</strong> ${result.model}<br>
        ${
          result.timestamp
            ? `<strong>Generated:</strong> ${new Date(
                result.timestamp,
              ).toLocaleString()}<br>`
            : ""
        }
        <strong>Description:</strong> ${llmsJson.description}
    </div>

    ${result?.result ? marked(result?.result) : ""}
</body>
</html>`;

      const htmlWithSidebar = injectCompleteHtml(
        htmlContent,
        llmsJson,
        url.href,
        isLoading,
      );
      return new Response(htmlWithSidebar, {
        headers: {
          "Content-Type": "text/html; charset=utf8",
          ...corsHeaders,
        },
      });
    }

    // 404 - Generate llms.txt compliant 404 page
    const notFoundText = `# ${subdomain} - Page Not Found

> This AI-generated website doesn't have the requested page.

The page you're looking for doesn't exist on this AI-generated website. This content was created using the "Let Me Prompt It For You" platform.

${generateLLMSTxt(llmsJson)}
`;

    // Check if client accepts HTML
    const acceptHeader = request.headers.get("accept") || "";
    const prefersHtml = acceptHeader.includes("text/html");

    if (prefersHtml) {
      // Parse markdown to HTML
      const parsedHtml = marked(notFoundText);

      // Create a proper HTML page
      const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subdomain} - Page Not Found</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
            color: #333;
            background: #ffffff;
        }
        h1 {
            color: #d73a49;
            border-bottom: 2px solid #eee;
            padding-bottom: 10px;
        }
        h2 {
            color: #111;
            margin-top: 30px;
            border-bottom: 1px solid #eee;
            padding-bottom: 5px;
        }
        blockquote {
            background: #f8f9fa;
            border-left: 4px solid #d73a49;
            padding: 16px;
            margin: 20px 0;
            border-radius: 0 6px 6px 0;
            font-style: italic;
            color: #666;
        }
        ul {
            padding-left: 20px;
        }
        li {
            margin-bottom: 8px;
        }
        a {
            color: #007bff;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
        .error-status {
            background: #f8d7da;
            color: #721c24;
            padding: 12px 16px;
            border-radius: 6px;
            margin-bottom: 20px;
            border: 1px solid #f5c6cb;
        }
    </style>
</head>
<body>
    <div class="error-status">
        <strong>404 - Page Not Found</strong>
    </div>
    ${parsedHtml}
</body>
</html>`;

      // Inject sidebar
      const htmlWithSidebar = injectCompleteHtml(
        htmlContent,
        llmsJson,
        url.href,
        isLoading,
      );

      return new Response(htmlWithSidebar, {
        status: 404,
        headers: {
          "Content-Type": "text/html; charset=utf8",
          ...corsHeaders,
        },
      });
    } else {
      // Return plain markdown for non-HTML requests
      return new Response(notFoundText, {
        status: 404,
        headers: {
          "Content-Type": "text/markdown; charset=utf8",
          ...corsHeaders,
        },
      });
    }
  },
};
