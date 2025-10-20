# Context Area - Fast, Smart Prompting for Devs

> [!TIP]
>
> **Looking for Sponsor**
> I'm looking for one or multiple sponsors that believe in context engineering and want me to build the best possible experience! Please [reach out on X](https://x.com/janwilmake)

## Goals

Create the best possible Cloud-Based Context Engineering Experience for Developers

- **Easy to Share** configurations and results with team
- **Good MCP integration**
- Strong Focus on Ease of use and Accessibility
- Edit Flow > Iterative Messaging
- URL Expansion with realtime insights (tokens, mediatype)
- Prompt Check (for OG, but also for missing context)
- Full Result is URL, each codeblock is URL
- Painpoint: Prompting workflows are very private, sharing functionality sucks. Visibility is value. Help devs share and monetise their learnings.
- Creating the best API for stateful chat completions
- Creating better ways of LLMs using tools
- Easy interface for chat completions standard
- X Login -> user-owned results, user payouts.
- Easy way to create "agents" that have many MCPs (by default)
- Integration with OpenRouter to make it super generic

## Non-goals

We are not aiming to match the UX non-technical folks need in any way.

- Chat history
- Inline previews
- Styles
- Integrations
- Uploads
- Tools

## Context Area - Fast, Smart Prompting for Devs

## Why Context Area?

contextarea offers several advantages over traditional AI assistants like Claude

## Feature Comparison

| Feature              | contextarea                | Claude                                                  | Why it matters                                                                                              |
| -------------------- | -------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Startup Speed**    | ✓ Instant (<100ms)         | ✗ Slow                                                  | contextarea is optimised for speed and TTFT. Results are cached.                                            |
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

Any contextarea URL is available as HTML, JSON, or Markdown. Browsers return HTML by default while developer or apis like `curl` or `fetch` default to markdown. You can control the output by appending `.json/.md/.html` or by specifying an `accept` header.

It's also possible to get a subset of the markdown through `?key=result|context|prompt`

Examples:

- in javascript, `fetch("https://contextarea.com/httpsuithubcomj-m8tfk00").then(res=>res.text())` returns markdown
- in your terminal, `curl https://contextarea.com/httpsuithubcomj-m8tfk00` returns markdown
- in the browser, https://contextarea.com/httpsuithubcomj-m8tfk00 returns the UI (html) but it's easy to get markdown using https://contextarea.com/httpsuithubcomj-m8tfk00.md or json using https://contextarea.com/httpsuithubcomj-m8tfk00.json
- if you need only the result or another part, you can use https://contextarea.com/httpsuithubcomj-m8tfk00.md?key=result

## Chat Completions

> [!IMPORTANT]
> Coming soon

Every prompt is made available as [chatcompletions endpoint](https://platform.openai.com/docs/guides/text-generation) at `POST https://contextarea.com/[id]/chat/completions`. This means you can use it by setting the base path in the [OpenAI SDK](https://platform.openai.com/docs/libraries) (or other ChatCompletion SDKs) to https://contextarea.com/[id], e.g. https://contextarea.com/httpsuithubcomj-m8tfk00. This will use the context as system prompt and the prompt as a fist 'model' message in the back.

To use a model other than the default model, you can specify the model parameter. For available models, check [models.json](models.json)

## Getting your API key

You can get your API key by going to the developer console in your browser, and find the `access_token` value in your cookies storage. This serves as authentication to any API. There's currently no scopes or ability to rotate your key, so be careful, this key is meant to be private, if it gets compromised, all your balance may be used by third parties.

## `npx mdapply` CLI

> [!IMPORTANT]
> Beta

You can use [mdapply](https://github.com/janwilmake/mdapply) to apply a response output to your local filesystem. Just run `curl "https://contextarea.com/[id]?key=result" -o apply.md && npx mdapply ./apply.md`

Try it yourself (this one will create `cli.js`) in your cwd:

```sh
curl "https://contextarea.com/httpsuithubcomj-m8tfk00?key=result" -o apply.md && npx mdapply ./apply.md
```

## 'Prompt it' buttons

Allowing users to easily prompt things about your open source library or template can really reduce friction for developers to adopt it.

- Point to specific contexts that are useful to use (parts of) your library
- Show how your project was made

You can link from your README, docs, or website to a prompt button using the following code:

HTML:

```html
<a href="https://www.contextarea.com/YOUR_ID" target="_blank">
  <img src="https://b.contextarea.com/YOUR_TEXT" />
</a>
```

Markdown:

```md
[![](https://b.contextarea.com/YOUR_TEXT)](https://www.contextarea.com/YOUR_ID)
```

Example:

```md
[![](https://b.contextarea.com/FAQ)](https://www.contextarea.com/httpsuithubcomj-u4l8lj0)
```

Result:

[![](https://b.contextarea.com/FAQ)](https://www.contextarea.com/httpsuithubcomj-u4l8lj0)

Any shared links that were previously generated are free to be reached without ratelimit. However, to do new prompts, please be aware that, although I aim to keep the free plan as big as possible, contextarea is not a free service, and as of now, amount of free, unauthenticated, prompts are capped at 5 per hour, and restricted to cheaper models such as OpenAI ChatGPT 4.1 mini. After this users are prompted to add a balance to keep going.

## Pricing

- All previously generated results are _cached forever_ and _free for everyone_ without ratelimits
- New users that didn't deposit $ with Stripe get 5 free prompts per hour. This may change in the future.
- After depositing $ through Stripe, users pay the model price + markup when executing new prompts.
- The markup is 50% markup on top of model price to account for free usage, creator benefits (coming soon), and make this tool sustainable.

## LOGIN TO DB

Aggregate: https://contextarea.com/db/admin-readonly

- Username: admin
- Password: DB_SECRET

User DB: https://letmeprompt.com/db/user-{client_reference_id}

- Username: admin
- Password: access_token

# Why contextarea vs IDEs or other LLM clients like Claude?

My personal reason was i want to replace claude because it's annoying:

- Very slow to start up and TTFT is terrible. contextarea hits within 100ms and doesn't need to wait for pageload to start seeing result, result is already starting in DO as soon as you submit.
- Claude doesn't support URLs out of the box. When i create a new app/worker, i usually add URLs as source of truth for context . with claude it was still a hassle to copy/paste afterwards. now, this is seamless and fast.
- Claude can render HTML and React. I don't use React so I don't care. I use HTML. Claude HTML renders are super limited, as they can't run scripts. contextarea HTML renders render scripts and anything else, and can be easily opened in fullscreen.
- Claude is generally slow, buggy, and unreliable on my machine. contextarea is snappy / fast
- It's hard to share something with someone else in claude, requires several clicks. contextarea is optimised for sharing
- contextarea incentivizes people to edit the prompt rather than reply, which usually gives better and less lengthy results as token windows become shorter from it. It also incentivizes people to reduce tokens. Claude does NOT do this

I think this is my main list.

Follow up posts (type them into markdown here, then just quote https://x.com/janwilmake/status/1924471476305932741) compare with claude on every aspect (6 posts).

- how can it be so fast?
- how does the monetisation and authentication work?
- how do I build my workers?
- why is edit workflow better than conversational?

# Table of Contents

- [connectconnector](connectconnector): simple landingpage for connectconnector.com
- [letmeprompt](letmeprompt): makes chat completions stateful, monetized with stripe, and adds nice frontend
- [letmeprompt.streamserve](letmeprompt.streamserve): way to quickly serve a UI streamed from a completion
- [mcp-completions](mcp-completions): chat completions proxy that adds authenticated mcp tools
- [mcp-completions-demo](mcp-completions-demo)
