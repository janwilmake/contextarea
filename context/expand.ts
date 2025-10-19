// NB: this is old

export interface Env {
  // Add environment variables here if needed
}

// Types
type UrlExpandPolicy =
  | "expand"
  | "expand-leading"
  | "expand-recursive"
  | "ignore";

interface ExpandUrlConfig {
  urlExpandPolicy: UrlExpandPolicy;
  maxTokens: number;
  maxAge: number;
  staleWhileRevalidate?: number;
}

interface UrlContext {
  url: string;
  content: string | null;
}

// URL extraction functions
const findUrls = (content: string): string[] => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = content.match(urlRegex) || [];
  const uniqueUrls = Array.from(new Set(matches));
  return uniqueUrls;
};

const findLeadingUrls = (content: string): string[] => {
  const sections = content.split(/\n\s*\n/);
  const leadingSection = sections[0];
  const urls = findUrls(leadingSection);
  return urls;
};

const getUrlsBasedOnPolicy = (
  content: string,
  policy: UrlExpandPolicy,
): string[] => {
  switch (policy) {
    case "expand":
      return findUrls(content);
    case "expand-leading":
      return findLeadingUrls(content);
    case "ignore":
      return [];
    default:
      return [];
  }
};

// Context fetching with graceful error handling
const fetchUrlContext = async (
  url: string,
  maxAge: number,
  staleWhileRevalidate?: number,
): Promise<string | null> => {
  const cacheControl = `max-age=${maxAge}${
    staleWhileRevalidate
      ? `, stale-while-revalidate=${staleWhileRevalidate}`
      : ""
  }`;

  console.log({ url });
  try {
    const response = await fetch(
      `https://llmtext.com/${encodeURIComponent(url)}`,
      {
        headers: { "Cache-Control": cacheControl },
      },
    );

    if (!response.ok) {
      console.log("NOT OK", await response.text());
      return null;
    }

    return await response.text();
  } catch {
    return null;
  }
};

// Token size management
const calculateTokens = (text: string): number => {
  return Math.ceil(text.length / 5);
};

const distributeTokens = (
  urls: string[],
  totalTokens: number,
  originalContent: string,
): number => {
  const contentWithoutUrls = urls.reduce(
    (acc, url) => acc.replace(url, ""),
    originalContent,
  );
  const baseTokens = calculateTokens(contentWithoutUrls);
  const availableTokens = Math.max(0, totalTokens - baseTokens);
  return Math.floor(availableTokens / urls.length);
};

const truncateContext = (context: string, maxTokens: number): string => {
  const tokens = calculateTokens(context);
  if (tokens <= maxTokens) return context;

  const targetLength = maxTokens * 5;
  const truncated = context.slice(0, targetLength);
  const lastSpace = truncated.lastIndexOf(" ");
  return truncated.slice(0, lastSpace) + "...";
};

const expandUrls = async (
  messageContent: string,
  config: ExpandUrlConfig,
): Promise<string> => {
  const urls = getUrlsBasedOnPolicy(messageContent, config.urlExpandPolicy);
  if (urls.length === 0) return messageContent;

  const tokensPerUrl = distributeTokens(urls, config.maxTokens, messageContent);
  console.log({ tokensPerUrl });
  if (tokensPerUrl <= 0) return messageContent;

  const urlContexts: UrlContext[] = await Promise.all(
    urls.map(async (url) => ({
      url,
      content: await fetchUrlContext(
        url,
        config.maxAge,
        config.staleWhileRevalidate,
      ),
    })),
  );

  let expandedContent = messageContent;
  for (const { url, content } of urlContexts) {
    if (content?.trim()) {
      const truncatedContext = truncateContext(content, tokensPerUrl);
      expandedContent =
        expandedContent +
        `${"-".repeat(40)}\n${url}\n${"-".repeat(
          40,
        )}\n${truncatedContext}\n${"-".repeat(40)}\n\n`;
    }
  }

  return expandedContent;
};

// Default configuration
const DEFAULT_CONFIG: ExpandUrlConfig = {
  urlExpandPolicy: "expand",
  maxTokens: 50000,
  maxAge: 86400,
  staleWhileRevalidate: 365 * 86400,
};

const parseConfig = (
  headers: Headers,
  searchParams: URLSearchParams,
): ExpandUrlConfig => {
  const config = { ...DEFAULT_CONFIG };

  // Parse urlExpandPolicy
  const policy = searchParams.get("policy");
  if (
    policy &&
    ["expand", "expand-leading", "expand-recursive", "ignore"].includes(policy)
  ) {
    config.urlExpandPolicy = policy as UrlExpandPolicy;
  }

  // Parse maxTokens
  const maxTokens = searchParams.get("maxTokens");
  if (maxTokens) {
    const tokens = parseInt(maxTokens, 10);
    if (!isNaN(tokens) && tokens > 0) {
      config.maxTokens = tokens;
    }
  }

  // Parse maxAge
  const maxAge1 = parseInt(
    headers.get("Cache-Control")?.match(/max-age=(\d+)/i)?.[1] ||
      searchParams.get("max-age") ||
      "0",
    10,
  );
  const maxAge = isNaN(maxAge1) ? 0 : maxAge1;

  if (maxAge > 0) {
    config.maxAge = maxAge;
  }

  // Parse staleWhileRevalidate
  const stale1 = parseInt(
    headers.get("Cache-Control")?.match(/stale-while-revalidate=(\d+)/i)?.[1] ||
      searchParams.get("stale-while-revalidate") ||
      "0",
    10,
  );
  const stale = isNaN(stale1) ? 0 : stale1;

  if (stale > 0) {
    config.staleWhileRevalidate = stale;
  }

  return config;
};

// Worker handler
export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    // Only allow GET requests
    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }

    try {
      // Parse the URL and query parameters
      const url = new URL(request.url);
      const config = parseConfig(request.headers, url.searchParams);

      // Get the message from the URL path
      const encodedMessage = url.pathname.slice(1); // Remove leading slash

      if (!encodedMessage) {
        return new Response("Message is required", { status: 400 });
      }

      // Decode the URL-encoded message
      const message = decodeURIComponent(encodedMessage);
      console.log("valid request", { message, config });

      // Expand URLs in the message
      const expandedContent = await expandUrls(message, config);

      // Return the expanded content with the configuration used
      return new Response(expandedContent, {
        headers: {
          "Content-Type": "text/markdown;charset=utf8",
          "Cache-Control": `max-age=${config.maxAge}`,
        },
      });
    } catch (error) {
      console.error("Error processing request:", error);
      return new Response(
        JSON.stringify({
          error: "Internal server error",
          message: error instanceof Error ? error.message : "Unknown error",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }
  },
};
