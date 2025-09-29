import { domains } from "../src/vector/domains.js";
import { apexDomain } from "./constants.js";

// domain used when visiting from localhost
//main_shuffle-agents_  main_simple-hackernews-api_
const localDomain = "codefromanywhere.irfc.cloud";
const gitstyleDomains = ["irfc.cloud"];
const apexRepo = {
  // NB: use lowercase!
  owner: "codefromanywhere",
  repo: "irfc-cloud",
  branch: "main",
};
export const destructureHostname = async (hostname: string) => {
  const realHostname = hostname === "localhost" ? localDomain : hostname;
  if (hostname === apexDomain || hostname === "www." + apexDomain) {
    return apexRepo;
  }

  if (gitstyleDomains.find((x) => realHostname.endsWith("." + x))) {
    const subdomain = realHostname.split(".").reverse()[2];
    const chunks = subdomain.split("_");
    const owner = chunks.pop()?.toLowerCase();
    const branch = chunks.shift()?.toLowerCase();
    const repo =
      chunks.join("_") === "" ? undefined : chunks.join("_")?.toLowerCase();

    if (!owner) {
      return;
    }

    return { owner, branch, repo };
  }

  // any freeform domains will end up here
  return lookupDomain(realHostname);
};

/** Not supported yet */
export const lookupDomain = async (hostname: string) => {
  const details = (await domains.fetch(hostname))?.metadata;

  if (!details) {
    return;
  }
  // How to support this? can probably only be done via cloudflare, because vercel has a limit on domains.
  // https://claude.ai/chat/9fbe4fa6-786b-4a2a-9bd6-b5b524631a44
  // Free plan limit is 1000, which should be sufficient and doable as a starting point. After we go over 1000, we can split across zones with proxies and scale to an enterprise plan.

  // TODO:
  // 0) ensure users can register a domain and with a verification txt record if someone else had already registered it. add to cloudflare and ask them to fill the record properly.
  // 1) receive the hostname here, look up hostname in vector-db
  // 2) if available, link to owner/repo
  return details;
};
