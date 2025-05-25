/// <reference types="@cloudflare/workers-types" />
/// <reference lib="esnext" />
//@ts-check

interface ParsedData {
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
}

interface Env {
  FOOTPRINT_KV: KVNamespace;
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
        },
      );
    }

    // Check KV for cached data
    const cacheKey = `footprint:${url}`;
    const cachedData = await env.FOOTPRINT_KV.get(cacheKey, "json");
    const cacheMetadata = await env.FOOTPRINT_KV.getWithMetadata(cacheKey);
    const cacheAge = cacheMetadata?.metadata?.timestamp
      ? Date.now() - cacheMetadata.metadata.timestamp
      : Infinity;

    // If cache is available and not too old (24 hours), use it
    if (cachedData && cacheAge < 24 * 60 * 60 * 1000) {
      // If cache is older than 1 hour, refresh it in the background
      if (cacheAge > 1 * 60 * 60 * 1000) {
        ctx.waitUntil(fetchAndProcessUrl(url, env, cacheKey));
      }
      return new Response(JSON.stringify(cachedData, null, 2), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Otherwise fetch and process the URL
    const data = await fetchAndProcessUrl(url, env, cacheKey);

    return new Response(JSON.stringify(data, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  },
};

async function fetchAndProcessUrl(
  url: string,
  env: Env,
  cacheKey: string,
): Promise<ParsedData> {
  // Perform two fetches: one for HTML and one for Markdown
  const [htmlResponse, markdownResponse] = await Promise.all([
    fetch(url, {
      headers: {
        Accept: "text/html, */*",
        "User-Agent": "CloudflareWorkerFootprint/1.0",
      },
    }),
    fetch(url, {
      headers: {
        Accept: "text/markdown, */*",
        "User-Agent": "CloudflareWorkerFootprint/1.0",
      },
    }),
  ]);

  // Clone responses to work with them multiple times
  const htmlResponseClone = htmlResponse.clone();
  const markdownResponseClone = markdownResponse.clone();

  const htmlContentType = htmlResponse.headers.get("Content-Type") || "";
  const markdownContentType =
    markdownResponse.headers.get("Content-Type") || "";

  // Determine the primary mime type
  const mime = htmlContentType.includes("text/html")
    ? htmlContentType.split(";")[0]
    : markdownContentType.split(";")[0];

  // Determine content type
  let type: "text" | "image" | "video" = "text";
  if (mime.startsWith("image/")) {
    type = "image";
  } else if (mime.startsWith("video/")) {
    type = "video";
  }

  // Initialize the result object
  const result: ParsedData = {
    title: "",
    description: "",
    meta: {},
    mime,
    type,
    ogImageUrl: undefined,
    context: undefined,
    tokens: undefined,
    githubOwner: undefined,
    twitterUsername: undefined,
  };

  // Extract GitHub owner if applicable
  if (url.includes("github.com")) {
    const matches = url.match(/github\.com\/([^\/]+)/);
    if (matches && matches[1]) {
      result.githubOwner = matches[1];
    }
  }

  // Extract Twitter username if applicable
  if (url.includes("twitter.com") || url.includes("x.com")) {
    const matches = url.match(/(?:twitter|x)\.com\/([^\/]+)/);
    if (
      matches &&
      matches[1] &&
      !["search", "hashtag", "explore"].includes(matches[1])
    ) {
      result.twitterUsername = matches[1];
    }
  }

  // Process HTML content if available
  if (htmlContentType.includes("text/html")) {
    const htmlData = await processHtmlContent(htmlResponseClone);
    Object.assign(result, htmlData);
  } else {
    // Use basic metadata from response if not HTML
    result.title = new URL(url).pathname.split("/").pop() || url;
    result.description = `Content from ${url}`;
  }

  // Get the text content, preferring markdown if available
  if (type === "text") {
    let textContent = "";

    if (markdownContentType.includes("text/markdown")) {
      textContent = await markdownResponseClone.text();
    } else if (htmlContentType.includes("text/html")) {
      // Extract text from HTML if markdown is not available
      const htmlText = await htmlResponseClone.text();
      textContent = extractTextFromHtml(htmlText);
    } else {
      // Fallback to any text content
      try {
        textContent = await htmlResponseClone.text();
      } catch (e) {
        textContent = "Unable to extract text content";
      }
    }

    result.context = textContent;
    result.tokens = Math.ceil(textContent.length / 5);
  }

  // Store the result in KV with metadata
  await env.FOOTPRINT_KV.put(cacheKey, JSON.stringify(result), {
    metadata: { timestamp: Date.now() },
  });

  return result;
}

async function processHtmlContent(
  response: Response,
): Promise<Partial<ParsedData>> {
  const result: Partial<ParsedData> = {
    title: "",
    description: "",
    meta: {},
    ogImageUrl: undefined,
    twitterUsername: undefined,
  };

  const metaTags: Record<string, string> = {};

  // Process HTML with HTMLRewriter
  const rewriter = new HTMLRewriter()
    .on("title", {
      text(text) {
        result.title = (result.title || "") + text.text;
      },
    })
    .on("meta", {
      element(element) {
        const name =
          element.getAttribute("name") || element.getAttribute("property");
        const content = element.getAttribute("content");

        if (name && content) {
          metaTags[name] = content;

          if (name === "description") {
            result.description = content;
          } else if (name === "og:image" || name === "twitter:image") {
            result.ogImageUrl = content;
          } else if (name === "twitter:creator" || name === "twitter:author") {
            result.twitterUsername = content.replace("@", "");
          }
        }
      },
    });

  await rewriter.transform(response).arrayBuffer();

  result.meta = metaTags;

  return result;
}

function extractTextFromHtml(html: string): string {
  // Simple text extraction logic
  // Remove HTML tags, scripts, styles
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
