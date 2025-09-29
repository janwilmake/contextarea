import { mapMany, notEmpty, oneByOne } from "edge-util";
import htmlFor401 from "./401.html";
import htmlForResolve from "./resolve.html";
import { promptSuffixes } from "./constants.js";

export type ContentType =
  | {
      type: "content";
      content: string;
      url: undefined;
      hash: string;
      size: number;
    }
  | {
      type: "binary";
      url: string;
      content: undefined;
      hash: string;
      size: number;
    };

// Types
export type InsertEdit = {
  type: "insert";
  content: string;
  /** Will insert "content" BEFORE this line (pushing down existing line)*/
  lineNumber: number;
};

export type RemoveEdit = {
  type: "remove";
  /** Start removing from this line */
  fromLineNumber: number;
  /** Remove up to BUT NOT INCLUDING this line */
  toLineNumber: number;
};

export type PushFileOperation =
  | { type: "remove"; path: string }
  | {
      type: "set";
      path: string;
      content?: string;
      isBase64?: boolean;
      url?: string;
    }
  | {
      type: "edit";
      path: string;
      /** If given, all updates will be applied to current file */
      edits?: (InsertEdit | RemoveEdit)[];
      /** If given, will move the file to this new path */
      movePath?: string;
    };

export type PushFileObject = {
  [path: string]: Omit<PushFileOperation, "path">;
};

// Stream Response Types
type StreamInfo = {
  type: "info";
  message?: string;
  info?: {
    iteration: number;
    inputTokenCount: number;
    oututTokenCount: number;
    matchCount: number;
  };
};

type StreamOperation = {
  type: "operation";
  operation: PushFileOperation;
};

type StreamFinal = {
  type: "final";
  fileObject: PushFileObject;
};

type StreamError = {
  type: "error";
  status: number;
  error: string;
};

export type StreamResponse =
  | StreamInfo
  | StreamOperation
  | StreamFinal
  | StreamError;

export type FileObject = { [path: string]: ContentType };
// Context type
export type ResolverContext = {
  llmBasePath: string;
  llmApiKey: string;
  llmModelName: string;
  prompt: string;
  files: FileObject;
  controller: any;
};

export interface LLMConfig {
  basePath: string;
  apiKey: string;
  modelName: string;
}

export interface LLMRequest {
  messages: Array<{ role: string; content: string }>;
  stream?: boolean;
}

export interface LLMResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export const getCookie = (request: Request, key: string) => {
  const cookiesObject = request.headers
    .get("Cookie")
    ?.split(";")
    .filter((x) => x.includes("="))
    .map((x) => x.trim().split("=") as [string, string])
    .reduce(
      (previous, [key, value]) => ({ ...previous, [key]: value }),
      {} as { [key: string]: string },
    );
  // console.log({ cookiesObject });
  const cookie = cookiesObject?.[key];
  if (!cookie) {
    return;
  }
  return decodeURIComponent(cookie);
};

export type Route = {
  path: string;
  params: { [key: string]: string };
  type: "openapi" | "prompt" | "code" | "openapi-html";
};
/** Simple resolver that allows for things like api/[product]/[id]/index.html to be resolved. */
export const resolvePathnamePart = (
  pathname: string,
  paths: string[],
): Route | null => {
  const type = pathname.endsWith(".ts.html")
    ? "openapi-html"
    : pathname.endsWith(".openapi.json")
    ? "openapi"
    : promptSuffixes.find((x) => pathname.endsWith(x))
    ? "prompt"
    : "code";

  const realPathname =
    type === "openapi-html"
      ? pathname.slice(0, pathname.length - ".ts.html".length)
      : type === "openapi"
      ? pathname.slice(0, pathname.length - ".openapi.json".length)
      : type === "prompt"
      ? pathname.slice(0, pathname.length - ".md".length)
      : pathname;

  const routes = paths.reduce((previous, path) => {
    // only exception for .ts
    const withoutTs = path.endsWith(".ts")
      ? path.slice(0, path.length - 3)
      : path;

    const pattern = "^" + withoutTs.replace(/\[(\w+)\]/g, "(?<$1>[^/]+)") + "$";
    return { ...previous, [path]: pattern };
  }, {} as { [key: string]: string });

  for (const [path, pattern] of Object.entries(routes)) {
    const match = realPathname.match(new RegExp(pattern));
    if (match) {
      const params = match.groups || {};
      return { path, params, type };
    }
  }

  return null; // Return null if no match is found
};

