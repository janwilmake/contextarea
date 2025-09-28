# Original prompt (2025-05-12)

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

# ADR

- Need a simple interface for freemium LLM answers that has support for URL expansion. Must be FAST and pay-as-you-go.
- by design, I want to have a homepage, share page, and result page, so the user is incentivized to share. However, it may be better to combine them. with googling you kinda trust google to provide a good response. with llms we aren't there yet; you may want to verify. The share piece could be a footer visible on the result page.
- byok is a possibility to showcase models to people, but the main value proposition is shareability in general and an ability to use links as context building method. over-focusing on models might end up being an anti-pattern. i focus on context building instead, allowing lmpify to become a embeddable piece into any website through API and script.
- I want things to be fast and my current solution doesn't even stream. It sucks! The post request must stream itself but also immediately return the HTML and do other things. The cache must be set as soon as it's done but since it's only eventually consistent but it's meant for sharing, it should be there in the DO until the KV is available. KV ensures REAL speed everywhere globally, while DO ensures the thing happens close to the user.

# New specification

> Tomorrow: make new spec that streams prompt. Think first if chatcompletions.stream is the right abstraction..? or do I need this whole thing custom?

# PRIORITY: REPLACE CLAUDE (2025-05-12 until 2025-05-17)

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
- ✅ Fix annoying JSON parser bug when having `</script>` https://www.lmpify.com/from/https://uithub.com/janwilmake/xymake
- ✅ Modularize the code! makes it a bit cleaner and more readable.
- ✅ added html viewer and collapsible stored on user level
- ✅ added 'credentialless' to iframe so i don't think we need to worry about it ever executing functionality in lmpify draining someones balance. furthermore, the access-token itself was already not accessible as it's http only

# Monetisation & bugfixes (2025-05-18)

- ✅ Create endpoint to run middleware and return userdata and use that in `model-modal.js` to show user information in there.
- ✅ Confirm adding balance works
- ✅ premium shows up in the right way
- ✅ Ensure claude sonnet 3.7 works too. Model must be stored in localstorage and KV.
- ✅ Ensure pricing is properly calculated for both chatgpt and claude with a MARKUP_FACTOR
- ✅ Make it easy to access the DB from the other DO, ensure to document how to do this in stripeflare template and show that in the demo as well. Maybe export `createClient` and `DEFAULT_VERSION` from stripeflare?
- ✅ Charge the user the determined price
- ✅ Added blob url for HTML pages to view in full-screen
- ✅ prompt tokens should be unescaped
- ✅ Return 402 as data property, if that happens, auto-open the modal and show an error that guides to adding more balance
- ✅ Add ratelimiter to 5 free requests per hour

# Launch (2025-05-19)

✅ Fix bug with `__CODEBLOCK__` stuff. Encountered it when trying to use it with stripeflare: https://www.lmpify.com/doctype-html-htm-v3vyt70

✅ Finish `login-by-payment`!!!! Otherwise, old payments get lost

✅ Do a short X post announcing it, and now always use this when starting a new project.

# Virality (2025-05-21)

✅ Made the markdown 'prompt it' button

