# Why extexe

```ts
import { AutoRouter, IRequest } from "itty-router";
const dataMapWorker = (context: {
  prompt: string;
  base: string;
  model: string;
  inputPattern: string;
  routePattern: string;
  mapFn: (request: IRequest) => { [key: string]: string };
}) => {
  const { base, inputPattern, mapFn, model, routePattern, prompt } = context;
  const llmApiKey = "";

  return AutoRouter().get(routePattern, async (request) => {
    const input = mapFn(request);
    const originalUrl = Object.keys(input).reduce(
      (previous, current) => previous.replace(`:${current}`, input[current]),
      inputPattern,
    );

    const response = await fetch(
      `https://chatcompletions.com/from/${encodeURIComponent(
        originalUrl,
      )}/base/${base}/model/${model}/prompt/${encodeURIComponent(
        prompt,
      )}/codeblock.json?llmApiKey=${llmApiKey}`,
    );

    if (!response.ok) {
      return new Response(await response.text(), { status: response.status });
    }

    const json = await response.json();

    return new Response(JSON.stringify(json, undefined, 2), {
      headers: { "Content-Type": "application/json" },
    });
  });
};
export default dataMapWorker({
  // from one url
  inputPattern: "https://uithub.com/:owner/:repo?accept=application/json",
  // to a similar route
  routePattern: "/:owner/:repo/analysis",
  // if we could get this one automatically, it's a JSON serializable datstructure though! it can be done.
  mapFn: ({ owner, repo }) => ({ owner, repo }),
  // do a transformation on the data with an LLM
  base: "https://anthropic.actionschema.com",
  model: "claude-3-5-sonnet-20241022",
  prompt: ``,
});
```

OR

```ts
export const x = AutoRouter().get("/:owner/:repo/analysis", async (request) => {
  const { owner, repo } = request;
  const originalUrl = `https://uithub.com/${owner}/${repo}?accept=application/json`;
  const base = "https://anthropic.actionschema.com";
  const model = "claude-3-5-sonnet-20241022";
  const llmApiKey = "";
  const prompt = ``;
  const response = await fetch(
    `https://chatcompletions.com/from/${encodeURIComponent(
      originalUrl,
    )}/base/${base}/model/${model}/prompt/${encodeURIComponent(
      prompt,
    )}/codeblock.json?llmApiKey=${llmApiKey}`,
  );

  if (!response.ok) {
    return new Response(await response.text(), { status: response.status });
  }

  const json = await response.json();

  return new Response(JSON.stringify(json, undefined, 2), {
    headers: { "Content-Type": "application/json" },
  });
});
```

## VERDICT

- what im doing above is basically a structured variant of extexe but more limited.

- what im doing below is a raw codegeneration that does a transformation like extexe.

- what extexe does is that it basically transforms the markdown into the code generation below, rather than abstracting away using a datastructure. Although, that's the goal.

The advantage being...

1. More flexible as it's any code we generate. Of course, this can also be seen as a disadvantage, as it can make mistakes.

2. More readable as it's in markdown rather than some datastructure, and the actual executed code that is generated is also much more simple, as there is no abstraction to an arbitrary datastructure.

## CONCLUSION

Insight: my coding style is changing over the last months. Compared to what I was doing in KingOS, I'm now doing way fewer abstractions, relying much more on generation. The prompts are easier to write than code and just as effective.

I'm becoming more flexible and the code becomes more readable.

I should focus on extexe. It's not worth creating all these maps now without it! It's just too time consuming as the generated code here is far less readable and editable than the NL definitions.

The big advantage of NL definitions: you can keep them and edit them rather than throwing them away after the code is generated.

# Update December 2024

Since I want some generations to be lazy, possibly make it as lazy as possible, it makes more sense to store the dependency structure of exts and simply have a router that calls the right LLM URLs as they get requested in the router.

An extexe router is already dificult in itself, so it makes sense to do this first, then later make it be done in the compilation step rather than lazily. If we only do it in the compilation step, we'll loose some core functionality!

**Huge insight**: With just chatcompletions being ACIDly cached and the extexe-router working fully, I WON'T NEED A MULTI-STEP WORKFLOW AS THE URLS RECURSE.

Simply speaking there are 3 implementations possible of increasing complexity:

1. **SIMPLE** A router that resolves both the code and the LLM generations lazily, that doesn't do any depdency yet.
2. **RECURSIVE** A lazy router that also resolves dependencies and api-calls recursively. This is definitely needed but doesn't need to be hard with a good chatcompletions.com
3. **BACKEND** Compile-time extexe calculation that gets put onto a fileobject and deployed as direct static entrypoint as a cloudflare worker. Rather than assets in the worker, keep it simple and forward all that doesn't hit the worker itself to `githus` worker to get assets dynamically.

# Nlang for alignment

Translating desires into computed outcomes reliably is potentially a solution to the alignment problem.
https://www.youtube.com/watch?v=nUV5-SLdkuQ
