import { parse, stringify } from "yaml";

import { getContextUrls } from "./getContextUrls";
import { getParams } from "./getParams";
import { getIsDefinitionFile } from "./getIsDefinitionFile";
import { pathToContextObject } from "./pathToContextObject";

/**
 * Domain authentication configuration. Can be either a bearer token string
 * or a boolean to use default nlang auth (GitHub PAT)
 */
type DomainAuth = string | boolean;

/**
 * Context configuration for retrieval step
 */
interface ContextConfig {
  prompt?: string;
  auth?: {
    [domain: string]: DomainAuth;
  };
  llmBasePath?: string;
  llmModelName?: string;
  llmApiKey?: string;
}

/**
 * Generation configuration for asset creation
 */
interface GenerationConfig {
  prompt?: string;
  customTargetInstructions?: {
    [extension: string]: string;
  };
  llmBasePath?: string;
  llmModelName?: string;
  llmApiKey?: string;
}

/**
 * Main NLang configuration type
 * @description Configuration can be defined in multiple locations:
 * 1. nlang default
 * 2. owner default at 'nlang-settings' repo nlang.yaml file
 * 3. repo default at nlang.yaml at root
 * 4. folder default at nlang.json in folder
 */
interface NLangConfig {
  /** Enable nlang compilation. Enabled by default for nlang-authenticated users.
   * For unauthenticated owner public repos, disabled by default.
   */
  enabled?: boolean;

  /** Context configuration for the context retrieval step */
  context?: ContextConfig;

  /** Generation configuration for creating new assets */
  generation?: GenerationConfig;
}

/**
 * A file-object describes a file hierarchy in any storage.
 */
export interface FileObject {
  size: {
    tokens?: number;
  };
  tree: Tree;
  /**
   * Mapped object where the keys are file- OR FOLDER-paths starting with '/'. Values are summaries of the file or folder. Not all paths need to be defined.
   */
  summary?: {
    [k: string]: string;
  };
  /**
   * The file object. Keys are filepaths starting with '/'.
   */
  files: {
    [k: string]: {
      type: "content" | "binary";
      /**
       * Size in bytes.
       */
      size: number;
      /**
       * Hash of the content that makes it easy to check for equality.
       */
      hash: string;
      /**
       * Can be either utf-8 content, or binary encoded as base-64 string.
       */
      content?: string;
      /**
       * GET URL resolving to the content
       */
      url?: string;
      /**
       * If content is in JSON, YAML, CSV, XML or other structured data format, the parsed data may be put here as JSON object
       */
      json?: {
        [k: string]: unknown;
      };
    };
  };
}
/**
 * Recursive object that describes the file hierarchy. Null is a leaf file. Folders always contain another tree.
 */
export interface Tree {
  [k: string]: null | Tree;
}

interface DependencyObject {
  [key: string]: {
    status: number;
    error?: string;
    resultUrl?: string;
    contextUrls?: string[];
    generationUrls?: string[];
  };
}

interface Env {
  // Add your environment variables here if needed
}

async function fetchWithAuth(
  url: string,
  apiKey: string | null,
): Promise<Response> {
  // important as it may be markdown (in cases such as uithub)
  const headers: HeadersInit = { Accept: "application/json" };

  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  return fetch(url, { headers });
}

