import { mergeObjectsArray } from "edge-util";

function removeHtmlComments(markdown: string): string {
  return markdown.replace(/<!--[\s\S]*?-->/g, "");
}

/**
 * splits a markdown string into its frontmatter object and the raw content (without frontmatter)
 */
export const parseFrontmatterMarkdownString = (
  markdownWithFrontmatter: string,
  config?: { noFinal?: boolean; noComments?: boolean },
) => {
  const lines = markdownWithFrontmatter.split("\n");

  const frontmatterStartIndex = lines.findIndex((x) => x === "---");

  //console.log({ frontmatterStartIndex });
  if (frontmatterStartIndex === -1) {
    return { raw: markdownWithFrontmatter, parameters: {} };
  }

  const linesAfterStart = lines.slice(frontmatterStartIndex + 1);
  const frontmatterEndIndex =
    linesAfterStart.findIndex((x) => x === "---") + frontmatterStartIndex + 1;

  //console.log({ frontmatterEndIndex });
  const frontmatterLines = lines.slice(
    frontmatterStartIndex + 1,
    frontmatterEndIndex,
  );

  const parameters = mergeObjectsArray(
    frontmatterLines.map((line) => {
      const needTrim = !config?.noFinal;
      const key = line.split(":")[0]?.trim();
      const value = line.split(":")[1];
      const finalValue = needTrim ? value?.trim() : value;

      return { [key]: finalValue };
    }),
  );

  const raw = lines.slice(frontmatterEndIndex + 1).join("\n");

  return {
    parameters,
    raw: config?.noComments ? removeHtmlComments(raw) : raw,
  };
};
