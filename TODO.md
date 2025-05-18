Long flow:

gh -> uithub -> your lists repos + starred + repos -> contexts -> try it button -> lmpify -> claude? pay.

Shorter flow: be the product

- collect some ctx links
- make spec in lmpify with links
- run and iterate
- happy? share on x.

^ shows the power of uithub contexts already. IF:

- when typing, urls already get extrapolated into cards and cached
- when loaded again, this is metadata directly visible and clickable
- og image / title shows gist of prompt

# Monetisation

- ✅ Create endpoint to run middleware and return userdata and use that in `model-modal.js` to show user information in there.
- ✅ Confirm adding balance works
- ✅ premium shows up in the right way
- Count free requests at user-level, give max 10 total free requests.
- Return 402 as data property, if that happens, auto-open the modal and show an error that guides to adding more balance
- Ensure model from result is always selected. If that isn't possible since you aren't premium, open modal when clicking try-again or upon submission, with error that this model is premium.
- Ensure claude sonnet 3.7 works too. Model must be stored in localstorage and KV.
- Ensure pricing is properly applied. Confirm monetisation works.

💪 TODO: 1) ✅ purify prompt/context, 2) ❌ make claude & freemium monetisation work 3) ✅ make og-data work! It's usable now for myself and to share results easily!

# Launch

If usable, start using it instead of Claude.

Do a short X post announcing it.

# Fix uuithub ❗️

https://contextbuilding.com/janwilmake/dorm the uuithub links must work! Show result after to Christian Cazzaza.

For this I need to pass API key to uithub

For this I need to allow devs to create an API key for uithub they can use in their apps

# mdapply

Proposed flow:

1. make post on X
2. use xymake url and a prompt
3. now get resulting files and a cli to paste them into cwd: `npx mdapply {url}`

All I need is a nice function to fetch the url, parse the codeblocks and belonging filenames (either in codeblock variable or use the above backtick-code as filename)

It should then simply write these files into the cwd, which allows testing and seeing what was made.

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
- Maybe stripeflare with MCP is a better connection than this. this, however, could be refined into something that generates an mcp. All i need is todo, is create a landingpage where the textarea text is prefixed with context on how to build an MCP and instructions to actually build an MCP.
- Then, on the result page, we wanna allow actions with the codeblocks like i had with chat.forgithub.com. chatcompletions is a good building block here. ideally, you wanna allow turning it into a repo
- Keep the mcp boilerplate private!

# QOL:

- Add 💡 logo to og-image
- Problem: re-rendering entire text for every output token makes it slow, especially when doing so many calculations. Idea: seal markdown output after every section. Before beginning a codeblock, and after ending acodeblock, these are moments which we would be able to seal it up to there and create a new 'block'. This way only the latest block is being re-rendered, making it a lot faster. This would allow making complete codeblocks interactive already. Incomplete codeblocks can now also made interactive, especially if can figure out how to skip updating the UI for 95% of tokens, just update it everh 20th token. Besides, if I can do this, it'd be possible to render the unfinished html incrementally as it gets created, creating a magical experience.
- add toggle button to view context in right panel rather than result (sets `secondPanelView` localstorage) or maybe not localStorage; just once
- Every codeblock should be available using the proper mediatype at `https://{slug}-{hash}.lmpify.com/{path}`. All links should be easy to find and add to the prompt.
- 'claim prompt' and 'link balance' buttons: login with X
- Improve funnyness when entering the page??? be creative. how can i make this super viral
- super idea: if at least one URL returns a `multipart/form-data` stream or file object, take the biggest of those, and use it with `uithub.filetransformers` with the rest of the prompt. we now apply the prompt on every file. Critical component: detecting streamable url response early + proxy traffic.
- Idea: "hooks" - plugins users can install that allow performing additional analysis on the prompt, context, and result. This could become a marketplace in itself.
- IDEA: `/from/{url}` could be what shows up in address bar, may make it easier to learn that convention, or at least show it in the interface, if it was the source.
- IDEA: User-based DO that collects all history and keeps a live connection with any active browser session of that user, such that it is broadcastable from https://lmpify.com/{userslug} and a history is also collected there. A good MVP would be to first make websocket-markdown editor DO like bruna almost did