export const resolvePathname = (pathname: string, paths: string[]) => {
  const withIndex = pathname.endsWith("/")
    ? pathname + "index.html"
    : pathname + "/index.html";

  const details =
    resolvePathnamePart(pathname, paths) ||
    // look at this if the pathname wasn't found
    resolvePathnamePart(withIndex, paths);

  return details;
};

export type WorkflowFile<T> = {
  hasChanges: boolean;
  dependencies?: string[];
  file?: T;
};

/** Effiently finds all items that it must run in parallel to ensure nothing becomes stale in the end, while not getting caught in any loops. */
export const calculateWorkflow = <T>(files: {
  [path: string]: WorkflowFile<T>;
}) => {
  const workflow: string[][] = [];
  //console.log(`start: ${Object.keys(files).length} files`);
  while (true) {
    const remove = Object.keys(files).filter((path) => {
      return (
        // has no dependencies or deps dont exist (anymore)
        !files[path].dependencies?.length
      );
    });

    const changes = remove.filter((path) => {
      // has changes
      return files[path].hasChanges;
    });

    remove.map((path) => {
      delete files[path];
    });

    Object.keys(files).map((path) => {
      if (files[path].dependencies?.find((d) => changes.find((x) => x === d))) {
        // all changes files turn its dependants stale
        files[path].hasChanges = true;
      }

      // all removed items cannot be dependencies anymore
      files[path].dependencies = files[path].dependencies?.filter(
        (x) => !remove.includes(x),
      );
    });

    if (remove.length === 0) {
      // basecase
      // console.log("nothing removed. end loop.");
      const hasFilesLeft = Object.keys(files).length > 0;
      return {
        workflow,
        unprocessedPaths: hasFilesLeft ? Object.keys(files) : undefined,
      };
    }
    // console.log(
    //   `remove=${remove.join(",")}, changes=${changes.join(",")}, ${
    //     Object.keys(files).length
    //   } files left`,
    // );

    if (changes.length) {
      workflow.push(changes);
    }
  }
};

/**
 * Metadata structure for repos_code vectors
 */
export interface ReposCodeMetadata {
  id: string;
  owner: string;
  repo: string;
  branch: string;
  path: string;
  promptPath: string | null;

  /** The extension of the file */
  ext: string;
  /** Key-value pairs needed in the code (only for backend code) */
  env?: { [key: string]: string };
  /** The actual source code (not needed for assets) */
  code?: string;
  /** piece of typescript for second-order generations*/
  script?: string;
  errors?: any[];
  /** Summary of the file's purpose */
  summary: string;
  /** The requirements of the code in natural language */
  prompt: string;
  source: "prompt" | "code";

  /** The OpenAPI Document JSON (only for backend code) */
  openapi?: object;
  /** Indicates if the sourcecode is private */
  private: boolean;
  /** Unix timestamp of creation */
  createdAt: number;
  /** Unix timestamp of last update */
  updatedAt: number;

  /** URL to an asset  */
  url?: string;

  fileDependencies?: Route[];

  /** Allow for continuous deployment of this script, e.g. every hour, every day, or every week. */
  cron?: string;
  /** should follow from cron*/
  cronMessageId?: string;

  /** API Dependencies of this code */
  apiDependencies?: { openapiUrl: string; operationId: string }[];
}

