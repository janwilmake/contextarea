/// <reference types="@cloudflare/workers-types" />
/// <reference lib="esnext" />
//@ts-check

/** NB: 7 is enough but by making it 15 it is more secure for sensitive data if we have millions of them entries */
const RANDOM_STRING_LENGTH = 15; //7
export default {
  async fetch(
    request: Request,
    env: { PASTEBIN_KV: KVNamespace },
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    // Handle CORS
    if (method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, HEAD, OPTIONS",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // Add CORS headers to all responses
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    };

    if (method === "POST" && url.pathname === "/") {
      return handlePost(request, env, ctx, corsHeaders);
    }

    if ((method === "GET" || method === "HEAD") && url.pathname.length > 1) {
      const key = url.pathname.substring(1);
      return handleGetOrHead(key, method, env, corsHeaders);
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },
};

function slugify(str: string) {
  return str
    .normalize("NFD") // Normalize accented characters
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .toLowerCase() // Convert to lowercase
    .trim() // Remove leading/trailing spaces
    .replace(/[^a-z0-9\s-]/g, "") // Remove invalid chars
    .replace(/\s+/g, "-") // Replace spaces with dashes
    .replace(/-+/g, "-") // Replace multiple dashes with single dash
    .replace(/^-+|-+$/g, ""); // Remove leading/trailing dashes
}

async function handlePost(
  request: Request,
  env: { PASTEBIN_KV: KVNamespace },
  ctx: ExecutionContext,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const MAX_SIZE = 25 * 1024 * 1024; // 25MB
  const body = request.body;

  if (!body) {
    return new Response("No body provided", {
      status: 400,
      headers: corsHeaders,
    });
  }

  // Create a stream to immediately return the URL
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // Start processing in background
  const processStream = async () => {
    try {
      const reader = body.getReader();
      const chunks: Uint8Array[] = [];
      let totalSize = 0;
      let contentType = request.headers.get("content-type");
      let isBinary = false;
      let isFirstChunk = true;

      // Read stream and determine content type
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        if (isFirstChunk && value) {
          isFirstChunk = false;

          // Determine if binary or text
          isBinary = !isValidUtf8(value);

          if (!contentType) {
            contentType = isBinary
              ? "application/octet-stream"
              : "text/plain;charset=utf8";
          }
        }

        if (value) {
          totalSize += value.length;

          // Check size limits
          if (isBinary && totalSize > MAX_SIZE) {
            await writer.write(
              encoder.encode("Error: Binary content exceeds 25MB limit")
            );
            await writer.close();
            return;
          }

          // For text, truncate at 25MB
          if (!isBinary && totalSize <= MAX_SIZE) {
            chunks.push(value);
          } else if (!isBinary && chunks.length > 0 && totalSize > MAX_SIZE) {
            // Calculate how much of the last chunk to keep
            const overflow = totalSize - MAX_SIZE;
            const lastChunk = chunks[chunks.length - 1];
            if (overflow < lastChunk.length) {
              chunks[chunks.length - 1] = lastChunk.slice(
                0,
                lastChunk.length - overflow
              );
            }
            break;
          } else if (isBinary) {
            chunks.push(value);
          }
        }
      }

      // Combine chunks
      const fullContent = concatenateUint8Arrays(chunks);

      // Generate key
      const key = generateKey(
        request.headers.get("filename"),
        contentType,
        isBinary
      );

      // Generate URL and send it immediately
      const url = `${new URL(request.url).origin}/${key}`;
      await writer.write(encoder.encode(url));

      // Store in KV
      ctx.waitUntil(
        env.PASTEBIN_KV.put(key, fullContent, {
          metadata: {
            contentType: contentType,
            size: fullContent.length,
          },
        })
      );

      await writer.close();
    } catch (error) {
      try {
        await writer.write(encoder.encode(`Error: ${error.message}`));
        await writer.close();
      } catch {}
    }
  };

  // Start processing
  processStream();

  return new Response(readable, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/plain;charset=utf8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function handleGetOrHead(
  key: string,
  method: string,
  env: { PASTEBIN_KV: KVNamespace },
  corsHeaders: Record<string, string>
): Promise<Response> {
  const { value, metadata } = await env.PASTEBIN_KV.getWithMetadata(key, {
    type: "arrayBuffer",
  });

  if (!value) {
    return new Response("Not Found", { status: 404, headers: corsHeaders });
  }

  const contentType =
    (metadata as any)?.contentType || "application/octet-stream";
  const size = (metadata as any)?.size || (value as ArrayBuffer).byteLength;

  const headers = {
    ...corsHeaders,
    "Content-Type": contentType,
    "Content-Length": size.toString(),
    "Cache-Control": "public, max-age=31536000",
  };

  if (method === "HEAD") {
    return new Response(null, { headers });
  }

  return new Response(value as ArrayBuffer, { headers });
}

function generateKey(
  filename: string | null,
  contentType: string | null,
  isBinary: boolean
): string {
  const randomPart = randomString(RANDOM_STRING_LENGTH);

  if (filename) {
    const extension = filename.split(".").pop();
    return `${slugify(filename.replace(/\.[^.]+$/, ""))}-${randomString(
      14
    )}.${extension}`;
  }

  if (!isBinary) {
    return `${randomPart}.md`;
  }

  return randomPart;
}

function randomString(length: number): string {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function isValidUtf8(buffer: Uint8Array): boolean {
  try {
    // Try to decode as UTF-8
    new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    return true;
  } catch {
    return false;
  }
}

function concatenateUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((acc, arr) => acc + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const array of arrays) {
    result.set(array, offset);
    offset += array.length;
  }

  return result;
}
