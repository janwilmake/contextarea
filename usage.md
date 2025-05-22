# Usage

## URL Context

Only urls that return textual results are supported for now. HTML is disabled by design to incentivize users to improve their context.

Some recommend contexts are:

- https://xymake.com for X threads
- https://uithub.com for GitHub context with filters applied
- https://openapisearch.com for APIs

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

You can use [mdapply](https://github.com/janwilmake/mdapply) to apply a response output to your local filesystem. Just run `curl https://lmpify.com/[id]?key=result -o apply.md && npx mdapply ./apply.md`
