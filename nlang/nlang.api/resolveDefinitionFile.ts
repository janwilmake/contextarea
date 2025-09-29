import { resolveDefinitionFileStep } from "./resolveDefinitionFileStep";
import { CompileContext, Step } from "./types";

/**
First implementation nlang: stackable extensions recurse doing feeding each step into the next
*/
export const resolveDefinitionFile = async (context: CompileContext) => {
  const {
    content,
    originApiKey,
    originUrl,
    originalPath,
    route,
    path,
    llmApiKey,
    llmBasePath,
    llmModelName,
  } = context;

  if (!content || !originalPath) {
    return { error: "Invalid input: Need definitionfile", status: 400 };
  }

  const filename = originalPath.split("/").pop()!;
  const routeFilename = route.split("/").pop()!;

  // e.g. about.json.url.md.md
  // goes through this transformation
  // 1. about.json.url.md.md
  // 2. about.json.url.md
  // 3. about.json.url
  // 4. about.json

  const chunks = filename.split(".");

  const stack: Step[] = [{ output: { content } }];

  for (const index of chunks.slice(0, chunks.length - 2).keys()) {
    console.log("key", index);
    const withoutLastExtensionsCount = index;

    const filenameHere = filename
      .split(".")
      .slice(0, chunks.length - withoutLastExtensionsCount)
      .join(".");

    const routeFilenameHere = routeFilename
      .split(".")
      .slice(0, chunks.length - withoutLastExtensionsCount)
      .join(".");

    let routeAtStep = route.replace(routeFilename, routeFilenameHere);
    routeAtStep = routeAtStep.startsWith("/public/")
      ? routeAtStep.slice("/public".length)
      : routeAtStep;

    let pathAtStep = originalPath.replace(filename, filenameHere);
    pathAtStep = pathAtStep.startsWith("/public/")
      ? pathAtStep.slice("/public".length)
      : pathAtStep;

    const content = stack[stack.length - 1].output.content;

    const input = {
      content,
      originUrl,
      originApiKey,
      pathAtStep,
      routeAtStep,
      path,
      llmApiKey,
      llmBasePath,
      llmModelName,
    };

    const output = await resolveDefinitionFileStep(input);

    stack.push({ input, output });
  }

  return {
    /** First step is input in the next */
    stack: stack.slice(1),
  };
};
