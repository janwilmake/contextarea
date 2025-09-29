import { fetchRepoDetails } from "./fetchRepoDetails.js";
import { getIsAsset } from "./getIsAsset.js";
import { apexDomain } from "./constants.js";
import { jsonGpt } from "./jsonGpt.js";
import { parseFrontmatterMarkdownString } from "./parseFrontmatterMarkdownString.js";

export const evaluateEndpoint = async (codeblock: string) => {
  // should host it and immediately call it to retieve the actual second-degree content
  return undefined;
};

const populateSystemPrompt = (
  system: string,
  context: { [key: string]: string },
) => {
  return Object.keys(context).reduce((previous, current) => {
    return previous.replaceAll(`{${current}}`, context[current]);
  }, system);
};

const calculateMissingValue = async (context: {
  basePath: string;
  prompt: string | undefined;
  code: string | undefined;
  ext: string;
  shuffleAgents: Promise<{ [path: string]: string | undefined } | undefined>;
  codeAgentOpenapi: string;
  path: string;
  promptPath: string | null;
  contextString: string;
  env?: { [k: string]: string };
}): Promise<{
  status: number;
  statusText?: string;
  script?: string;
  source?: "prompt" | "code";
  code?: string;
  prompt?: string;
}> => {
  const {
    basePath,
    code,
    codeAgentOpenapi,
    ext,
    path,
    prompt,
    promptPath,
    shuffleAgents,
    contextString,
    env,
  } = context;
  console.log(`calculate missing value: ${basePath}${path}`, {
    code,
    prompt,
    ext,
  });
  if (!code && !prompt) {
    return {
      status: 400,
      statusText: "Missing prompt and/or code",
      source: undefined,
    };
  }

  if (code && !prompt) {
    // should be /md.*.md
    const agentPath = `/md_${ext}.md`;
    const agentPrompt = (await shuffleAgents)?.[agentPath];

    if (!agentPrompt) {
      return {
        status: 404,
        statusText: `Could not find agent prompt: ${agentPath}`,
        code,
        source: "code",
      };
    }

    const result = await jsonGpt(
      undefined,
      populateSystemPrompt(agentPrompt, { basePath, path }),
      code,
    );

    if (result?.status !== 200) {
      return {
        status: result?.status,
        statusText: result?.statusText,
        code,
        source: "code",
      };
    }

    return { status: 200, code, prompt: result.codeblock, source: "code" };
  }

  if (prompt && !code) {
    if (!path || !promptPath || !ext) {
      return {
        status: 400,
        statusText: "Missing params",
        prompt,
        source: "prompt",
      };
    }

    // for some/path/index.html it can be /html.ts.md.md
    const agentPath =
      "/" +
      promptPath.slice(path.length - ext.length).replaceAll(".", "_") +
      ".md";

    const agentPrompt = agentPath
      ? (await shuffleAgents)?.[agentPath]
      : undefined;

    if (!process.env.ANTHROPIC_TOKEN) {
      return {
        status: 404,
        statusText: `No ANTHROPIC_TOKEN present`,
        prompt,
        source: "prompt",
      };
    }

    if (!agentPrompt) {
      return {
        status: 404,
        statusText: `Could not find agent prompt: ${agentPath}`,
        prompt,
        source: "prompt",
      };
    }

    const system = populateSystemPrompt(contextString + "\n\n" + agentPrompt, {
      basePath,
      path,
      envKeys:
        env && Object.keys(env).length ? Object.keys(env).join(", ") : "None",
    });

    //  console.log(`PROMPT TO CODE:\n\n\n`, { system, prompt }, `\n\n\n`);

    const result = await jsonGpt(
      undefined,
      system,
      prompt,
      "claude-3-5-sonnet-20240620",
      "https://anthropic.actionschema.com",
      process.env.ANTHROPIC_TOKEN,
    );

    if (result?.status !== 200 || !result.codeblock) {
      return {
        status: result?.status,
        statusText: result?.statusText,
        prompt,
        source: "prompt",
      };
    }

    const isSecondOrderContent = agentPath.split(".")[1] === "ts";

    const code = isSecondOrderContent
      ? await evaluateEndpoint(result.codeblock)
      : result.codeblock;

    const script = isSecondOrderContent ? result.codeblock : undefined;

    return { status: 200, code, prompt, script, source: "prompt" };
  }

  return { status: 200, prompt, code, source: "prompt" };
};