type SetFileItem = Partial<ReposCodeMetadata> & { deleted: boolean };
const calculateFile = (
  path: string,
  zipballContents: any,
  branch: string,
  repo: string,
  owner: string,
  isDeleted: boolean,
) => {
  const { promptSuffix, codePath, promptPath, ext } = getPromptSuffix(path);

  const code =
    zipballContents.result[codePath]?.type === "content"
      ? zipballContents.result[codePath].content
      : undefined;

  const prompt =
    zipballContents.result[promptPath]?.type === "content"
      ? zipballContents.result[promptPath].content
      : undefined;

  const url =
    zipballContents.result[path]?.type === "url"
      ? zipballContents.result[path].url
      : undefined;

  const setFile: SetFileItem = {
    branch,
    repo,
    owner,

    // path is the codepath always
    path: codePath,
    promptPath: promptPath,

    // ext is the extension of the code
    ext,

    // prompt and code may both be there
    prompt,

    code,

    // raw githubusercontent url for asset-files, using githubs distinction
    url,

    deleted: isDeleted,

    // If we have it here, it's been updated now. Don't set createdAt here, can be left the same unless it changed.
    updatedAt: Date.now(),
  };

  return setFile;
};
const prependSlash = (path: string) =>
  path.slice(0, 1) === "/" ? path : "/" + path;

export const getPromptSuffix = (path: string) => {
  const slashedPath = prependSlash(path);
  const chunks = slashedPath.split("/").pop()!.split(".");

  // most specific prompt suffix
  const promptSuffix = promptSuffixes.find((suffix) =>
    slashedPath.endsWith(suffix),
  );

  const ext = promptSuffix
    ? promptSuffix.split(".")[1]
    : chunks.length > 1
    ? chunks.pop()
    : "";

  const codePath = promptSuffix
    ? slashedPath.slice(0, slashedPath.length - promptSuffix.length) + "." + ext
    : slashedPath;

  const promptPath = promptSuffix ? slashedPath : slashedPath + ".md";

  return {
    promptSuffix,
    codePath,
    promptPath,
    ext,
  };
};

const respondWith401 = async (response: Response) => {
  // html unauthorized page
  const text = await response.text();
  const html401 = htmlFor401.replace("</pre>", text + "</pre>");
  response.headers.set("Content-Type", "text/html");
  return new Response(html401, {
    headers: new Headers(response.headers),
    status: response.status,
  });
};

const parseResult = (operations: PushFileOperation[]): string =>
  operations
    .map(
      (operation) =>
        `\`\`\`json\n${JSON.stringify(operation, undefined, 2)}\n\`\`\`\n\n`,
    )
    .join("\n\n");

const createEnqueueJson = (controller: any) => (json: StreamResponse) =>
  controller.enqueue(
    new TextEncoder().encode("data: " + JSON.stringify(json) + "\n\n"),
  );

async function getPromptContent(
  message: string,
  codeContext: string,
  combinedResult: PushFileOperation[],
): Promise<string> {
  const pushFileOperationString = await fetch(
    "https://uithub.com/PushFileOperation.ts",
  ).then((res) => res.text());

  const basePrompt = `You are an AI SWE Agent. You always write high-quality, fully complete code that can be used directly by the user to change their codebase. Always provide code editing operations that are self-containing and complete (For example, never say '// the rest stays the same' in an operation). You think like an expert programmer, always coming up with a plan beforehand, then executing it as you go, file by file. Your solutions are to the point and robust.
   
Consider this repository:

${codeContext}

The user requests the following changes:
---------------------------------------
${message}
---------------------------------------

The following is the interface for an operation to a file:

\`\`\`ts
${pushFileOperationString}
\`\`\`
`;

  if (combinedResult.length === 0) {
    return `${basePrompt}
    
Respond with a separate JSON code-block containing a file-operation for each file that requires changes (in JSON). Always be complete!!
  `;
  }

  return `${basePrompt}
    
Results so far:
------------------------------------------------
${parseResult(combinedResult)}
------------------------------------------------

Has the user request been completed?

If not, respond with other files requiring changes. Respond with a separate JSON code-block containing a file-operation for each file (in JSON). Always be complete!!`;
}

