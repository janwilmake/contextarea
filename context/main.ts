/// <reference types="@cloudflare/workers-types" />
/// <reference lib="esnext" />
//@ts-check

interface Env {
  LINKS_KV: KVNamespace;
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
  timestamp: number;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url).searchParams.get("url");

    if (!url) {
      return new Response(
        JSON.stringify({ error: "URL parameter is required" }, null, 2),
        {
          headers: { "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    try {
      // Try to get from KV first
      const cacheKey = `footprint:${url}`;
      const cachedData = await env.LINKS_KV.get(cacheKey, "json");

      // If cache exists and is not too old (less than 24 hours)
      const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
      const now = Date.now();

      if (cachedData && now - cachedData.timestamp < CACHE_TTL) {
        return new Response(JSON.stringify(cachedData, null, 2), {
          headers: { "Content-Type": "application/json;charset=utf8" },
        });
      }

      // If cache is too old but exists, use it for now but update in the background
      if (cachedData) {
        ctx.waitUntil(fetchAndCache(url, env, cacheKey));
        return new Response(JSON.stringify(cachedData, null, 2), {
          headers: { "Content-Type": "application/json;charset=utf8" },
        });
      }

      // No cache, fetch and cache
      const footprint = await fetchAndProcess(url);
      await env.LINKS_KV.put(
        cacheKey,
        JSON.stringify({ ...footprint, timestamp: now }),
      );

      return new Response(JSON.stringify(footprint, null, 2), {
        headers: { "Content-Type": "application/json;charset=utf8" },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }, null, 2), {
        headers: { "Content-Type": "application/json;charset=utf8" },
        status: 500,
      });
    }
  },
};

async function fetchAndCache(
  url: string,
  env: Env,
  cacheKey: string,
): Promise<void> {
  try {
    const footprint = await fetchAndProcess(url);
    await env.LINKS_KV.put(
      cacheKey,
      JSON.stringify({ ...footprint, timestamp: Date.now() }),
    );
  } catch (error) {
    console.error("Background fetch error:", error);
  }
}

async function fetchAndProcess(url: string): Promise<FootprintData> {
  // Prepare headers for different content types
  const htmlHeaders = new Headers({
    Accept: "text/html, */*;q=0.8",
    "User-Agent": "CloudflareWorker/1.0",
  });

  const markdownHeaders = new Headers({
    Accept: "text/markdown",
    "User-Agent": "CloudflareWorker/1.0",
  });

  // Fetch both content types
  const htmlResponse = await fetch(url, { headers: htmlHeaders });
  const markdownResponse = await fetch(url, { headers: markdownHeaders });

  // Get content types
  const htmlContentType = htmlResponse.headers.get("Content-Type") || "";
  const markdownContentType =
    markdownResponse.headers.get("Content-Type") || "";

  console.log({ htmlContentType, markdownContentType });
  // Determine primary content type and response
  const isHtml = htmlContentType.includes("text/html");
  const isMarkdown =
    markdownContentType.includes("text/markdown") ||
    markdownContentType.includes("text/plain");

  let primaryContentType = htmlContentType;
  let type: "text" | "image" | "video" = "text";

  // Determine content type
  if (primaryContentType.includes("image/")) {
    type = "image";
  } else if (primaryContentType.includes("video/")) {
    type = "video";
  }

  // Extract data from HTML if available
  let title = "";
  let description = "";
  let meta: Record<string, string> = {};
  let ogImageUrl: string | undefined;
  let context: string | undefined;

  // Process HTML response for metadata
  if (isHtml) {
    const htmlClone = htmlResponse.clone();
    const htmlData = await extractHtmlData(htmlClone);
    title = htmlData.title;
    description = htmlData.description;
    meta = htmlData.meta;
    ogImageUrl = htmlData.ogImageUrl;

    // Also extract text content from HTML if needed
    if (type === "text" && !isMarkdown) {
      const htmlTextClone = htmlResponse.clone();
      context = await extractTextFromHtml(htmlTextClone);
    }
  } else {
    // If not HTML, use headers for title
    title = new URL(url).pathname.split("/").pop() || url;
  }

  // Get context from markdown if available
  if (type === "text") {
    if (isMarkdown) {
      context = await markdownResponse.text();
    } else if (!isHtml) {
      // If neither HTML nor markdown, just get text from the response
      try {
        context = await htmlResponse.text();
      } catch (e) {
        context = "Content could not be extracted";
      }
    }
  }

  // Calculate tokens if context exists
  const tokens = context ? Math.ceil(context.length / 5) : undefined;

  // Extract github owner and twitter username
  const githubOwner = extractGithubOwner(url);
  const twitterUsername =
    meta["twitter:creator"] ||
    meta["twitter:author"] ||
    extractTwitterUsername(url);

  // Create description if not available
  if (!description && context) {
    description =
      context.substring(0, 200) + (context.length > 200 ? "..." : "");
  }

  return {
    title,
    description,
    meta,
    mime: primaryContentType,
    type,
    ogImageUrl,
    tokens,
    githubOwner,
    twitterUsername,
    timestamp: Date.now(),
    context,
  };
}

async function extractHtmlData(response: Response): Promise<{
  title: string;
  description: string;
  meta: Record<string, string>;
  ogImageUrl?: string;
}> {
  let title = "";
  let description = "";
  let ogImageUrl: string | undefined;
  const meta: Record<string, string> = {};

  const rewriter = new HTMLRewriter()
    .on("title", {
      text(text) {
        title += text.text;
      },
    })
    .on("meta[name][content]", {
      element(element) {
        const name = element.getAttribute("name");
        const content = element.getAttribute("content");
        if (name && content) {
          meta[name] = content;
          if (name === "description") {
            description = content;
          }
        }
      },
    })
    .on("meta[property][content]", {
      element(element) {
        const property = element.getAttribute("property");
        const content = element.getAttribute("content");
        if (property && content) {
          meta[property] = content;
          if (property === "og:description") {
            description = description || content;
          }
          if (property === "og:title") {
            title = title || content;
          }
          if (property === "og:image") {
            ogImageUrl = content;
          }
        }
      },
    })
    .on('meta[name="twitter:image"][content]', {
      element(element) {
        const content = element.getAttribute("content");
        if (content) {
          meta["twitter:image"] = content;
          ogImageUrl = ogImageUrl || content;
        }
      },
    });

  await rewriter.transform(response).text();

  return { title, description, meta, ogImageUrl };
}

async function extractTextFromHtml(response: Response): Promise<string> {
  let textContent = "";

  const rewriter = new HTMLRewriter().on("body", {
    text(text) {
      textContent += text.text;
    },
  });

  await rewriter.transform(response).text();

  // Clean up text: remove excessive whitespace
  return textContent.replace(/\s+/g, " ").trim();
}

function extractGithubOwner(url: string): string | undefined {
  try {
    const urlObj = new URL(url);
    if (
      urlObj.hostname === "github.com" ||
      urlObj.hostname === "raw.githubusercontent.com"
    ) {
      const pathParts = urlObj.pathname.split("/").filter(Boolean);
      if (pathParts.length >= 1) {
        return pathParts[0];
      }
    }
    return undefined;
  } catch (e) {
    return undefined;
  }
}

function extractTwitterUsername(url: string): string | undefined {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname === "twitter.com" || urlObj.hostname === "x.com") {
      const pathParts = urlObj.pathname.split("/").filter(Boolean);
      if (
        pathParts.length >= 1 &&
        !["search", "hashtag", "explore", "home"].includes(pathParts[0])
      ) {
        return pathParts[0];
      }
    }
    return undefined;
  } catch (e) {
    return undefined;
  }
}
