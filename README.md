# Context Area - Fast, Smart Prompting for Devs

[Thread](https://x.com/janwilmake/status/1980588668826902890)

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

## Contents of this repo

ContextArea frontend-element:

- [contextarea-js](contextarea-js) - js lib for a frontend element to easily work with context in a textarea
- [context](context) - where the context from the `<contextarea>` is stored
- [pastebin](pastebin) - a place where pastes get stored and made accessible as small url

Utilities

- [stream-server](stream-server) - serves the output files as they are generated

Other:

- [redirects](redirects) - redirect from old names lmpify.com and letmeprompt.com

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

## URL Context

Only urls that return textual results are supported for now. HTML is disabled by design to incentivize users to improve their context.

Some recommend contexts are:

- https://xymake.com for X threads
- https://uithub.com for GitHub context with filters applied
- https://openapisearch.com for APIs
- https://arxivmd.org for ArXiv papers

## Result format

Any contextarea URL is available as HTML, JSON, or Markdown. Browsers return HTML by default while developer or apis like `curl` or `fetch` default to markdown. You can control the output by appending `.json/.md/.html` or by specifying an `accept` header.

It's also possible to get a subset of the markdown through `?key=result|context|prompt`

Examples:

- in javascript, `fetch("https://contextarea.com/httpsuithubcomj-m8tfk00").then(res=>res.text())` returns markdown
- in your terminal, `curl https://contextarea.com/httpsuithubcomj-m8tfk00` returns markdown
- in the browser, https://contextarea.com/httpsuithubcomj-m8tfk00 returns the UI (html) but it's easy to get markdown using https://contextarea.com/httpsuithubcomj-m8tfk00.md or json using https://contextarea.com/httpsuithubcomj-m8tfk00.json
- if you need only the result or another part, you can use https://contextarea.com/httpsuithubcomj-m8tfk00.md?key=result

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

# Table of Contents

- [contextarea](contextarea): makes chat completions stateful, monetized with stripe, and adds nice frontend
- [connectconnector](connectconnector): simple landingpage for connectconnector.com
- [stream-server](stream-server): way to quickly serve a UI streamed from a completion
- [mcp-completions](mcp-completions): chat completions proxy that adds authenticated mcp tools
- [mcp-completions-demo](mcp-completions-demo)