async function processStreamingResponse(
  content: string,
  response: Response,
  enqueueJson: (json: StreamResponse) => void,
): Promise<{ answer: string; matches: { error?: string; result?: any }[] }> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No reader available from response");
  }

  let answer = "";
  let buffer = "";
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.includes("[DONE]")) continue;
      if (!line.startsWith("data:")) continue;

      try {
        const data = JSON.parse(line.slice(5));
        const content = data?.choices?.[0]?.delta?.content;
        if (content) {
          answer += content;
        }
      } catch (e) {
        console.error("Error parsing JSON:", line.slice(5), e);
      }
    }
  }

  const jsonRegex = /```json\n([\s\S]*?)\n```/g;
  const matches: { error?: string; result?: any }[] = [
    ...answer.matchAll(jsonRegex),
  ]
    .map((x) => x[1])
    .map((string) => {
      try {
        return { result: JSON.parse(string) };
      } catch (error: any) {
        return { result: undefined, error: error.message };
      }
    });

  // Stream token usage information
  enqueueJson({
    type: "info",
    info: {
      iteration: 1, // This will be updated by the caller
      inputTokenCount: Math.round(content.length / 5),
      oututTokenCount: Math.round(answer.length / 5),
      matchCount: matches.length,
    },
  });

  return { answer, matches };
}

// Add CORS headers helper
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

const tryParseJson = (text: string | undefined) => {
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
};