const calculate = async (
  controller: ReadableStreamDefaultController<any>,
  authToken: string,
  basePath: string,

  context: Partial<ReposCodeMetadata> & {
    path: string;
    promptPath: string | null;
    ext: string | null;
    deleted: boolean;
    owner: string;
    repo: string;
    branch: string;
    id: string;
  },
) => {
  let { prompt, fileDependencies, env, ext, code, path, promptPath, repo } =
    context;

  //Parse md, get frontmatter (apis, cron), and filter out comments
  const { parameters, raw } = prompt
    ? parseFrontmatterMarkdownString(prompt, { noComments: true })
    : { parameters: undefined, raw: undefined };

  const cron = parameters?.cron;

  // step 1:
  // calculate context: openapi operation definitions, current path
  const fileUrls = parameters?.files
    ?.split(" ")
    .map((x) => x.trim())
    .map((file) => `${basePath}/${file}`);

  const files = fileUrls
    ? await Promise.all(
        fileUrls.map((file) =>
          fetch(file, {
            headers: authToken
              ? { Authorization: `Bearer ${authToken}` }
              : undefined,
          }).then(async (res) =>
            res.ok
              ? { status: res.status, content: await res.text(), file }
              : { status: res.status },
          ),
        ),
      )
    : undefined;

  const openapis = parameters?.api
    ?.split(" ")
    .map((x) => x.trim())
    .map((text) => {
      //hackernews/newstories.json=get,item/{id}.json__get
      const [providerSlug, ...rest] = text.split("/");
      const operationIds = rest.join("/");

      return { providerSlug, operationIds };
    });

  const apis = openapis
    ? await Promise.all(
        openapis.map(async (item) => {
          const operationIdsPart =
            item.operationIds !== ""
              ? `?operationIds=${item.operationIds}`
              : "";
          const url = `https://openapisearch.com/api/${item.providerSlug}/openapi.json${operationIdsPart}`;
          const results = await fetch(url).then(async (res) =>
            res.ok
              ? { openapi: await res.text(), status: 200, url }
              : {
                  status: res.status,
                  statusText: res.statusText,
                  result: await res.text(),
                  url,
                },
          );

          return results;
        }),
      )
    : undefined;

  const codeAgentOpenapi = "https://openapi-code-agent.vercel.app/openapi.json";

  const shuffleAgents = fetch(
    `https://irfc.cloud/irfc-admin/search/content?repo=shuffle-agents`,
    {
      headers: { Authorization: `Bearer ${process.env.GITHUB_MASTER_SECRET!}` },
    },
  ).then((res) =>
    res.ok ? (res.json() as Promise<{ [path: string]: string }>) : undefined,
  );

  const contextString =
    (apis || [])
      .map((x) => x.openapi)
      .filter(notEmpty)
      .join("\n\n") +
    "\n\n" +
    (files || [])
      .filter((x) => x.content && x.file)
      .map((x) => `---------\n${x.file}\n-----------\n${x.content}\n----------`)
      .join("\n\n");

  console.log(path, contextString);
  // step 2: calculate either prompt or code
  const result = await calculateMissingValue({
    env,
    basePath,
    prompt,
    code,
    ext,
    shuffleAgents,
    codeAgentOpenapi,
    path,
    promptPath,
    contextString,
  });

  if (!result.code || !result.prompt) {
    return { status: result.status, statusText: result.statusText };
  }

  // 2: calculate summary and openapi
  const summaryPrompt = (await shuffleAgents)?.["/summary_md.md"];
  const openapiPrompt = (await shuffleAgents)?.["/openapi_json_ts.md"];

  if (!summaryPrompt || !openapiPrompt) {
    return { status: 400, statusText: "Missing prompts" };
  }

  const [summaryResult, openapiResult] = await Promise.all([
    jsonGpt(
      codeAgentOpenapi,
      populateSystemPrompt(summaryPrompt, { basePath, path }),
      result.code,
    ),
    ext === "ts"
      ? jsonGpt<OpenapiDocument>(
          codeAgentOpenapi,
          populateSystemPrompt(openapiPrompt, {
            basePath,
            path: path.endsWith(".ts") ? path.slice(0, path.length - 3) : path,
          }),
          result.code,
        )
      : undefined,
  ]);

  if (summaryResult?.status !== 200) {
    return {
      status: summaryResult?.status,
      statusText: summaryResult?.statusText,
    };
  }

  if (openapiResult && openapiResult.status !== 200) {
    return {
      status: openapiResult.status,
      statusText: openapiResult.statusText,
    };
  }

  // console.log({
  //   prompt: result.prompt,
  //   script: result.script,
  //   summary: summaryResult.codeblock,
  //   openapi: openapiResult?.codeblockJson,
  // });

  const errors = ((apis || []) as any[])
    .filter((x) => x.status !== 200)
    .concat((files || []).filter((x) => x.status !== 200));

  return {
    status: 200,
    result: {
      ...context,
      errors,
      code: result.code,
      prompt: result.prompt,
      script: result.script,
      source: result.source,
      summary: summaryResult.codeblock,
      openapi: openapiResult?.codeblockJson,
      cron,
      apis,
    } as ReposCodeMetadata,
  };
};

