/// <reference types="@cloudflare/workers-types" />
/// <reference lib="esnext" />
//@ts-check

interface Env {
  FOOTPRINT_KV: KVNamespace;
}

interface FootprintData {
  title: string;
  description: string;
  meta: Record<string, string>;
  mime: string;
  type: "text" | "image" | "video";
  ogImageUrl?: string;
  context?: string;
  tokens?: number;
  githubOwner?: string;
  twitterUsername?: string;
  fetchedAt: number;
}

// HTML Rewriter handler for extracting meta information
class MetaHandler {
  title: string = "";
  description: string = "";
  meta: Record<string, string> = {};
  ogImageUrl: string = "";
  twitterUsername: string = "";

  element(element: Element) {
    // Handle title tag
    if (element.tagName === "title") {
      this.title = element.textContent;
    }

    // Handle meta tags
    if (element.tagName === "meta") {
      const name =
        element.getAttribute("name") || element.getAttribute("property");
      const content = element.getAttribute("content");

      if (name && content) {
        this.meta[name] = content;

        if (name === "description") {
          this.description = content;
        } else if (name === "og:image" || name === "twitter:image") {
          this.ogImageUrl = content;
        } else if (name === "twitter:creator" || name === "twitter:author") {
          this.twitterUsername = content.replace("@", "");
        }
      }
    }
  }
}

// Content handler for extracting text content
class ContentHandler {
  content: string = "";

  text(text: Text) {
    // Clean up text and append to content
    const cleanText = text.text.trim();
    if (cleanText) {
      this.content += " " + cleanText;
    }
  }
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url).searchParams.get("url");

    if (!url) {
      return new Response("URL parameter is required", { status: 400 });
    }

    // Create a cache key from the URL
    const cacheKey = `footprint:${url}`;

    // Try to get data from KV
    let cachedData: FootprintData | null = null;
    try {
      cachedData = await env.FOOTPRINT_KV.get(cacheKey, "json");
    } catch (error) {
      console.error("Error fetching from KV:", error);
    }

    // If we have cached data and it's not too old (24 hours)
    const now = Date.now();
    const MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    if (cachedData && now - cachedData.fetchedAt < MAX_AGE) {
      // If cache is getting old but still valid, refresh in the background
      if (now - cachedData.fetchedAt > MAX_AGE / 2) {
        ctx.waitUntil(fetchAndCache(url, env, cacheKey));
      }

      return new Response(JSON.stringify(cachedData, undefined, 2), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    // If no cache or cache is too old, fetch the data
    const footprintData = await fetchAndCache(url, env, cacheKey);

    return new Response(JSON.stringify(footprintData), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600",
      },
    });
  },
};

async function fetchAndCache(
  url: string,
  env: Env,
  cacheKey: string,
): Promise<FootprintData> {
  // First try to fetch as HTML
  let response = await fetchWithPreference(url, "text/html");

  // If not HTML, try markdown
  if (!response.headers.get("Content-Type")?.includes("text/html")) {
    const markdownResponse = await fetchWithPreference(url, "text/markdown");

    // Use markdown if we got it
    if (
      markdownResponse.headers.get("Content-Type")?.includes("text/markdown")
    ) {
      response = markdownResponse;
    }
  }

  const contentType = response.headers.get("Content-Type") || "*/*";
  const isHtml = contentType.includes("text/html");
  const isText =
    contentType.includes("text") ||
    contentType.includes("json") ||
    contentType.includes("javascript");
  const isImage = contentType.includes("image");
  const isVideo = contentType.includes("video");

  // Determine type
  let type: "text" | "image" | "video" = "text";
  if (isImage) type = "image";
  if (isVideo) type = "video";

  // Initialize data
  const footprintData: FootprintData = {
    title: "",
    description: "",
    meta: {},
    mime: contentType,
    type,
    fetchedAt: Date.now(),
  };

  // Parse github owner from URL if applicable
  const githubMatch = url.match(/github\.com\/([^\/]+)/);
  if (githubMatch) {
    footprintData.githubOwner = githubMatch[1];
  }

  // Parse twitter username from URL if applicable
  const twitterMatch = url.match(/twitter\.com\/([^\/]+)|x\.com\/([^\/]+)/);
  if (twitterMatch) {
    footprintData.twitterUsername = twitterMatch[1] || twitterMatch[2];
  }

  // Clone the response to reuse it
  const clonedResponse = response.clone();

  if (isHtml) {
    // Extract metadata using HTMLRewriter
    const metaHandler = new MetaHandler();
    const contentHandler = new ContentHandler();

    await new HTMLRewriter()
      .on("title", metaHandler)
      .on("meta", metaHandler)
      .on("body", contentHandler)
      .transform(response)
      .text();

    footprintData.title = metaHandler.title;
    footprintData.description = metaHandler.description;
    footprintData.meta = metaHandler.meta;
    footprintData.ogImageUrl = metaHandler.ogImageUrl;

    if (metaHandler.twitterUsername) {
      footprintData.twitterUsername = metaHandler.twitterUsername;
    }

    // Get content text for HTML
    footprintData.context = contentHandler.content.trim();
  } else if (isText) {
    // For non-HTML text, just get the content
    const text = await clonedResponse.text();
    footprintData.context = text;

    // Try to extract a title from the first line or response headers
    const firstLine = text.split("\n")[0].trim();
    footprintData.title = firstLine.length > 10 ? firstLine : response.url;

    // Create a description from the text
    footprintData.description =
      text.slice(0, 200).trim() + (text.length > 200 ? "..." : "");
  } else {
    // For non-text content, use the URL or filename as title
    const urlParts = new URL(url).pathname.split("/");
    const fileName = urlParts[urlParts.length - 1];
    footprintData.title = fileName || url;
    footprintData.description = `${
      type.charAt(0).toUpperCase() + type.slice(1)
    } content from ${url}`;
  }

  // Calculate token count for text content
  if (footprintData.context) {
    footprintData.tokens = Math.ceil(footprintData.context.length / 5);
  }

  // Store in KV
  try {
    await env.FOOTPRINT_KV.put(cacheKey, JSON.stringify(footprintData), {
      expirationTtl: 86400,
    });
  } catch (error) {
    console.error("Error storing in KV:", error);
  }

  return footprintData;
}

async function fetchWithPreference(
  url: string,
  preferredType: string,
): Promise<Response> {
  try {
    return await fetch(url, {
      headers: {
        Accept: `${preferredType}, */*;q=0.8`,
      },
      cf: {
        cacheTtl: 3600,
        cacheEverything: true,
      },
    });
  } catch (error) {
    console.error(
      `Error fetching ${url} with preference ${preferredType}:`,
      error,
    );
    // Fallback to standard fetch
    return fetch(url);
  }
}
