import { notEmpty, tryParseJson } from "edge-util";
import { findCodeblocks } from "marked-util";

/** Defaults to claude */
export const jsonGpt = async <T>(
  agentOpenapiUrl: string | undefined,
  system: string,
  user: string,
  model = "gpt-4o-mini",
  llmBasepath = "https://api.openai.com/v1",
  llmApiKey = process.env.OPENAI_API_KEY,
): Promise<{
  status: number;
  codeblockJson?: T | null;
  codeblock?: string;
  statusText?: string;
  content?: string;
}> => {
  if (!llmApiKey) {
    return { status: 400, statusText: "Please provide an LLM Token" };
  }

  const messages = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];

  const openapiPart = agentOpenapiUrl
    ? `/${encodeURIComponent(agentOpenapiUrl)}`
    : "";

  const llmResult = await fetch(
    `https://chat.actionschema.com${openapiPart}/chat/completions`,
    {
      body: JSON.stringify({
        stream: true,
        model,
        messages,
      }),
      method: "POST",
      headers: {
        "X-BASEPATH": llmBasepath,
        Authorization: `Bearer ${llmApiKey}`,
      },
    },
  );

  if (!llmResult.ok) {
    return { status: llmResult.status, statusText: llmResult.statusText };
  }

  const reader = llmResult.body?.getReader();

  if (!reader) {
    return { status: 400, statusText: "No reader" };
  }

  const decoder = new TextDecoder();
  let currentResponse = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer = decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    // buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data:")) {
        try {
          const data = JSON.parse(line.slice(5));
          if (data.choices?.[0]?.delta?.content) {
            //console.log(data.choices[0].delta.content);
            currentResponse += data.choices[0].delta.content;
          }
        } catch (e) {
          // console.log("Error parsing JSON:", e);
        }
      }
    }
  }

  if (!currentResponse) {
    return {
      status: 422,
      statusText: "Got repsonse but no content",
    };
  }

  const codeblock = findCodeblocks(currentResponse)?.[0] || currentResponse;

  const codeblockJson = tryParseJson<T>(codeblock);

  return { status: 200, content: currentResponse, codeblock, codeblockJson };
};
