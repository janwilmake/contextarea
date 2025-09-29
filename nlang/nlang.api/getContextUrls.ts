import { fetchWithTimeout } from "./fetchWithTimeout";

export const getContextUrls = async (context: {
  /** Content without being filled with the variables. */
  content: string;
  originUrl: string;

  llmModelName: string;
  llmBasePath: string;
  llmApiKey: string;
  routeAtStep: string;
  targetExt: string;
  params: { [param: string]: string };
}): Promise<{
  status: number;
  error?: string;
  resultUrl?: string;
  contextUrls?: string[];
  generationUrls?: string[];
}> => {
  const {
    originUrl,
    content,
    llmApiKey,
    llmBasePath,
    llmModelName,
    routeAtStep,
    params,
    targetExt,
  } = context;

  const variablesString = Object.keys(params).join(", ");

  const systemContextSystemPrompt = `
Origin: ${originUrl}
Current file: ${originUrl}${routeAtStep}
File format to generate: ${targetExt}
---------------

You are N Lang Compiler, an AI SWE System. The user is doing a prompt that may require additional context or using certain URLs in the generated part.

- It needs to be unambigous whether a file needs to be taken into context OR the URL is to be used as part of the generation.
- When a file is mentioned started with '/', respond with a URL starting at the origin. Otherwise it's relative to the current file.
- To get an openapi definition, use https://openapisearch.com/DOMAIN/OPERATIONID
- To add a screenshot, use https://quickog.com/screenshot/URL
- To get a URL as markdown, use https://llmtext.com/URL
- You can use https://nachocache.com/DURATION/URL to cache something (duration e.g. 3d or 1h)
- You can use https://strongturns.com/convert/URL/~/JOIN-POINTER to get a piece of a file
- You can use variables in blockquotes, which will be replaced at runtime: \[variable\]. Available variables are: ${variablesString}
- Only respond with URLs if they (or their files) are explicitly requested!!!

Respond with a JSON codeblock with {contextUrls: string[], generationUrls:string[]}.`;

  const chatResponse = await fetchWithTimeout(
    `https://chatcompletions.com/chat/completions`,
    {
      timeout: 180000,
      method: "POST",
      body: JSON.stringify({
        model: llmModelName,
        messages: [
          { role: "system", content: systemContextSystemPrompt },
          { role: "user", content },
        ],
      }),
      headers: {
        "X-LLM-Base-Path": llmBasePath,
        "X-LLM-API-Key": llmApiKey,
        "X-Output": `codeblock.json`,
      },
    },
  );

  if (!chatResponse.ok) {
    return {
      error: "chatcompletions error: " + (await chatResponse.text()),
      status: chatResponse.status,
    };
  }

  const resultUrl = chatResponse.headers.get("X-Result-URL") || undefined;

  const json: {
    contextUrls: string[];
    /** Only added to make it less biased */
    generationUrls: string[];
  } = await chatResponse.json();

  return {
    status: 200,
    resultUrl,
    contextUrls: json.contextUrls,
    generationUrls: json.generationUrls,
  };
};
