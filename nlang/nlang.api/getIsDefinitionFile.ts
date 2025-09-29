export const allowedDefinitionExtensions = ["url", "md", "ts", "js"];
export const getIsDefinitionFile = (path: string) => {
  const filename = path.split("/").pop()!;
  const fileChunksReversed = filename.split(".").reverse();
  const lastChunk = fileChunksReversed[0];
  const isDefinitionFile =
    allowedDefinitionExtensions.includes(lastChunk) &&
    fileChunksReversed.length > 2;
  return isDefinitionFile;
};
