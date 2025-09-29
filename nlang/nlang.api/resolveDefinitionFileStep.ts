import { fetchWithTimeout } from "./fetchWithTimeout";
import { getContextUrls } from "./getContextUrls";
import { getParams } from "./getParams";
import { tryScrapeUrls } from "./tryScrapeUrls";
import { StepInput, StepOutput } from "./types";

export const applyParams = (
  content: string,
  params: { [param: string]: string },
) =>
  Object.keys(params).reduce((url, key) => {
    return url.replace(`[${key}]`, params[key]);
  }, content);

export const maybeInjectData = async (
  originUrl: string,
  originApiKey: string | undefined,
  routeAtStep: string,
  content: string,
  targetExt: string,
) => {
  if (targetExt !== "html" && targetExt !== "js") {
    // no injection required
    return { content };
  }

  const headers = originApiKey
    ? { Authorization: `Bearer ${originApiKey}` }
    : undefined;

  // about.html.json or about.js.json should get the about.js file and inject the json into it
  // Exception 3: json needs to be inserted into HTML or JS if that's
  const pathname = new URL(originUrl + routeAtStep).pathname;
  const fetchJsonUrl =
    originUrl + pathname.slice(0, pathname.length - targetExt.length) + "json";
  console.log("loading data json from:", { routeAtStep, fetchJsonUrl });
  const jsonResponse = await fetchWithTimeout(fetchJsonUrl, {
    headers,
    timeout: 120000,
  });

  if (!jsonResponse.ok) {
    // try json if its there, if not, just return regular content
    return { content };
  }

  const jsonContent = await jsonResponse.text();
  const dataJson = JSON.parse(jsonContent);

  if (targetExt === "html") {
    const replaced = content.replace(
      /<body[^>]*>/,
      (match) =>
        `${match}\n<script>\nconst data = ${JSON.stringify(
          dataJson,
        )};\n</script>`,
    );

    return {
      content: replaced,
      fetchUrl: fetchJsonUrl,
    };
  }

  // must be JS
  return {
    content: `const data = ${JSON.stringify(dataJson)};\n\n${content}`,
    fetchUrl: fetchJsonUrl,
  };
};

/**
Performs a single step of the extension stack

- proxies .url files
- exexcutes .ts/.js files
- prompts .md files
- if .md files generate html or js, tries injecting json from the same path into it as 'data'-prop

For MD files:

- 1. getSystemContext(prompt, systemContextSystemPrompt) => contextUrl[] (expose it at `?githuq_context=true`)
- 2. contextUrl[] => retrieve content-type => systemContext
- 3. calculate(prompt, systemForExt, systemContext)

*/
export const resolveDefinitionFileStep = async (
  context: StepInput,
): Promise<StepOutput> => {
  const {
    originApiKey,
    originUrl,
    content,
    pathAtStep,
    routeAtStep,
    path,
    llmApiKey,
    llmBasePath,
    llmModelName,
  } = context;

  console.log("step", { pathAtStep, routeAtStep, path });
  if (!content || !pathAtStep) {
    return { content: "Invalid input: Need definitionfile", status: 400 };
  }

  // e.g. about.json.url.md, about.html.json.md, about.html.md
  const filename = pathAtStep.split("/").pop()!;
  const fileChunksReversed = filename.split(".").reverse();
  const [ext, targetExt] = fileChunksReversed;

  // get the params from the URL, but also pass additional params to the content.

  const params: { [param: string]: string } = {
    origin: originUrl,
    ...getParams(routeAtStep, path),
  };

  if (originApiKey) {
    params.apiKey = originApiKey;
  }

  // replace params in the content
  const filled = applyParams(content, params);

  if (ext === "url") {
    // Exception 1: the URL extension must be proxied
    const isDirect = filled.startsWith("https://");
    const contentUrlWithBase = isDirect ? filled : originUrl + filled;
    return {
      url: contentUrlWithBase,
      status: 200,
    };
  }

  if (ext === "ts" || ext === "js") {
    // Exteption 2: Javascript as definition shall be executed. To be implemented.
    return { content: "Executing Javascript isn't supported yet", status: 400 };
  }

  if (ext !== "md") {
    return { content: `Unsupported Extension: ${ext}`, status: 400 };
  }

  // We have a 'md' file to be processed.

  // 1: get context URLs
  const {
    contextUrls,
    generationUrls,
    resultUrl: contextResultUrl,
    status,
    error,
  } = await getContextUrls({
    content,
    originUrl,
    llmApiKey,
    llmBasePath,
    llmModelName,
    params,
    routeAtStep,
    targetExt,
  });

  if (status !== 200) {
    return {
      content: `${status} - context analysis prompt went wrong: ${error}`,
      status,
    };
  }

  const filledContextUrls = (contextUrls || []).map((url) =>
    applyParams(url, params),
  );

  // 2: Scrape urls
  const { systemContext, contextUrlErrors } = await tryScrapeUrls(
    filledContextUrls,
    originUrl,
    originApiKey,
  );

  const targetPath = pathAtStep.slice(0, pathAtStep.length - ext.length - 1);

  // 3. Do the prompt to get the next content inside a codeblock

  // TODO: Provide custom additional instructions for the specific target
  const customTargetInstructions = {
    md: `IMPORTANT: Ensure to escape nested codeblocks using backslahes! E.g. \\\`\\\`\\\` so the entire markdown can be extracted from a single markdown codeblock.`,
    js: ``,
    json: ``,
    url: ``,
    ts: `Use cloudflare worker ESM Typescript syntax with a default export containing fetch in the object. Do not use Node.js libs.`,
    html: `Ensure to use plain HTML, JS, and tailwind CSS, and include <script src="https://cdn.tailwindcss.com"></script> in the head.`,
    css: ``,
  }[targetExt];

  const systemPrompt = `You are an NLang compiler. You compile a natural language source to a codeblock. 
    
You are now generating '${originUrl}${targetPath}'
  
Always respond with a ${targetExt} codeblock, and ensure to follow user instructions with the provided context.

${customTargetInstructions}`;

  const contextPart =
    systemContext === "" ? "" : `\n\nCONTEXT:\n\n${systemContext}`;

  const chatResponse = await fetchWithTimeout(
    `https://chatcompletions.com/chat/completions?images=true`,
    {
      timeout: 180000,
      method: "POST",
      body: JSON.stringify({
        model: llmModelName,
        messages: [
          {
            role: "system",
            content: `${systemPrompt}${contextPart}`,
          },
          { role: "user", content: filled },
        ],
      }),
      headers: {
        "X-LLM-Base-Path": llmBasePath,
        "X-LLM-API-Key": llmApiKey,
        "X-Output": `codeblock.${targetExt}`,
      },
    },
  );

  const contentType = chatResponse.headers.get("content-type");
  const generationResultUrl =
    chatResponse.headers.get("X-Result-URL") || undefined;

  if (!chatResponse.ok || !contentType) {
    return {
      content: "chatcompletions error: " + (await chatResponse.text()),
      status: chatResponse.status,
    };
  }

  const result = await chatResponse.text();

  const { content: finalContent, fetchUrl } = await maybeInjectData(
    originUrl,
    originApiKey,
    routeAtStep,
    result,
    targetExt,
  );

  return {
    content: finalContent,
    contextUrls: fetchUrl ? (contextUrls || []).concat(fetchUrl) : contextUrls,
    contextUrlErrors,
    contextResultUrl,
    generationResultUrl,
    status: 200,
    headers: { "Content-Type": contentType },
  };
};
