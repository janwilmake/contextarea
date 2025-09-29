import { mapMany, notEmpty, oneByOne, onlyUnique2 } from "edge-util";
import { repos, ReposCode, reposCode, ReposCodeMetadata } from "./src/vector";
import { set } from "./src/set.js";
import { getGithubOwner } from "./src/getGithubOwner.js";
import { resolvePathname } from "./src/resolvePathname.js";
import { calculateWorkflow, WorkflowFile } from "./src/calculateWorkflow.js";
import { parseFrontmatterMarkdownString } from "./src/parseFrontmatterMarkdownString.js";

type SetFileItem = ReposCodeMetadata & { deleted: boolean };

const parseEnvString = (content: string) => {
  const lines = content.split("\n");

  const result: { [key: string]: string } = {};

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip empty lines and comments
    if (trimmedLine === "" || trimmedLine.startsWith("#")) {
      continue;
    }

    const [key, value] = trimmedLine.split("=");
    if (key && value) {
      result[key.trim()] = value.trim();
    }
  }

  return result;
};

const deployCode = async (repoDetails: ReposCode) => {
  const codeIds = repoDetails.codePaths.map((p) => repoDetails.id + p);

  const tsIds = codeIds.filter((x) => x.endsWith(".ts"));
  if (tsIds.length === 0) {
    return { status: 200, message: "No typescript files" };
  }

  if (
    !process.env.CLOUDFLARE_AUTH_TOKEN ||
    !process.env.CLOUDFLARE_ACCOUNT_ID
  ) {
    return { status: 500, message: "No cloudflare setup ENV found" };
  }

  const tsCodeItems = (await reposCode.fetch(tsIds))
    .map((x) => x?.metadata)
    .filter(notEmpty)
    .filter((x) => x.ext === "ts")
    .map((x) => (x.code ? x : undefined))
    .filter(notEmpty);

  if (tsCodeItems.length === 0) {
    return { status: 500, message: "Couldn't find typescript files" };
  }

  const files = tsCodeItems.reduce(
    (previous, current) => ({ ...previous, [current.path]: current.code! }),
    {} as { [path: string]: string },
  );

  const envPath = repoDetails.codePaths.find((x) => x === "/.env");
  const envString = envPath
    ? (await reposCode.fetch([repoDetails.id + envPath]))?.[0]?.metadata?.code
    : undefined;
  const env = envString ? parseEnvString(envString) : undefined;

  const deployResponse = await fetch(
    "https://eval.actionschema.com/api/deploy",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_AUTH_TOKEN}` },
      body: JSON.stringify({
        workerName: `${repoDetails.branch}_${repoDetails.repo}_${repoDetails.owner}`,
        cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID,
        files,
        env,
      }),
    },
  );

  const text = await deployResponse.text();

  if (!deployResponse.ok) {
    return { status: deployResponse.status, message: text };
  }

  const json = JSON.parse(text);

  const basePath = json?.basePath;

  if (!basePath) {
    return { status: 500, message: "Successful but no basePath found" };
  }

  await repos.update({
    owner: repoDetails.owner,
    branch: repoDetails.branch,
    repo: repoDetails.repo,
    // set basepath to the repo
    serverUrl: basePath,
  });

  return { status: 200, message: "Deployed", basePath };
};
/**

Input contains list of new content of source-text files or source-code files; this is independent of required downstream changes and independent of github.

Can be called by:

- remote: github webhook -> syncBranch -> upstash 
- localhost: stream via syncBranch


*/
export const POST = async (request: Request) => {
  const apiKey = request.headers.get("Authorization")?.slice("Bearer ".length);
  const originUrl = new URL(request.url).origin;

  if (!apiKey) {
    return new Response("Unauthorized", { status: 403 });
  }

  const { data } = await getGithubOwner(apiKey);
  if (!data?.login) {
    return new Response("Unauthorized", { status: 403 });
  }

  const files: SetFileItem[] = await request.json();

  if (!Array.isArray(files) || !files?.[0]) {
    return new Response("No files provided", { status: 400 });
  }

  const { owner, repo, branch } = files[0];

  if (!owner || !repo || !branch) {
    return new Response("No owner/repo/branch provided", { status: 400 });
  }

  // Get repo.paths and all 'reposCode' files as context
  const repoDetails = await repos.get(owner, repo, branch);

  if (!repoDetails) {
    return new Response("no details", { status: 400 });
  }

  const codeIds = repoDetails.codePaths.map((p) => repoDetails.id + p);

  // NB: As this can end up being a lot, maybe a range is a better approach
  const repoCodeItems = (await reposCode.fetch(codeIds))
    .map((x) => x?.metadata)
    .filter(notEmpty);

  const paths = repoCodeItems.map((x) => x.path);

  //NB: also add new files
  const allFiles = (files as ReposCodeMetadata[])
    .concat(repoCodeItems)
    .filter(onlyUnique2<ReposCodeMetadata>((a, b) => a.path === b.path));

  // console.log("gonna calculate workflow", {
  //   codeIds,
  //   availablePaths: paths.length,
  //   isGood: paths.length === codeIds.length,
  //   changedFiles: files.length,
  //   all: allFiles.length,
  //   //repoPaths: repoDetails.paths,
  //   //codeIds,
  // });

  // console.log(`repoDetails.paths`, repoDetails.codePaths);

  const workflowFileObject = allFiles.reduce((previous, file) => {
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

  // console.log("henky", workflowFileObject);
  const changedFileAmount = Object.values(workflowFileObject).filter(
    (x) => x.hasChanges,
  ).length;

  // NB: COPY!

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

export const OPTIONS = async () => {
  // Set CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
  // Handle OPTIONS request (preflight)
  return new Response(null, { headers });
};