✅ Made `mdapply` cli (https://github.com/janwilmake/mdapply)

# Better docs (2025-05-23)

✅ Made `usage.html/md`

✅ Turn usage, why and privacy-policy into https://github.com/janwilmake/lmpify-docs and link from homepage

# After contextarea works... add to lmpify and focus on this (2025-05-24)

✅ Add contextarea! seeing tokens of urls and seeing if urls not work is huge for understanding.

✅ On homepage, ensure shift+enter is submit, not enter.

✅ Fix bugs on mdapply: we can't accomodate for all structures progamatically but we can accomodate for ```ext filename=""`. Let's do that instead, and instruct this to be system-prompted on how to respond. In lmpify, I'd want a simple system prompt that can be deleted. It can just be a URL! **Created gist: https://uithub.com/janwilmake/gists/blob/main/named-codeblocks.md**

❌ Add toggle button to view context in right panel rather than result. this could be live connected with context-cards, rather than from data. **with direct link to each context it may not be needed, but total token-count would be nice**

## ❗️ Improve Models (2025-06-04)

1. ✅ Add cloudflare account-id into the basepath
2. ✅ Add secrets for all
3. ✅ Add X AI (Grok)
4. ✅ Add superfast model (llama-3.3-70b on https://api.cerebras.ai/v1/chat/completions)
5. ❌ ~~Add Gemini Video input model~~ (not possible with /chat/completion)
6. ✅ Make it possible to use LLAMA3.3 70B unlimited after initial payment (charge 0 for non-api use)
7. ❌ Use Company Logos

POST: models added, LMPIFY is now Free after Tiny $0.99 Payment (Proof of Personhood Payment)

# RENAME (2025-06-30)

✅ Rename to letmepromp. Same visible name, easy to remember, more readable.

✅ The problem is I have a lot of links to lmpify already and they should stay working. The old lmpify.com should redirect to the new with the same path+query. Forever.

✅ Every codeblock should be available using the proper mediatype at `https://{slug}-{hash}.gptideas.com/{path}`. All links should be easy to find and add to the prompt.

## system prompt (2025-07-01)

✅ A default system prompt, editable after login, should include instructions for named codeblocks. This is just a landingpage thing. On result pages, it's prepended to the actual prompt.

## Proper Markdown Rendering (2025-07-01)

Problem: Fix bugs on response with ``` in code etc. this is very important: https://letmeprompt.com/httpsuithubcomj-odsfdc0.md?key=result

Research: https://x.com/janwilmake/status/1926992658536206687

The solution is bi-partial:

1. use `marked` and render things with that
2. ensure by default a system promopt is used that instructs how to write code block fences in markdown.

TODO:

- ✅ write system prompt that instructs using `````` (5 backticks by default or more when necessary)
- ✅ Ensure `named-codeblocks.md` system prompt is used by default without making things ugly
- Apply adding 1 backtick to fence in `getMarkdownResponse`
- ✅ Rewrite `markdown-highlighter.js` using `marked`
- ✅ Links should still be shown as markdown but need to be clickable.

DONE 🎉

✅ Ensure variable `{{prompt_id}}` is filled into context if directly present in prompt. This is happening at execution, the variable stays variable.

# QUICK WINS = 2025-07-04/05

- ✅ Routes aren't immediately active, which causes it to cache the 404. let's just wait...
- ✅ Ensure assets directory `./` also works when specified in wrangler.
- ✅ Upon download, assets that aren't there should not crash, `errors.json` should show this.
- ✅ Put download and deploy button on letmeprompt.com
- ✅ weird `&quot;` stuff in md and images shouldn't be rendering!
- ✅ Big ugly copy button on mobile
- ✅ Added company icons (replacing emojis)

Test parallel:

```
curl -X POST "https://beta.parallel.ai/chat/completions" -H "Content-Type: application/json" -H "Authorization: Bearer X" -d '{"model": "speed","messages": [{"role": "user","content": "What does Parallel Web Systems do?"}],"stream": true}'
```

# OG (2025-07-04)

✅ Model logo should be big in the OG.

- ✅ Title (Generated)
- ✅ Subtitle: '[logo] GROK 4 Generation by Jan Wilmake [pfp]'

# Fix payments, improve layout (2025-07-16)

- ✅ Fixed dorm and stripeflare and applied breaking changes
- ✅ Both sides (prompt & result) must have sticky headers and bottoms of equal size and style (mirroring each other)
- ✅ Improve mobile layout to be less space consuming

# `/chat/completions` and `/mcp` (2025-07-17)

- ✅ Turn letmeprompt into oauth-provided `/chat/completion` endpoint with models (chance to not niche down too much and build flaredream chat with little complexity!)
- ✅ Turn `letmeprompt.com/{id}/chat/completions` into the same thing, but with predetermined system prompt that is someone elses prompt
- ✅ Every url can be a basePath for the OpenAI SDK (as long as POST `*/chat/completions` is given, proxy with system prompt being set to context + prompt). Model value should follow the same allowed values as what I have now.
- ✅ Look up `store:true` behavior in openai and x-ai. is it useful to leave it? (NO)
- ✅ Add `store:true` behavior, removing that parameter from body, and storing the result in lmpify
- ✅ Incase of `store:true` ensure the response id is the URL we store it at
- ❌ Optional: add `resultUrl` in the same objects
- ✅ Create openapi for all of LMPIFY for programmatic use (leaving out html stuff)
- ✅ Test anthropic model via https://docs.anthropic.com/en/api/openai-sdk - got model not found error
- ✅ In the UI, show 'Use as API' in footer which shows how to use the API.
- ✅ Endpoint `[/{id}]/mcp` that turns chat completion into an MCP tool.

# Added stream error handling (2025-07-21)

Anthropic has lot of outages (https://status.anthropic.com) and i got empty string back since errors in-stream were fully ignored.

Now, these errors should properly throw and set 'error' value

# Small improvements (2025-08-03)

- ✅ LMPIFY BUG: links become `[]()` even if the text and url is same. not sure if there's a way to differentiate, but should defniitely just remain url if it was url.
