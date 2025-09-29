import dependencies from "./dependencies";
import { resolveDefinitionFile } from "./resolveDefinitionFile";
import { CompileContext } from "./types";

interface FilenamePair {
  inferred: string;
  original: string;
}

type Json = string | null | number | boolean | Json[] | { [key: string]: Json };

/**
 * Should be a file object that determines the shadow rules.
 *
 * It's allowed to overwrite the original path too, or put stuff in entirely new locations.
 *
 * It's conventional to respond with a {$ref} Json object, but you can also already return any content (if its available)
 *
 * It's possible to remove any original file by returning 'null' as the paths value.
 */
type Shadow = { [path: string]: Json };

type ShadowContext = {
  files: {
    /** Arary of paths that can be routed to by a browser for this zip */
    path: string;
    /** if made available, could help to improve cache efficiency*/
    hash?: string;
  }[];
  /** can be used to retrieve the file content if needed */
  host: string;
  /** can be used to determine cached result if available */
  hash?: string;
};

const shadow = async (request: Request) => {
  const url = new URL(request.url);
  const json: ShadowContext = await request.json();
  const { files, host } = json;

  const createUnstackRefs = true;
  const removeExtensionDefintions = false;

  const deleted: string[] = [];

  const shadow = files.reduce((shadow, file) => {
    const segments = file.path.split("/").filter(Boolean);
    let folderPath = segments.slice(0, segments.length - 1).join("/");
    folderPath = folderPath === "" ? "" : "/" + folderPath;

    const lastSegment = segments[segments.length - 1];

    const isDefinitionFile = getIsDefinitionFile(lastSegment);

    if (!isDefinitionFile || !createUnstackRefs) {
      return shadow;
    }

    // For each unstacked filename, add $ref:"https://api.nlang.dev/unstack/URL" where URL is the original URL
    const stackItems = parseFilenameExtensions(lastSegment);

    const added = stackItems.reduce(
      (shadow, item) => ({
        ...shadow,
        [folderPath + "/" + item.inferred]: {
          $ref: `${url.origin}/unstack/${host}${folderPath}/${item.original}`,
        },
      }),
      {} as Shadow,
    );

    if (isDefinitionFile && removeExtensionDefintions) {
      // don't store this file
      console.log("not storing ", lastSegment);
      deleted.push(folderPath + "/" + lastSegment);
    }

    if (Object.keys(added).length === 0) {
      return shadow;
    }

    return Object.assign(shadow, added);
  }, {} as Shadow);

  return new Response(JSON.stringify({ shadow, deleted }, undefined, 2), {
    status: 200,
    headers: { "Content-Type": "applicatioin/json" },
  });
};
/**
 * Parses a filename with multiple extensions and returns an array of inferred and original filenames
 * For example: "index.html.md.js" -> [
 *   { inferred: "index.html", original: "index.html.md" },
 *   { inferred: "index.html.md", original: "index.html.md.js" }
 * ]
 *
 */
function parseFilenameExtensions(filename: string): FilenamePair[] {
  // Input validation
  if (!filename) {
    throw new Error("Filename cannot be empty");
  }

  const parts = filename.split(".");

  // If there are less than 3 parts (name + 2 extensions), return empty array
  if (parts.length < 3) {
    return [];
  }

  const result: FilenamePair[] = [];

  // Start from the third-to-last part and work forwards
  for (let i = 0; i < parts.length - 2; i++) {
    const inferredParts = parts.slice(0, parts.length - i - 1);
    const originalParts = parts.slice(0, parts.length - i);

    result.push({
      inferred: inferredParts.join("."),
      original: originalParts.join("."),
    });
  }

  // Reverse the array to match the expected output order
  return result.reverse();
}

const prependProtocol = (maybeFullUrl: string, protocol: string): string => {
  if (maybeFullUrl.startsWith("http://")) {
    return maybeFullUrl;
  }
  if (maybeFullUrl.startsWith("https://")) {
    return maybeFullUrl;
  }
  return protocol + "//" + maybeFullUrl;
};
export const allowedDefinitionExtensions = ["url", "md", "ts", "js"];

export const getIsDefinitionFile = (filename: string) => {
  const fileChunksReversed = filename.split(".").reverse();
  const lastChunk = fileChunksReversed[0];
  const isDefinitionFile =
    allowedDefinitionExtensions.includes(lastChunk) &&
    fileChunksReversed.length > 2;
  return isDefinitionFile;
};

export default {
  fetch: async (request: Request, env: Env, ctx: any) => {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/transformRoute") {
      const json = await request.json();
      console.log("compile request", json);
      const { stack, error } = await resolveDefinitionFile(json);

      if (error || !stack) {
        return new Response(error || "No stack", { status: 400 });
      }

      return new Response(JSON.stringify(stack, undefined, 2), {
        status: 200,
      });
    }

    if (request.method === "POST" && url.pathname === "/shadow") {
      return shadow(request);
    }

    if (request.method === "GET" && url.pathname.startsWith("/unstack/")) {
      // e.g. https://api.nlang.dev/unstack
      const apiKey = request.headers
        .get("Authorization")
        ?.slice("Bearer ".length);

      const unstackPath = (path: string) => {
        const filename = path.split("/").pop()!;
        const filenameChunkCount = filename.split(".").length;
        if (filenameChunkCount <= 2) {
          return;
        }
        const chunks = path.split(".");
        const neededChunks = chunks.slice(0, chunks.length - 1);
        const newPath = neededChunks.join(".");
        return newPath;
      };

      const stackUrl = prependProtocol(
        decodeURIComponent(
          request.url.slice((url.origin + "/unstack/").length),
        ),
        url.protocol,
      );

      const stackUrlObj = new URL(stackUrl);
      const originUrl = stackUrlObj.origin;
      const originalPath = stackUrl.slice(originUrl.length);
      const path = unstackPath(originalPath);

      if (!path) {
        return new Response("No unstackable path", { status: 400 });
      }
      console.log({ stackUrl, path, originalPath, originUrl });

      const response = await fetch(stackUrl, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
      });

      if (!response.ok) {
        return new Response("Couldn't get stackfile", { status: 400 });
      }

      const content = await response.text();

      let llmApiKey = "",
        llmBasePath = "",
        llmModelName = "";

      const compileContext: CompileContext = {
        content,
        llmApiKey,
        llmBasePath,
        llmModelName,
        originalPath,
        originApiKey: apiKey,
        originUrl,
        path,
        route: originalPath,
      };
      console.log(compileContext);

      return new Response(JSON.stringify({ compileContext }, undefined, 2));
      //      resolveDefinitionFile();
    }

    if (request.method === "GET" && url.pathname === "/transform") {
      // TODO: transform all routes
      return new Response("Coming soon");
    }

    if (request.method === "GET" && url.pathname === "/dependencies") {
      return dependencies.fetch(request, env, ctx);
    }

    return new Response("Method not allowed", {
      status: 302,
      headers: { Location: url.origin + "/index.html" },
    });
  },
};
