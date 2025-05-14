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

# (need:metadata+context gather api -> reuse og:images already made if available)

# PRIORITY: REPLACE CLAUDE.

- ✅ use "stripeflare" to serve all pages with user-balance and dynamic payment link.
- ✅ also add `model-modal.js` to resultpage, making it possible to repost it with a different model
- ✅ remove byok (for now) and focus on 1 cheap model and 1 high-quality model
- 🤔 Figure out why it's so slow. It's due to 2 things. 1: kv is not being consistent, and 2: due to queue not handling things directly. A better approach might be a `LLMStreamDO`. make that!
- ✅ make stream.chatcompletions.com cache proxy
- ✅ Integrate with LLMStreamDO or variant thereof to make things instant. pattern is: instant-in-do-stream(-and-back-if-needed-or-later), globally subscribable realtime, eventually-pushed-to-the-edge https://x.com/janwilmake/status/1922437388258726270
- 🟠 Resultpage loads somewhat slow now due to stripe middleware. It was supposed to be fast, so let's figure out why it is NOT fast. in private window, the DO is super fast. in current safari https://lmpify.com is slow (500+ms). figure out where it's located and how this is possible!? https://x.com/janwilmake/status/1922592298904219859 - potential solution; refresh access token after 24h so the DO doesn't stay slow, but gets refreshed; but need a proper transfer method for this too. It'd also be good to understand the problem better: log DO response time in `stripeflare` package with warning if its over 100ms?
- 🟠 In localhost, the thing isn't working as the server restarts. see where this bug comes from by changing versions and/or removing stuff (and ask claude)
- 🟠 `Error in DO fetch: RangeError: Values cannot be larger than 131072` - storage of prompt is too large! Also context! This needs solving, potentially use SQLite one row per key, and prune when going over 2mb.
- ✅ 🔥 Added `/from/{promptUrl}` endpoint to integrate with any URL as startingpoint more easily (e.g. from github). Refactored logic to allow for GET request to DO
- Prune long fetch text responses from URLs, and sanitise html
- Ensure claude sonnet 3.7 works too. model must be stored in localstorage
- Count free requests at user-level, give max 10 total free requests.
- Should calculate og-details based on prompt in DO
- Should pregenerate og:image (https://github.com/janwilmake/github-og-image) and add that into `result.html` (follow path routing of https://github.com/janwilmake/user-agent-router)

CONNECTION WITH `context.json`

- make my own personal landingpage that has a simple textarea and a bunch of contexts to easily click to add to the input box that links through to lmpify. for this, use an endpoint for all my lists where it finds and applies context.json and .genignore in each and shows different context's

CONNECTION WITH MCP

- maybe stripeflare with MCP is a better connection than this. this, however, could be refined into something that generates an mcp. All i need is todo, is create a landingpage where the textarea text is prefixed with context on how to build an MCP and instructions to actually build an MCP.
- then, on the result page, we wanna allow actions with the codeblocks like i had with chat.forgithub.com. chatcompletions is a good building block here. ideally, you wanna allow turning it into a repo
- keep the mcp boilerplate private!

QOL:

- track history chain of edits by adding link to previous chathistory
- 'claim prompt' and 'link balance' buttons: login with X
- result page should also render markdown when doing non-browser-based fetch or when adding `.md`
- paste large texts should turn into a URL
- button to try with other model on result page
- bonus: add modal to upload image(s)
- bonus: openapi and instructions so people can embed this into their own website(s) - also - maybe a js-based embed could be pretty cool like twitter.
- bonus: /context/{url} to pre-add context (including nice card for it)
- improve funnyness when entering the page??? be creative. how can i make this super viral
- super idea: if at least one URL returns a `multipart/form-data` stream or file object, take the biggest of those, and use it with `uithub.filetransformers` with the rest of the prompt. we now apply the prompt on every file. Critical component: detecting streamable url response early + proxy traffic.
- IDEA Bruna: edit history; either by storing a single previous link, all previous links in array, only all previous metadata, or all previous contents. Sidebar to scroll through the edit history.
