/// <reference types="@cloudflare/workers-types" />
/// <reference lib="esnext" />
//@ts-check

interface FootprintResult {
  title: string;
  description: string;
  meta: Record<string, string>;
  mime: string;
  type: "text" | "image" | "video";
  ogImageUrl: string | null;
  context: string | null;
  tokens: number;
  githubOwner: string | null;
  twitterUsername: string | null;
}

interface Env {
  FOOTPRINT_KV: KVNamespace;
}

const CACHE_TTL = 60 * 60 * 24; // 24 hours in seconds
const USER_AGENT = "CloudflareWorkerFootprint/1.0";

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    try {
      const url = new URL(request.url).searchParams.get("url");

      if (!url) {
        return new Response("Missing url parameter", { status: 400 });
      }

      // Try to get from KV cache first
      const cachedResult = await env.FOOTPRINT_KV.get(url, "json");
      let result: FootprintResult | null = null;

      if (cachedResult) {
        result = cachedResult as FootprintResult;

        // If cache exists but might be old, refresh it in the background
        const metadata = await env.FOOTPRINT_KV.getWithMetadata<{
          cacheTime: number;
        }>(url);
        const cacheTime = metadata.metadata?.cacheTime || 0;

        if (Date.now() - cacheTime > (CACHE_TTL * 1000) / 2) {
          ctx.waitUntil(fetchAndCache(url, env));
        }
      } else {
        // No cache, fetch fresh data
        result = await fetchAndProcessUrl(url);

        // Store in KV cache
        ctx.waitUntil(
          env.FOOTPRINT_KV.put(url, JSON.stringify(result), {
            metadata: { cacheTime: Date.now() },
          }),
        );
      }

      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(`Error: ${error.message}`, { status: 500 });
    }
  },
};

async function fetchAndCache(url: string, env: Env): Promise<void> {
  const result = await fetchAndProcessUrl(url);
  await env.FOOTPRINT_KV.put(url, JSON.stringify(result), {
    metadata: { cacheTime: Date.now() },
  });
}

async function fetchAndProcessUrl(url: string): Promise<FootprintResult> {
  // Try to fetch as HTML first
  const htmlResponse = await fetch(url, {
    headers: {
      Accept: "text/html,*/*",
      "User-Agent": USER_AGENT,
    },
  });

  const contentType = htmlResponse.headers.get("Content-Type") || "";
  const isHtml = contentType.includes("text/html");

  let result: FootprintResult = {
    title: "",
    description: "",
    meta: {},
    mime: contentType,
    type: "text",
    ogImageUrl: null,
    context: null,
    tokens: 0,
    githubOwner: null,
    twitterUsername: null,
  };

  // Determine content type
  if (contentType.includes("image/")) {
    result.type = "image";
  } else if (contentType.includes("video/")) {
    result.type = "video";
  } else {
    result.type = "text";
  }

  // Parse HTML if available
  if (isHtml) {
    const html = await htmlResponse.text();

    // Extract information from HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Title
    result.title = doc.querySelector("title")?.textContent || url;

    // Meta tags
    const metaTags = doc.querySelectorAll("meta");
    metaTags.forEach((tag) => {
      const name = tag.getAttribute("name") || tag.getAttribute("property");
      const content = tag.getAttribute("content");
      if (name && content) {
        result.meta[name] = content;
      }
    });

    // Description
    result.description =
      result.meta["description"] ||
      result.meta["og:description"] ||
      extractDescription(html) ||
      `Content from ${url}`;

    // OG Image
    result.ogImageUrl =
      result.meta["og:image"] || result.meta["twitter:image"] || null;

    // Twitter username
    result.twitterUsername =
      result.meta["twitter:creator"] ||
      result.meta["twitter:site"] ||
      extractTwitterUsername(url) ||
      null;

    // Text content
    const bodyText = extractTextContent(doc);
    result.context = bodyText;
    result.tokens = Math.ceil(bodyText.length / 5);
  } else {
    // For non-HTML content
    const responseClone = htmlResponse.clone();

    if (result.type === "text") {
      const text = await responseClone.text();
      result.context = text;
      result.tokens = Math.ceil(text.length / 5);
      result.description =
        text.substring(0, 200) + (text.length > 200 ? "..." : "");
    } else {
      result.context = null;
      result.tokens = 0;
      result.description = `${
        result.type.charAt(0).toUpperCase() + result.type.slice(1)
      } from ${url}`;
    }

    result.title = url.split("/").pop() || url;
  }

  // Extract GitHub owner if applicable
  result.githubOwner = extractGithubOwner(url);

  return result;
}

function extractTextContent(doc: Document): string {
  // Remove script and style elements
  const scripts = doc.querySelectorAll("script, style");
  scripts.forEach((el) => el.remove());

  // Get the main content
  const article =
    doc.querySelector("article") ||
    doc.querySelector("main") ||
    doc.querySelector("body");

  return article ? article.textContent?.trim() || "" : "";
}

function extractDescription(html: string): string {
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.substring(0, 200) + (text.length > 200 ? "..." : "");
}

function extractGithubOwner(url: string): string | null {
  const githubRegex = /github\.com\/([^\/]+)/;
  const match = url.match(githubRegex);
  return match ? match[1] : null;
}

function extractTwitterUsername(url: string): string | null {
  const twitterRegex = /twitter\.com\/([^\/]+)|x\.com\/([^\/]+)/;
  const match = url.match(twitterRegex);
  return match ? match[1] || match[2] : null;
}
