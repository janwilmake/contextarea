Long flow:

gh -> uithub -> your lists repos + starred + repos -> contexts -> try it button -> lmpify -> claude? pay.

Shorter flow:be the product

- collect some ctx links
- make spec in lmpify with links
- run and iterate
- happy? share on x.

^ shows the power of uithub contexts already. IF:

- when typing urls already get extrapolated into cards and cached
- when loaded again, this is metadata directly visible and clickable
- og image / title shows gist of prompt

# PRIORITY: REPLACE CLAUDE (2025-05-12 until 2025-05-16)

- ✅ use "stripeflare" to serve all pages with user-balance and dynamic payment link.
- ✅ also add `model-modal.js` to resultpage, making it possible to repost it with a different model
- ✅ remove byok (for now) and focus on 1 cheap model and 1 high-quality model
- 🤔 Figure out why it's so slow. It's due to 2 things. 1: kv is not being consistent, and 2: due to queue not handling things directly. A better approach might be a `LLMStreamDO`. make that!
- ✅ make stream.chatcompletions.com cache proxy
- ✅ Integrate with LLMStreamDO or variant thereof to make things instant. pattern is: instant-in-do-stream(-and-back-if-needed-or-later), globally subscribable realtime, eventually-pushed-to-the-edge https://x.com/janwilmake/status/1922437388258726270
- ✅ 🔥 Added `/from/{promptUrl}` endpoint to integrate with any URL as startingpoint more easily (e.g. from github). Refactored logic to allow for GET request to DO
- ✅ `Error in DO fetch: RangeError: Values cannot be larger than 131072` - storage of prompt is too large! Also context! This needs solving, potentially use SQLite one row per key.
- ✅ Prune long prompt inputs and prune long fetch text responses from URLs. This is a separate function I already did before. work in `lmpify.context`
- ✅ Sanetize/DOMPurify JSON before putting it into HTML
- ✅ 🤔 I thought it worked, but when refreshing while it's generating, it actually doesn't find the same stream now, anymore! Maybe, the migration to SQLite fucked it up? Make this work as desired. **Improved setup, state handling and fixed bug**
- ✅ properly renders og-image meta tags etc
- ✅ renders a preliminary og image
- ✅ Should calculate 'og-details' based on prompt in the DO
- ✅ **self-links**: result page should also render markdown when doing non-browser-based fetch or when adding `.md` similar to chatcompletions, prompt md should also be a link, context md also.
- ✅ `?q={EncodedString}` to pre-add context to homepage.
- ✅ Added proper markdown highlighting
- ✅ Ability to copy codeblocks.
- ✅ Mobile friendly ✅ `result.html` ✅ `index.html`
- ✅ Ensure geneated title is also based on context, not just prompt

# Monetisation

- Count free requests at user-level, give max 10 total free requests.
- Ensure claude sonnet 3.7 works too. Model must be stored in localstorage and KV.
- Ensure pricing is properly applied. Confirm monetisation works.
- Handle 402 gracefully. In model selection, show balance, making it bigger/red when low.

💪 TODO: 1) ✅ purify prompt/context, 2) ❌ make claude & freemium monetisation work 3) ✅ make og-data work! It's usable now for myself and to share results easily!

# JSON Parse

- Fix annoying JSON parser bug when having `</script>`
- https://www.lmpify.com/from/https://uithub.com/janwilmake/xymake <-- still no good

# Launch

If usable, start using it instead of Claude.

Proposed flow:

1. make post on X
2. use xymake url and a prompt
3. now get resulting files and a cli to paste them into cwd

# BUGS

- 🟠 Resultpage loads somewhat slow now due to stripe middleware. It was supposed to be fast, so let's figure out why it is NOT fast. in private window, the DO is super fast. in current safari https://lmpify.com is slow (500+ms). figure out where it's located and how this is possible!? https://x.com/janwilmake/status/1922592298904219859 - potential solution; refresh access token after 24h so the DO doesn't stay slow, but gets refreshed; but need a proper transfer method for this too. It'd also be good to understand the problem better: log DO response time in `stripeflare` package with warning if its over 100ms?
- 🟠 In localhost, the thing isn't working as the server restarts. see where this bug comes from by changing versions and/or removing stuff (and ask claude)

# High impact features:

- **pastebin**: paste large texts should turn into a URL to keep it easy to oversee the prompt. use pastebin as imported code `from "./lmpify.pastebin/pastebin"` (`/lmpify.pastebin/README.md`)
- **context cards**: for each link in the prompt, the frontend should have an api to render the context card for it which includes url, title, tokens, og-image, and more. these should be dynamically rendered below your prompt, and must be clear which belongs to which url somehow. when a prompt is pre-loaded, context cards may be pre-loaded from head JSON
- **images support** the contextarea.context api returns mediatype, so we can embed images as images into chat/completions.
- **edit history**; either by storing a single previous link, all previous links in array, only all previous metadata, or all previous contents. Sidebar to scroll through the edit history.

# Layers on top of lmpify: `context.json` or code generator: Great for

- A js-based embed (`<div id="lmpify"></div><script src="https://lmpify.com/widget.js?query=a&b=c&d=e"></script>`) which renders it into a div, as a widget, in several sizes/ways (Could be separate files too)
- IDEA 1 = CONTEXT BUILDER: make my own personal landingpage that has a simple textarea and a bunch of contexts to easily click to add to the input box that links through to lmpify. for this, use an endpoint for all my lists where it finds and applies context.json and .genignore in each and shows different context's
- IDEA 2 = SYSTEM PROMPT SELECTOR: similar to https://mcpify.ai but with minimal code, I could build something that'd link through to lmpify. If I then OSS that template, I can convince people to build these with their own set of prompts, and make them earn money.
- IDEA 3 = Paid prompts. A way to incentivize people to share a prompt is by allowing them to price it. Not sure if this should be core or a layer on top somehow, but it could be a great product after people create collections.
- Idea: bookmarks - ability to save cool generations

## CONNECTION WITH MCP

- Create OpenAPI for the DO and for the worker, making it super clear how its used. Could it become a monetised MCP?
- maybe stripeflare with MCP is a better connection than this. this, however, could be refined into something that generates an mcp. All i need is todo, is create a landingpage where the textarea text is prefixed with context on how to build an MCP and instructions to actually build an MCP.
- then, on the result page, we wanna allow actions with the codeblocks like i had with chat.forgithub.com. chatcompletions is a good building block here. ideally, you wanna allow turning it into a repo
- Keep the mcp boilerplate private!

# QOL:

- Every codeblock should be available using the proper mediatype at `https://{slug}-{hash}.lmpify.com/{path}`. All links should be easy to find and add to the prompt.
- 'claim prompt' and 'link balance' buttons: login with X
- Improve funnyness when entering the page??? be creative. how can i make this super viral
- super idea: if at least one URL returns a `multipart/form-data` stream or file object, take the biggest of those, and use it with `uithub.filetransformers` with the rest of the prompt. we now apply the prompt on every file. Critical component: detecting streamable url response early + proxy traffic.
- Idea: "hooks" - plugins users can install that allow performing additional analysis on the prompt, context, and result. This could become a marketplace in itself.
- IDEA: `/from/{url}` could be what shows up in address bar, may make it easier to learn that convention, or at least show it in the interface, if it was the source.
