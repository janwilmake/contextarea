import { fetchWithTimeout } from "./fetchWithTimeout";

/**
 * Scrapes URLs to add to context:
 * - adds images as markdown embed
 * - optionally provides authentication before scraping
 * - has a timeout of 5 minutes max
 * - will only process text/application/image content-types
 * - handles errors for urls that didn't work
 */
export const tryScrapeUrls = async (
  urls: string[],
  originUrl: string,
  originApiKey?: string,
) => {
  const content = await Promise.all(
    urls.map(async (url) => {
      try {
        // All these origins should take an Authorization header that can be a github token.
        const isAuthedOrigin = !![
          originUrl,
          "https://nachocache.com",
          "https://strongturns.com",
          "https://openapisearch.com",
          "https://quickog.com",
          "https://llmtext.com",
        ].find((u) => new URL(url).origin === u);

        const headers =
          isAuthedOrigin && originApiKey
            ? { Authorization: `Bearer ${originApiKey}` }
            : undefined;

        const scrapeResponse = await fetchWithTimeout(url, {
          timeout: 300000,
          headers,
        });

        const contentType = scrapeResponse.headers.get("content-type");

        if (!scrapeResponse.ok) {
          return {
            url,
            error: contentType?.includes("text/html")
              ? scrapeResponse.statusText
              : await scrapeResponse.text(),
            status: scrapeResponse.status,
          };
        }

        const isImage = contentType?.startsWith("image/");
        const isText =
          contentType?.startsWith("text/") ||
          contentType?.startsWith("application/");

        if (!isText && !isImage) {
          return {
            url,
            error: `Unprocessable content-type: ${contentType}`,
            status: 400,
          };
        }

        const content = isText
          ? await scrapeResponse.text()
          : `![IMAGE](${url})`;

        return {
          url,
          status: 200,
          content,
          isImage,
        };
      } catch (e: any) {
        return {
          url,
          status: 500,
          error: `Something went wrong scraping URL: ${e.message}`,
        };
      }
    }),
  );

  const contextUrlErrors = content.filter((x) => x.error);

  const systemContext = content
    .filter((x) => x.content)
    .map((c) =>
      c.isImage
        ? `-----------\n${c.content}\n-----------`
        : `-----------${c.url}\n-------------\n${c.content}`,
    )
    .join("\n\n");

  return { contextUrlErrors, systemContext };
};
