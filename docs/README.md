# Let Me Prompt It For You - Fast, Smart Prompting for Devs

Launch:

- https://x.com/janwilmake/status/1924471476305932741
- https://news.ycombinator.com/item?id=44030556
- https://www.producthunt.com/posts/let-me-prompt-it-for-you-lmpify-com

Ask anything about the docs: [![](https://b.lmpify.com)](https://www.lmpify.com/httpsuithubcomj-u4l8lj0)

# Why lmpify?

lmpify offers several advantages over traditional AI assistants like Claude

## Feature Comparison

| Feature              | lmpify                     | Claude                                                  | Why it matters                                                                                              |
| -------------------- | -------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Startup Speed**    | ✓ Instant (<100ms)         | ✗ Slow                                                  | lmpify is optimised for speed and TTFT. Results are cached.                                                 |
| **Performance**      | ✓ Snappy & reliable        | ✗ Often slow & buggy                                    | Consistent, responsive experience without frustrating delays or crashes                                     |
| **URLs as Context**  | ✓ Built-in                 | ✗ Only with MCP                                         | Seamlessly reference external textual files (md, json, etc) without having to first toolcall them.          |
| **HTML Rendering**   | ✓ Full capability          | ✗ Limited (no scripts)                                  | Complete HTML renders with scripts and full-screen support. Great for prototyping.                          |
| **Sharing**          | ✓ One-click                | ✗ Multiple steps, buggy                                 | Instantly share prompts and results with a simple URL                                                       |
| **Token Efficiency** | ✓ Incentivizes edit        | ✗ Designed as chat with history                         | Encourages prompt editing over replies, resulting in less token use and better results with the same model. |
| **Long Output**      | ✓ Up to limit of model API | ✗ Limits at ±8k output tokens, continue button is buggy | Long outputs can be useful when generating long files.                                                      |

# DOCS

## URL Context

Only urls that return textual results are supported for now. HTML is disabled by design to incentivize users to improve their context.

Some recommend contexts are:

- https://xymake.com for X threads
- https://uithub.com for GitHub context with filters applied
- https://openapisearch.com for APIs
- https://arxivmd.org for ArXiv papers

Are you a high-agency product engineer? Join the [Context Building Club](https://contextbuilding.com) to get access to the most advanced and high-agency prompting techniques before everyone else.

## Result format

Any lmpify URL is available as HTML, JSON, or Markdown. Browsers return HTML by default while developer or apis like `curl` or `fetch` default to markdown. You can control the output by appending `.json/.md/.html` or by specifying an `accept` header.

It's also possible to get a subset of the markdown through `?key=result|context|prompt`

Examples:

- in javascript, `fetch("https://lmpify.com/httpsuithubcomj-m8tfk00").then(res=>res.text())` returns markdown
- in your terminal, `curl https://lmpify.com/httpsuithubcomj-m8tfk00` returns markdown
- in the browser, https://lmpify.com/httpsuithubcomj-m8tfk00 returns the UI (html) but it's easy to get markdown using https://lmpify.com/httpsuithubcomj-m8tfk00.md or json using https://lmpify.com/httpsuithubcomj-m8tfk00.json
- if you need only the result or another part, you can use https://lmpify.com/httpsuithubcomj-m8tfk00.md?key=result

## Chat Completions

> [!IMPORTANT]
> Coming soon

Every prompt is made available as [chatcompletions endpoint](https://platform.openai.com/docs/guides/text-generation) at `POST https://lmpify.com/[id]/chat/completions`. This means you can use it by setting the base path in the [OpenAI SDK](https://platform.openai.com/docs/libraries) (or other ChatCompletion SDKs) to https://lmpify.com/[id], e.g. https://lmpify.com/httpsuithubcomj-m8tfk00. This will use the context as system prompt and the prompt as a fist 'model' message in the back.

To use a model other than the default model, you can specify the model parameter. For available models, check [models.json](models.json)

## Getting your API key

You can get your API key by going to the developer console in your browser, and find the `access_token` value in your cookies storage. This serves as authentication to any API. There's currently no scopes or ability to rotate your key, so be careful, this key is meant to be private, if it gets compromised, all your balance may be used by third parties.

## `npx mdapply` CLI

> [!IMPORTANT]
> Beta

You can use [mdapply](https://github.com/janwilmake/mdapply) to apply a response output to your local filesystem. Just run `curl "https://lmpify.com/[id]?key=result" -o apply.md && npx mdapply ./apply.md`

Try it yourself (this one will create `cli.js`) in your cwd:

```sh
curl "https://lmpify.com/httpsuithubcomj-m8tfk00?key=result" -o apply.md && npx mdapply ./apply.md
```

## 'Prompt it' buttons

Allowing users to easily prompt things about your open source library or template can really reduce friction for developers to adopt it.

- Point to specific contexts that are useful to use (parts of) your library
- Show how your project was made

You can link from your README, docs, or website to a prompt button using the following code:

HTML:

```html
<a href="https://www.lmpify.com/YOUR_ID" target="_blank">
  <img src="https://b.lmpify.com/YOUR_TEXT" />
</a>
```

Markdown:

```md
[![](https://b.lmpify.com/YOUR_TEXT)](https://www.lmpify.com/YOUR_ID)
```

Example:

```md
[![](https://b.lmpify.com/FAQ)](https://www.lmpify.com/httpsuithubcomj-u4l8lj0)
```

Result:

[![](https://b.lmpify.com/FAQ)](https://www.lmpify.com/httpsuithubcomj-u4l8lj0)

Any shared links that were previously generated are free to be reached without ratelimit. However, to do new prompts, please be aware that, although I aim to keep the free plan as big as possible, lmpify is not a free service, and as of now, amount of free, unauthenticated, prompts are capped at 5 per hour, and restricted to cheaper models such as OpenAI ChatGPT 4.1 mini. After this users are prompted to add a balance to keep going.

## Pricing

- All previously generated results are _cached forever_ and _free for everyone_ without ratelimits
- New users that didn't deposit $ with Stripe get 5 free prompts per hour. This may change in the future.
- After depositing $ through Stripe, users pay the model price + markup when executing new prompts.
- The markup is 50% markup on top of model price to account for free usage, creator benefits (coming soon), and make this tool sustainable.
