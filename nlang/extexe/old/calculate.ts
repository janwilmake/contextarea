import { owner } from "./vector";

/**
 * Calculate is where the magic happens. Because it requires multiple levels of LLM inference, we should make this a streamer
 

TODO:


- Ensure this calculation is done using a claude-agent that has an API to access files in the src as well as in the generated code, so it has all the required context

- Calculate code using the right agents: html, js, backend, defintion, openapi

- This should work well. When updating a page we want to see if a new version is coming with a loading indicator and 'refresh' button once its done!

 */
export const calculatePOST = async (request: Request) => {
  // either owner auth-token or github master secret
  const authToken = request.headers
    .get("Authorization")
    ?.slice("Bearer ".length);

  if (
    // !process.env.VAL_TOKEN ||
    !process.env.UPSTASH_VECTOR_REST_URL ||
    !process.env.UPSTASH_VECTOR_REST_TOKEN ||
    !process.env.GITHUB_MASTER_SECRET
  ) {
    console.error("/set - Invalid keys");
    return new Response("Invalid keys", {
      status: 400,
      statusText: "Invalid keys",
    });
  }

  const isGithubMasterSecret = authToken
    ? authToken === process.env.GITHUB_MASTER_SECRET
    : false;

  const ownerLogin =
    authToken && !isGithubMasterSecret
      ? (await owner.getOwner(authToken))?.metadata?.owner
      : undefined;

  if (!authToken || (!isGithubMasterSecret && !ownerLogin)) {
    console.log("Unauthorized", { ownerLogin, authToken });
    return new Response("Unauthorized", {
      status: 403,
      statusText: "Unauthorized",
    });
  }

  // calculate code/openapi/summary etc using LLM
  const json = await request.json();
  // for now just pass it back with summary

  const newJson = { ...json, summary: json.path };
  return new Response(JSON.stringify(newJson), { status: 200 });
};
