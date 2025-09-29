type ContextObject = {
  [key: string]: { contextUrls: string[]; generated: boolean };
};

export function pathToContextObject(path: string): ContextObject {
  // If there's only one extension, return empty object
  if (path.split(".").length <= 2) {
    return {};
  }

  const result: ContextObject = {};
  const pathParts = path.split(".");

  // Start from the base path up to second-to-last extension
  for (let i = 0; i < pathParts.length - 2; i++) {
    // Current full path up to current extension
    const currentFullPath = pathParts.slice(0, i + 2).join(".");
    // Next path including next extension
    const nextFullPath = pathParts.slice(0, i + 3).join(".");

    result[currentFullPath] = { contextUrls: [nextFullPath], generated: true };
  }

  return result;
}