export type ValType =
  | "interval"
  | "http"
  | "express"
  | "email"
  | "script"
  | "rpc"
  | "httpnext";

export type ValPrivacy = "public" | "unlisted" | "private";

export interface Author {
  id: string;
  username: string | null;
}

export interface ValLinks {
  self: string;
  versions: string;
  module: string;
  endpoint?: string;
}

export interface ExtendedVal {
  name: string;
  id: string;
  version: number;
  code: string | null;
  public: boolean;
  createdAt: string;
  privacy: ValPrivacy;
  type: ValType;
  url: string;
  links: ValLinks;
  author: Author | null;
  likeCount: number;
  referenceCount: number;
  readme: string | null;
}

/**
 * Set does not know about git sha's or anything git, because we may choose to avoid github when using this function.
 */
export const set = async (
  controller: ReadableStreamDefaultController<any>,
  json: ReposCodeMetadata & { deleted: boolean },
  authToken: string,
  originUrl: string,
): Promise<{ status: number; statusText?: string; url?: string }> => {
  if (
    // !process.env.VAL_TOKEN ||
    !process.env.UPSTASH_VECTOR_REST_URL ||
    !process.env.UPSTASH_VECTOR_REST_TOKEN ||
    !process.env.GITHUB_MASTER_SECRET
  ) {
    console.error("/set - Invalid keys");
    return { status: 400, statusText: "Invalid keys" };
  }

  if (!json.owner || !json.repo || !json.branch) {
    return { status: 400, statusText: "Invalid input" };
  }

  // TODO: Validate json better

  const repoItem = await repos.get(json.owner, json.repo, json.branch);

  if (!repoItem) {
    // NB: Only check the github api if we haven't got it ourselves for performance reasons
    const repoDetailsQuery = await fetchRepoDetails(
      authToken,
      json.owner,
      json.repo,
    );

    if (!repoDetailsQuery.result?.name) {
      return { status: 404, statusText: "No repo found" };
    }
  }

  const prefix = `${json.owner}/${json.repo}/${json.branch}`.toLowerCase();

  const id = `${prefix}${json.path}`;

  if (json.deleted) {
    const count = await reposCode.delete([id]);

    // TODO: Delete val too, delete asset too

    return { status: 200, statusText: "Deleted" };
  }

  let assetUrl: string | undefined = undefined;

  const isAsset = getIsAsset(json.ext);

  if (isAsset) {
    assetUrl = json.url;
  }
  const urlOrigin = `https://${json.branch}_${json.repo}_${json.owner}.${apexDomain}`;

  const {
    result: calculated,
    status,
    statusText,
  } = await calculate(controller, authToken, urlOrigin, { ...json, id });

  if (
    status !== 200 ||
    !calculated ||
    !calculated.id ||
    !calculated.repo ||
    !calculated.branch ||
    !calculated.owner ||
    !calculated.path
  ) {
    // let is pass for now
    console.error(
      status,
      "Invalid calculated repsonse: " + statusText,
      calculated,
    );
    return { status, statusText: "Invalid calculated response: " + statusText };
  }

  const fullMetadata: ReposCodeMetadata = {
    ...json,
    ...calculated,
    //lowercase needed to filter
    repo: (calculated || json).repo.toLowerCase(),
    owner: (calculated || json).owner.toLowerCase(),
    branch: (calculated || json).branch.toLowerCase(),
    id,
    url: assetUrl,
  };

  // console.log({ fullMetadata });
  const upsertResult = await reposCode.upsert(fullMetadata);

  if (upsertResult.status !== 200) {
    console.log(
      `${upsertResult.status} CODE UPSERT: ${fullMetadata.path}`,
      upsertResult,
      `${fullMetadata.owner}/${fullMetadata.repo}/${fullMetadata.branch}`,
    );
    return { status: upsertResult.status, statusText: upsertResult.message };
  }

  return { status: 201, url: `${urlOrigin}${json.path}` };
};