const transform = async (request: Request) => {
  const url = new URL(request.url);
  const queryApiKey = url.searchParams.get("fileObjectApiKey");
  const headerApiKey = request.headers
    .get("Authorization")
    ?.slice("Bearer ".length);

  const nonCookieApiKey = headerApiKey || queryApiKey;
  const cookieApiKey = getCookie(request, "fileObjectApiKey");
  const fileObjectApiKey = nonCookieApiKey || cookieApiKey;

  // llm config
  const llmApiKey =
    url.searchParams.get("llmApiKey") || getCookie(request, "llmApiKey") || "";
  const llmBasePath =
    url.searchParams.get("llmBasePath") ||
    getCookie(request, "llmBasePath") ||
    "";
  const llmModelName =
    url.searchParams.get("llmModelName") ||
    getCookie(request, "llmModelName") ||
    "";

  const setCookieValue = [
    `fileObjectApiKey=${encodeURIComponent(fileObjectApiKey || "")}`,
    `llmApiKey=${encodeURIComponent(llmApiKey)}`,
    `llmBasePath=${encodeURIComponent(llmBasePath)}`,
    `llmModelName=${encodeURIComponent(llmModelName)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    "Max-Age=86400",
  ].join("; ");

  const accept =
    url.searchParams.get("accept") ||
    request.headers.get("Accept") ||
    undefined;

  const acceptHtml = accept?.includes("text/html");
  const fileObjectUrl = url.searchParams.get("fileObjectUrl") || undefined;

  const headers: { [key: string]: string } = { accept: "application/json" };
  if (fileObjectApiKey) {
    headers["Authorization"] = fileObjectApiKey;
  }

  const fileObjectResponse = !fileObjectUrl
    ? undefined
    : await fetch(fileObjectUrl, { headers });
  const text = await fileObjectResponse?.text();
  const result: { files: {} } | null = tryParseJson(text);

  if (
    !result?.files ||
    !fileObjectResponse?.ok ||
    !llmApiKey ||
    !llmBasePath ||
    !llmModelName ||
    !fileObjectUrl
  ) {
    const status = fileObjectResponse?.status || 400;
    const message = text || "Please provide the required inputs";

    if (acceptHtml) {
      return respondWith401(new Response(message, { status }));
    }

    return new Response(message, { status });
  }

  if (acceptHtml) {
    return new Response(htmlForResolve, {
      headers: { "Content-Type": "text/html", "Set-Cookie": setCookieValue },
    });
  }

  // Merge files together that belong together (prompts and code, primarily)
  const setFiles: SetFileItem[] = result.files
    .map((x) =>
      calculateFile(
        x.path,
        zipballContents,
        branch,
        repo,
        owner,
        x.action === "deleted",
      ),
    )
    // don't do files twice
    .filter(onlyUnique2<SetFileItem>((a, b) => a.path === b.path));

  const workflowFileObject = setFiles.reduce((previous, file) => {
    const changedFile = files.find((x) => x.path === file.path);

    //Parse md, get frontmatter (apis, cron), and filter out comments
    const { parameters, raw } = changedFile?.prompt
      ? parseFrontmatterMarkdownString(changedFile.prompt, { noComments: true })
      : { parameters: undefined, raw: undefined };

    // step 1:
    // calculate context: openapi operation definitions, current path
    const rawDependencies = parameters?.files
      ?.split(" ")
      .map((x) => x.trim())
      .map((file) => `/${file}`);

    const fileDependencies = rawDependencies
      ? rawDependencies
          .map((pathname) => resolvePathname(pathname, paths))
          .filter(notEmpty)
      : file.fileDependencies;

    const dependencies = fileDependencies?.map((x) => x?.path).filter(notEmpty);

    return {
      ...previous,
      [file.path]: {
        file: {
          ...(changedFile || (file as SetFileItem)),
          //also set the new fileDependencies
          fileDependencies,
          // take privacy from repo privacy
          private: repoDetails.private,
        },
        hasChanges: !!changedFile,
        dependencies,
      } satisfies WorkflowFile<SetFileItem>,
    };
  }, {} as { [path: string]: WorkflowFile<SetFileItem> });

  const changedFileAmount = Object.values(workflowFileObject).filter(
    (x) => x.hasChanges,
  ).length;

  return new Response(
    new ReadableStream({
      start: async (controller) => {
        const enqueueJson = (json: any) =>
          controller.enqueue(
            new TextEncoder().encode("\n\ndata: " + JSON.stringify(json)),
          );

        const { workflow, unprocessedPaths } = calculateWorkflow({
          ...workflowFileObject,
        });

        // console.log({
        //   allFiles,
        //   workflowFileObject,
        //   workflow,
        //   unprocessedPaths,
        // });

        if (unprocessedPaths) {
          console.log("unprocessed Paths found", unprocessedPaths);

          enqueueJson({
            error: `Unprocessed Paths found in workflow`,
            unprocessedPaths,
          });
        }

        console.log(`Created workflow of ${workflow.length} steps `, workflow);

        enqueueJson({
          changedFileAmount,
          message: `Workflow has been calculated of ${workflow.length} steps`,
        });

        // See through entire deployment step by step, and ensure everything is done at the right time..

        const results = await oneByOne(workflow, async (paths, index) => {
          enqueueJson({
            status: `Workflow step ${index + 1}: ${paths.length} in parallel`,
          });
          const workflowResult = await mapMany(
            paths,
            async (path) => {
              const file = workflowFileObject[path]?.file;

              if (!file) {
                return { status: 500, statusText: `can't find file`, path };
              }

              const setResult = await set(controller, file, apiKey, originUrl);

              enqueueJson({ status: path });

              return { path, ...setResult };
            },
            6,
          );

          // Since individual paths don't depend on each other, we can deploy to cloudflare after with all new ts
          const deployResponse = await deployCode(repoDetails);

          console.log(`workflow step ${index + 1} done`, deployResponse);
          return { workflowResult, deployResponse };
        });

        const deployWorkflowResult = results.flat().filter(notEmpty);

        // Console.log(`entire workflow finished`, results);

        await repos.update({
          owner,
          repo,
          branch,
          deployFinishedAt: Date.now(),
          deployDurationMs: Date.now() - repoDetails.deployStartedAt!,
          deployUnprocessedPaths: unprocessedPaths,
          deployWorkflow: workflow,
          deployWorkflowResult,
          deployError: null,
        });

        const deletedIds = files.filter((f) => f.deleted).map((x) => x.id);
        if (deletedIds.length > 0) {
          // NB: Delete after deployment is done so old deployment stays ok as long as needed
          await reposCode.delete(deletedIds);
        }

        enqueueJson({ message: "Entire workflow finished" });

        controller.close();
      },
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Transfer-Encoding": "chunked",
      },
    },
  );
};

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Handle OPTIONS request for CORS
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // Validate path
    if (request.method === "GET" && url.pathname === "/transform") {
      return transform(request);
    }

    // Add CORS headers to all responses
    return new Response("Method not allowed", {
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  },
};
