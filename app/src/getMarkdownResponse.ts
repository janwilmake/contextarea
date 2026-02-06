import { Token, lexer } from "marked";

/** Recursively flatten a marked token and return something if a find function is met */
const flattenMarkedTokenRecursive = (
  token: Token,
  findFunction: (token: any) => boolean,
): Token[] => {
  if (findFunction(token)) {
    return [token];
  }

  if (token.type === "table") {
    const header = token.header
      .map((token: any) => {
        const result = token.tokens
          .map((x: any) => flattenMarkedTokenRecursive(x, findFunction))
          .flat();
        return result;
      })
      .flat();

    const rows = token.rows
      .map((row: any) => {
        const result = row
          .map((token: any) => {
            const result = token.tokens
              .map((x: any) => flattenMarkedTokenRecursive(x, findFunction))
              .flat();

            return result;
          })
          .flat();

        return result;
      })
      .flat();

    return [header, rows].flat();
  }

  if (token.type === "list") {
    const result = token.items
      .map((token: any) => {
        const result = token.tokens
          .map((x: any) => flattenMarkedTokenRecursive(x, findFunction))
          .flat();
        return result;
      })
      .flat();

    return result;
  }

  if (
    token.type === "del" ||
    token.type === "em" ||
    token.type === "heading" ||
    token.type === "link" ||
    token.type === "paragraph" ||
    token.type === "strong"
  ) {
    if (!token.tokens) {
      return [];
    }
    const result = token.tokens
      .map((x: any) => flattenMarkedTokenRecursive(x, findFunction))
      .flat();
    return result;
  }

  return [];
};

/**
 * find all items that match a token, recursively in all nested things
 */
export const flattenMarkdownString = (
  markdownString: string,
  findFunction: (token: Token) => boolean,
): Token[] => {
  const tokenList = lexer(markdownString);
  const result = tokenList
    .map((x) => flattenMarkedTokenRecursive(x, findFunction))
    .filter((x) => !!x)
    .map((x) => x!)
    .flat();

  return result;
};

/**
 * find all codeblocks  (stuff between triple bracket)
 */
const findCodeblocks = (
  markdownString: string,
): {
  text: string;
  lang?: string;
  parameters?: { [key: string]: string };
}[] => {
  const result = flattenMarkdownString(
    markdownString,
    (token) => token.type === "code",
  );

  const codesblocks = result
    .map((token) => {
      if (token.type !== "code") return;

      const { text, lang } = token;

      const [ext, ...meta] = lang ? (lang as string).trim().split(" ") : [];
      const parameters = Object.fromEntries(
        meta.map((chunk) => {
          const key = chunk.split("=")[0].trim();
          const value0 = chunk.split("=").slice(1).join("=").trim();
          const isQuoted =
            (value0.startsWith('"') && value0.endsWith('"')) ||
            (value0.startsWith("'") && value0.endsWith("'"));

          const value = isQuoted ? value0.slice(1, value0.length - 1) : value0;

          return [key, value];
        }),
      );

      return { text, lang: ext, parameters };
    })
    .filter((x) => !!x)
    .map((x) => x!);

  return codesblocks;
};

/** get a markdown response for a generation */
export const getMarkdownResponse = (
  pathname: string,
  data: {
    prompt: string;
    model: string;
    result?: string;
    context?: string;
    headline?: string;
  },
  key?: "prompt" | "result" | "context" | null,
  codeblock?: string | null,
): string => {
  if (key) {
    // allow returning a specific key
    const value = data[key];

    if (!value) {
      if (!["prompt", "result", "context"].includes(key)) {
        return "Please provide key prompt, result, or context";
      }
      return `${key} not found.`;
    }

    if (codeblock) {
      const codeblocks = findCodeblocks(value);
      const selected = !isNaN(Number(codeblock))
        ? codeblocks[Number(codeblock)].text
        : codeblocks.find((item) => item.parameters?.path === codeblock)?.text;
      if (!selected) {
        return "Codeblock not found. Please provide the index (number) or filename that was specified using 'path' parameter";
      }

      return selected;
    }

    return value;
  }

  let markdownResponse = `# ${data.headline || pathname}\n\n`;

  // Add prompt section
  // TODO: Find longest fence character count
  const longestFenceCharacterCount = 3;
  const fence =
    longestFenceCharacterCount > 10
      ? "~~~"
      : "`".repeat(longestFenceCharacterCount + 1);

  markdownResponse += `## Prompt\n\n${fence}md path="prompt.md"\n`;
  markdownResponse += data.prompt;
  markdownResponse += `\n${fence}\n\n`;

  // Add context section if available
  if (data.context) {
    const longestFenceCharacterCount = 3;
    const fence =
      longestFenceCharacterCount > 10
        ? "~~~"
        : "`".repeat(longestFenceCharacterCount + 1);

    markdownResponse += `## Context\n\n${fence}md path="context.md"\n`;

    markdownResponse += data.context;
    markdownResponse += `\n${fence}\n\n`;
  }

  // Add result section if available
  if (data.result) {
    const longestFenceCharacterCount = 3;
    const fence =
      longestFenceCharacterCount > 10
        ? "~~~"
        : "`".repeat(longestFenceCharacterCount + 1);

    markdownResponse += `## Result\n\n${fence}md path="result.md"\n`;
    markdownResponse += data.result;
    markdownResponse += `\n${fence}\n\n`;
  } else {
    markdownResponse += "## Status\n\n";
    markdownResponse += `Model: ${data.model}\n`;
  }
  return markdownResponse;
};
