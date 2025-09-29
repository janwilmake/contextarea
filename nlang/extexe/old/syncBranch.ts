import { notEmpty, onlyUnique2, qStashSend } from "edge-util";
import { compareOrGetAllFiles } from "./src/compareCommits.js";
import { fetchRepoDetails } from "./src/fetchRepoDetails.js";
import { getLastCommitBeforeDate } from "./src/getLastCommitBeforeDate.js";
import { repos, secret, ReposCode, ReposCodeMetadata } from "./src/vector";
import { apexDomain, promptSuffixes } from "./src/constants.js";

//september16
const lastCloudUpdate = 1726565598644;

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

const repoErrorResponse = async (
  status: number,
  statusText: string,
  owner: string,
  repo: string,
  branch: string,
) => {
  await repos.update({
    owner,
    repo,
    branch,
    deployError: `${status} - ${statusText}`,
  });

  return new Response(statusText, { status });
};
/**
 * Endpoint that looks at a repo, compares to vector last update, and updates files needed updating.
 */
export const POST = async (request: Request) => {
  const json = await request.json();
  const { repo, branch, force } = json;

  const owner: string | undefined = json.owner?.toLowerCase();

  if (
    !process.env.UPSTASH_VECTOR_REST_URL ||
    !process.env.UPSTASH_VECTOR_REST_TOKEN
  ) {
    return new Response(
      "No process.env.UPSTASH_VECTOR_REST_URL or process.env.UPSTASH_VECTOR_REST_TOKEN",
      { status: 500 },
    );
  }
  //
  console.log("syncBranch", { owner, repo, branch });

  if (!owner || !repo || !branch) {
    return new Response("Invalid input", { status: 400 });
  }

  const ownerApiKey = (await secret.getOwner(owner))?.metadata?.secret;
  const masterApiKey = process.env.GITHUB_MASTER_SECRET;
  const apiKey = ownerApiKey || masterApiKey;

  if (!apiKey) {
    console.log("apiKey not found for owner and also no GITHUB_MASTER_SECRET");
    return new Response("Not found", { status: 404 });
  }

  // start with this asap
  const zipballContentsPromise = getGithubZipballContents({
    owner,
    repo,
    apiKey: ownerApiKey,
    branch,
  });

  const { result: githubRepo, status } = await fetchRepoDetails(
    apiKey,
    owner,
    repo,
  );

  let item = await repos.get(owner, repo, branch);

  if (!githubRepo && !item) {
    console.log("Repo not found", { owner, repo, branch, status });
    return new Response("Repo not found", { status });
  }

  if (!githubRepo && item) {
    if (status === 404) {
      // deleted most likely. also delete in vectordb
      console.log("Deleted", { owner, repo, branch });
      await repos.delete(owner, repo, branch);
      // TODO: also delete files
      return new Response("Deleted", { status: 200 });
    }

    return repoErrorResponse(
      status,
      "Error fetching github details",
      owner,
      repo,
      branch,
    );
  }

  if (githubRepo && !item) {
    // create a new repo.
    const {
      archived,
      created_at,
      default_branch,
      description,
      homepage,
      pushed_at,
      topics,
      updated_at,
    } = githubRepo;
    // created. also create in vectordb

    const initialSummary = `${githubRepo.full_name}/${branch} - ${githubRepo.description}`;

    const metadata: Omit<ReposCode, "id"> = {
      branch,
      owner,
      repo,
      archived,
      created_at,
      default_branch,
      description: initialSummary,
      homepage,
      private: githubRepo.private,
      topics,
      updated_at,
      pushed_at,
      //mystuff
      codePaths: [],
      deployFinishedAt: null,
      deploySha: null,
      deployStartedAt: null,
      deployUnprocessedPaths: null,
    };
    item = metadata as ReposCode;

    const upsertResult = await repos.upsert(metadata);
    // TODO: return early if this fails
  }

  const realItem = item;

  if (!realItem) {
    return repoErrorResponse(
      status,
      "Creating repo went wrong",
      owner,
      repo,
      branch,
    );
  }

  // TODO: Find all files in github repo branch, updated after {deployedUnix}
  const unixNow = Date.now();
  //doke
  const currentPaths = realItem.codePaths; //await reposCode.getPathsForRepo(owner, repo);
  // const queryResult = await reposCode.query(``,{filter:`owner = '${owner}' AND repo = '${repo}'`,topK:1000});
  // Replaced with 'realItem.metadata.paths' and keep paths there OR put each repo in its own namespace.

  console.log({ unixNow, currentPaths });

  // Get head_sha
  const headCommit = await getLastCommitBeforeDate(owner, repo, null, apiKey);
  const headCommitSha = headCommit?.sha;

  // Get base_sha (look at last commit before {deployedUnix})

  const deployedUnix = realItem.deployStartedAt;

  // Register no basecommit if irfc has updated.all files must reload
  const deployedBeforeUpdate =
    !deployedUnix || deployedUnix < lastCloudUpdate || !!force;

  const baseCommit = deployedUnix
    ? await getLastCommitBeforeDate(owner, repo, deployedUnix, apiKey)
    : undefined;

  const maybeBaseCommitSha = baseCommit?.sha;
  // NB: requiring the last_deploy_sha tobe equal to the one we find, protects us from a changing history.
  const baseCommitSha =
    maybeBaseCommitSha === item?.deploySha && !deployedBeforeUpdate
      ? maybeBaseCommitSha
      : undefined;

  if (!headCommitSha) {
    console.log(`no head commit`, headCommit);

    return repoErrorResponse(
      headCommit.status,
      `No commits yet or retrieval of commit failed:${
        headCommit.message || headCommit.status
      }`,
      owner,
      repo,
      branch,
    );
  }

  console.log("shasammmm", { headCommitSha, baseCommitSha });

  const files = await compareOrGetAllFiles({
    branch,
    apiKey,
    baseCommitSha,
    headCommitSha,
    owner,
    repo,
  });

  if (!files.files) {
    console.log("comparison went wrong", files);

    return repoErrorResponse(
      files.status,
      "Something went wrong in comparison",
      owner,
      repo,
      branch,
    );
  }

  console.log("comparison files", files.files.length);

  // should be done now
  const zipballContents = await zipballContentsPromise;
  if (!zipballContents.result) {
    return repoErrorResponse(
      zipballContents.status,
      "Couldn't get zipball contents:" + zipballContents.message,
      owner,
      repo,
      branch,
    );
  }

  /** `/syncBranch` should look at size and have a limit for it. Upstash limit is 48KB metadata per vector, a total DB-size of 50GB, and max ±650k rows. Our file-prune prompt will have summaries and needs to be under 4k tokens.

Let's limit a repo to:

- 400 files max
- max path size 64 characters
- Filesize of non-binary 24000 characters max (allow space for metadata) */

  // paths to which code is located
  const codePaths = Object.keys(zipballContents.result)
    .map((path) =>
      calculateFile(path, zipballContents, branch, repo, owner, false),
    )
    .map((x) => x.path)
    .filter(onlyUnique2())
    .filter(notEmpty);

  const totalPathsLength = JSON.stringify(codePaths).length;
  const tooLongPath = codePaths.find((path) => path.length >= 256);

  const filesizeTooBigPaths = Object.keys(zipballContents.result).filter(
    (path) => JSON.stringify(zipballContents.result[path]).length > 500000,
  );

  if (totalPathsLength > 24000 || codePaths.length > 400) {
    const statusText = `Repo too large: ${owner}/${repo} - Max 400 files (found ${codePaths.length}) and max cumulative path characters 24000 (found ${totalPathsLength})`;

    return repoErrorResponse(413, statusText, owner, repo, branch);
  }

  if (tooLongPath) {
    const statusText = `Path too long: ${owner}/${repo} - ${tooLongPath}`;
    return repoErrorResponse(413, statusText, owner, repo, branch);
  }

  if (filesizeTooBigPaths.length > 0) {
    const message =
      "Can't sync repo: files too big: \n\n" + filesizeTooBigPaths.join("\n");
    return repoErrorResponse(413, message, owner, repo, branch);
  }

  // Merge files together that belong together (prompts and code, primarily)
  const setFiles: SetFileItem[] = files.files
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

  if (JSON.stringify(setFiles).length > 1000000) {
    const message = "Can't sync repo: Reposize can't exceed 1MB";
    return repoErrorResponse(413, message, owner, repo, branch);
  }

  // console.log(
  //   `changed files in terms of combinations:`,
  //   setFiles.map((x) => x.path).length,
  //   { codePaths },
  // );

  await repos.update({
    owner,
    repo,
    branch,
    codePaths,

    deployStartedAt: Date.now(),
    deploySha: headCommitSha,
    // error-free start of a new deployment
    deployError: null,
    deployWorkflow: null,
    deployWorkflowResult: null,
    deployDurationMs: null,
    deployUnprocessedPaths: null,
  });

  if (new URL(request.url).hostname === "localhost") {
    console.log("START DEPLOYMENT LOCALLY WITH STREAM", { setFiles });
    // exception for localhost!!!
    const response = await fetch(`http://localhost:3000/irfc-admin/deploy`, {
      body: JSON.stringify(setFiles),
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return response;
  }

  console.log("Called /deploy via upstash!");

  // Call `deploy` for all files via upstash.
  // NB: this could be too large (max 1mb) but this is a limitation we can avoid by making max repo-text-size 1mb. Can later be paid for ($180/m) to upgrade max to 10MB which is more than 400x24kb so it's enough for our repo sizelimit.
  const message = await qStashSend(
    `https://${apexDomain}/irfc-admin/deploy`,
    setFiles,
    0,
    apiKey,
  );
  if (message.error) {
    return new Response(`Could not start deployment: ${message.error}`, {
      status: 500,
    });
  }

  return new Response("Success", { status: 200 });
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
