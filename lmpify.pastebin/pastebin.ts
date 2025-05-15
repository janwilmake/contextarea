// Helper function to slugify text
function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove non-word chars
    .replace(/[\s_-]+/g, "-") // Replace spaces, underscores, hyphens with single hyphen
    .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
}

// Helper function to generate random string
function generateRandomString(length: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Helper function to extract key from URL path
function extractKeyFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/([^\/]+)$/);
  return match ? match[1] : null;
}

export default {
  async fetch(
    request: Request,
    env: { PASTEBIN_KV: KVNamespace },
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle POST to root
    if (request.method === "POST" && path === "/") {
      if (!request.body) {
        return new Response("No body provided", { status: 400 });
      }

      const reader = request.body.getReader();
      const decoder = new TextDecoder();

      let firstChunk = "";
      let first20Chars = "";
      let key = "";

      try {
        // Read until we get at least 20 characters
        while (firstChunk.length < 20) {
          const { done, value } = await reader.read();
          if (done) break;
          firstChunk += decoder.decode(value, { stream: true });
        }

        // Extract first 20 characters and create key
        first20Chars = firstChunk.substring(0, 20);
        const slug = slugify(first20Chars);
        const randomSuffix = generateRandomString(7);
        key = `${slug}-${randomSuffix}`;

        // Return the URL immediately
        const responseUrl = `${url.origin}/${key}`;

        // Stream the entire body to KV in the background
        ctx.waitUntil(
          (async () => {
            const chunks: Uint8Array[] = [];
            let totalSize = 0;
            const maxSize = 25 * 1024 * 1024; // 25MB

            // Add the first chunk we already read
            const firstChunkBytes = new TextEncoder().encode(firstChunk);
            chunks.push(firstChunkBytes);
            totalSize += firstChunkBytes.length;

            // Continue reading the rest of the stream
            try {
              while (totalSize < maxSize) {
                const { done, value } = await reader.read();
                if (done) break;

                if (totalSize + value.length > maxSize) {
                  // Trim the chunk to fit within the limit
                  const remainingSize = maxSize - totalSize;
                  chunks.push(value.slice(0, remainingSize));
                  totalSize = maxSize;
                  break;
                } else {
                  chunks.push(value);
                  totalSize += value.length;
                }
              }
            } catch (error) {
              console.error("Error reading stream:", error);
            }

            // Combine all chunks
            const fullContent = new Uint8Array(totalSize);
            let offset = 0;
            for (const chunk of chunks) {
              fullContent.set(chunk, offset);
              offset += chunk.length;
            }

            // Store in KV
            const textContent = decoder.decode(fullContent);
            await env.PASTEBIN_KV.put(key, textContent);
          })(),
        );

        return new Response(responseUrl, {
          status: 200,
          headers: {
            "Content-Type": "text/plain",
          },
        });
      } catch (error) {
        console.error("Error processing request:", error);
        return new Response("Error processing request", { status: 500 });
      }
    }

    // Handle GET /{key}
    if (request.method === "GET" && path !== "/") {
      const key = extractKeyFromPath(path);

      if (!key) {
        return new Response("Invalid key format", { status: 400 });
      }

      try {
        const content = await env.PASTEBIN_KV.get(key);

        if (content === null) {
          return new Response("Content not found", { status: 404 });
        }

        return new Response(content, {
          status: 200,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
          },
        });
      } catch (error) {
        console.error("Error retrieving content:", error);
        return new Response("Error retrieving content", { status: 500 });
      }
    }

    // Handle unsupported methods or paths
    return new Response("Method not allowed", { status: 405 });
  },
};
