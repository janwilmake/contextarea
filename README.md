create a cloudflare worker in js with doc-comments and //@check-ts and /// cloudflare worker types directive

it should

accept method post and get

check pathname and read kv key of that pathname. if already exist, return ./result.html content (import resultHtml from "./result.html"). add <script> with json of kv value to end of head.

if not:

get prompt, model, basePath, apiKey from FormData

serve share.html (import it using `import shareHtml from "./share.html")

set kv key pathname value {pending:true, prompt,model,basePath,apiKey}

send to queue with the formdata items gathered.

also, queue should:

read message body out

get all urls in the prompt using regex

fetch all urls in parallel, getting text back

the context is then constructed from the urls: format: {url}\n{text}\n------\n\n{url2}\n{text2}\n\n (etc)

do a call to llm using POST {basePath}/chat/completions with the context as system prompt (if any) and the prompt as first message content

the result is added to kv under key of pathname

=========

GOAL:

1. just a simple website to easily share a prompt with someone
2. elegant interface for URL-based context (reuse this later)
3. lot of traffic? add upsell

ADR:

- by design, I want to have a homepage, share page, and result page, so the user is incentivized to share. However, it may be better to combine them. with googling you kinda trust google to provide a good response. with llms we aren't there yet; you may want to verify. The share piece could be a footer visible on the result page.
- byok is a possibility to showcase models to people, but the main value proposition is shareability in general and an ability to use links as context building method. over-focusing on models might end up being an anti-pattern. i focus on context building instead, allowing lmpify to become a embeddable piece into any website through API and script.

PRIORITY: use myself

- ✅ use "stripeflare" to serve all pages with user-balance and dynamic payment link.
- Add gemini and anthropic and proper credit deduction
- also add `model-modal.js` to resultpage, making it possible to repost it with a different model
- remove byok (for now) and focus on 1 cheap model and 1 high-quality model
- prune long fetch text responses and sanitise html
- ensure claude sonnet and gemini flash are indeed available and selectable.
- count free requests at user-level, and reset daily. limit max free requests per day to 10

CONNECTION WITH context.json

- make my own personal landingpage that has a simple textarea and a bunch of contexts to easily click to add to the input box that links through to lmpify. for this, use an endpoint for all my lists where it finds and applies context.json and .genignore in each and shows different context's

CONNECTION WITH MCP

- maybe stripeflare with MCP is a better connection than this. this, however, could be refined into something that generates an mcp. All i need is todo, is create a landingpage where the textarea text is prefixed with context on how to build an MCP and instructions to actually build an MCP.
- then, on the result page, we wanna allow actions with the codeblocks like i had with chat.forgithub.com. chatcompletions is a good building block here. ideally, you wanna allow turning it into a repo
- keep the mcp boilerplate private!

QOL:

- result page should also render markdown when doing non-browser-based fetch or when adding `.md`
- should calculate og details based on prompt
- should pregenerate og:image (https://github.com/janwilmake/github-og-image) and add that into `result.html` (follow path routing of https://github.com/janwilmake/user-agent-router)
- paste large texts should turn into a URL
- button to try with other model on result page
- bonus: add modal to upload image(s)
- bonus: openapi and instructions so people can embed this into their own website(s) - also - maybe a js-based embed could be pretty cool like twitter.
- bonus: /context/{url} to pre-add context (including nice card for it)
- improve funnyness when entering the page??? be creative. how can i make this super viral
- super idea: if at least one URL returns a `multipart/form-data` stream or file object, take the biggest of those, and use it with `uithub.filetransformers` with the rest of the prompt. we now apply the prompt on every file. Critical component: detecting streamable url response early + proxy traffic.