async function parseConfigFile(url: string): Promise<any> {
  const response = await fetch(url);
  const contentType = response.headers.get("content-type");

  if (contentType?.includes("yaml")) {
    const yamlText = await response.text();
    // You would need to import a YAML parser here
    // return yaml.parse(yamlText);
    throw new Error("YAML parsing not implemented");
  } else {
    return response.json();
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    try {
      // Parse URL and verify method
      const url = new URL(request.url);

      // Get required parameters
      const fileObjectUrl = url.searchParams.get("fileObjectUrl");
      if (!fileObjectUrl) {
        return new Response("Missing required parameter: fileObjectUrl", {
          status: 400,
        });
      }

      // Get optional parameters
      const fileObjectApiKey = url.searchParams.get("fileObjectApiKey");
      let llmBasePath = url.searchParams.get("llmBasePath");
      let llmApiKey = url.searchParams.get("llmApiKey");
      let llmModelName = url.searchParams.get("llmModelName");
      // Not sure what this implicates making it optional. needs to be clear
      const originUrl =
        url.searchParams.get("originUrl") || "http://localhost:3000";

      // Fetch file object
      const fileObjectResponse = await fetchWithAuth(
        fileObjectUrl,
        fileObjectApiKey,
      );

      if (!fileObjectResponse.ok) {
        return new Response(
          `Failed to fetch file object: ${fileObjectResponse.statusText}`,
          {
            status: fileObjectResponse.status,
          },
        );
      }

      // Process file object and get dependencies
      const fileObject: FileObject = await fileObjectResponse.json();
      let config: NLangConfig | undefined = undefined;

      if (fileObject.files["/nlang.yaml"]?.content) {
        // root of file object

        config = await parse(fileObject.files["/nlang.yaml"].content);

        if (
          config &&
          config.context?.llmApiKey &&
          config.context.llmBasePath &&
          config.context.llmModelName
        ) {
          llmApiKey = config.context.llmApiKey;
          llmBasePath = config.context.llmBasePath;
          llmModelName = config.context.llmModelName;
        }
      }

      if (!llmApiKey || !llmBasePath || !llmModelName) {
        return new Response("Need LLM Parameters", { status: 400 });
      }

      // All files need to be analysed

      // NB: cloudflare hopefully automatically fixes the concurrency for this, if not, we may need to optimise this.
      const routeContext = await Promise.all(
        Object.keys(fileObject.files).map(async (route) => {
          if (!getIsDefinitionFile(route)) {
            // Only definition files
            return { route, status: 200 };
          }

          //it's a definition file. also add the infered files to the extradependencies
          const pathChunks = route.split("/");
          const filename = pathChunks.pop()!;
          const fileChunks = filename.split(".");
          const fileChunksReversed = fileChunks.reverse();
          const [ext, targetExt] = fileChunksReversed;

          const file = fileObject.files[route];

          const params: { [param: string]: string } = {
            origin: originUrl,
            ...getParams(route, route),
          };

          if (!file.content) {
            return { route, status: 400, error: "Route has no content" };
          }

          if (fileObjectApiKey) {
            params.apiKey = fileObjectApiKey;
          }

          const input = {
            content: file.content,
            originUrl,
            llmApiKey,
            llmBasePath,
            llmModelName,
            params,
            routeAtStep: route,
            targetExt,
          };
          console.log(`running getContextUrls`, input);
          const result = await getContextUrls(input);
          // NORMALISE THE ContextURLs so they are equal to the filepath
          result.contextUrls = result.contextUrls?.map((url) =>
            url.startsWith(originUrl) ? url.slice(originUrl.length) : url,
          );
          result.generationUrls = undefined;

          // result.generationUrls?.map((url) =>
          //   url.startsWith(originUrl) ? url.slice(originUrl.length) : url,
          // );

          console.log("result in", route, result);

          return { route, result, contextObject: pathToContextObject(route) };
        }),
      );

      const dependencies: DependencyObject = routeContext.reduce(
        (previous, { route, result, contextObject }) => ({
          ...previous,
          ...contextObject,
          [route]: {
            contextUrls: result?.contextUrls?.filter((x) => x !== route) || [],
            generated: false,
          },
        }),
        {},
      );

      // Determine response format based on Accept header
      const acceptHeader = request.headers.get("Accept");
      if (acceptHeader === "text/yaml") {
        return new Response(stringify(dependencies), {
          headers: { "Content-Type": "text/yaml" },
        });
      }

      // Default to JSON response
      return new Response(JSON.stringify(dependencies), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: any) {
      // Handle any unexpected errors
      return new Response(`Internal server error: ${error.message}`, {
        status: 500,
      });
    }
  },
};
