import { promptSuffixes } from "./constants.js";

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
