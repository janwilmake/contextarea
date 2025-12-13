# HIGH LEVEL

- Start using monaco! Huge for look & feel.
- Make MCP accessible! Huge for adoption.
- MCP-UI
- OpenRouter (or CloudFlare)
- llmtext! website context
- Find a way not to do this in the cloudflare worker such that the api will just work.

# Simplify Implementation

We have 2 implementations for chat completions now, one of which can be used as API. Lets simplify that down to one in a way that the config of previous generations is possible to be used as model. Config should be merged/overwritten with what's defined in the prompt. IDK though, maybe this whole model wrapping with tools is actually against my beliefs. The oauth provider is important though since there we can really create a proxy! One or a few implementations of this will be perfect.

Clear up API interface: `/chat/completions[/{completion_id}]` with `{user:string,store:boolean,tools:[{type:"custom",custom:{name:"url_context"}}]}`

Also have `/responses` interface. Makes actually more sense for my UI because there are no messages.

Expose OpenAPI and create some docs for it (Mintlify?)

# User-profiles

- Change API boundary to `/chat/completions` and ensure it's called when submitting through `env.SELF`.
- Make UserContextDO! Each time you land at a chat, save its details into a user object: `{ history: {title, created at, url}[], resources: { title, icon, description, url}[], tools: { name, icon, description, url}[]` with counts and details.
- Render history button to easily go to other chats
- For resources and tools, add easy toggle.

This makes it a much more usable thing because context is hard to remember.

# Make MCP functional in `contextarea`!

Make one-click installation work https://contextarea.com/?mcp=https://task-mcp.parallel.ai/mcp&mcp=https://search-mcp.parallel.ai/mcp (should add `,` and should remove `https://`, as it's not needed. Space should also be ok as split character.

Make this work! https://contextarea.com/mcp-httpssea-cektvkah7vnkea (login with https or multiple is buggy now)

There's no way to refresh MCPs now. Follow version from `initialize` and update if it's newer than the one we have.

Add `profile` frontmatter tag as well to switch who to login to for MCP.

MCP Pre-processor is GOAT - https://x.com/janwilmake/status/1980346301540888847

Implement code execution with MCP (https://www.anthropic.com/engineering/code-execution-with-mcp, https://blog.cloudflare.com/code-mode/). Recommended way of using MCPs now.

Huge if I can make 'MCP UI' work nicely. Great for testing too.

# Low hanging fruit Parallel

- Build in shadowlink suggestions so people learn whats up more easily
- Add oauth for context as well so people are requested to login into parallel for https://llmtext.com links.

# Better README

Make screenshots for the features that differentiate contextarea from other LLM clients

# ContextArea Monaco

Finish [monacobro.js](https://github.com/janwilmake/monacobro) with functional paste-interceptor and token counter, then use this in contextarea.com. Then get back to [sunil](https://x.com/threepointone/status/1979536991869116585)

It should show details on the mcps used (token count), as well as the context links.

# MCP & OpenRouter

- Have KV for all openrouter models that refreshes every hour. Map this to needed info for providers, and ensure it is exposed at `/all-providers.json` or so which concatenates that with my own.
- Using an MCP proxy around that will give all models of openrouter (that have function tools) MCP access. This is a huge valueprop for them!
- Seems that error handling broke. just getting blank pages sometimes for claude now.

# LLM CLI

https://github.com/simonw/llm

Can I integrate with this?

# Openrouter Demo

- Duplicates https://openrouter.ai/chat but only minimal features of selecting models
- Adds modal to add MCPs

# MarkdownOps/NLANG

Main Blocker: to make the MCP oauth happen asynchronously calling back to re-start the prompt.

After that, what I want is a deployment of generations from github repos with:

1. MCP
2. cron, max-age, stale-while-revalidate

However, this isn't really a requirement! Maybe should just start with a simpler markdownops that works just for repos with `nlang.json` and if the owner paid.

- needs github oauth (public or private)
- needs to push results to `target`, which can be the same branch same repo, another branch same repo, or other repo.

Or should it also be able to be done fully locally? Maybe that makes more sense FIRST: long-running MCPs locally to simply go from file to file. What needs to be done for this?

- Stripeflare should allow userID param (optional)
- It should have a GITHUB oauth provider so the CLI can login to it nicely (just for the username and for depositing credit)
- It should be stateful (don't break when connection drops) and cached (basically LMPIFY but over a well-documented API)
- It should be possible to put it in a separate background process (node) that streams with retries and/or polling, notifying the user somehow once done.
- Need model frontmatter prop and clarity on `nlang.json` spec

This goes against my ideals, but removes the barrier to testing (Cuz local) and with that makes it more likely that I get somehting I'd use myself.

What if it were a 'background agent' that could be made interoperable with several coding systems? This would be really cool too.

# Stateful chatcompletions with callbacks

<!-- Valuable research/preparation for Parallel. Also needed to separate auth UI from model response. Separating UI from model response opens the door for CLIs, MCP QA Testing & Monitoring, MarkdownOps, and much more! -->

- Allow for long-running MCP tools (in the same way as [this SEP](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1391)) - this makes this stateful though so may need to be done in a different place!
- Ability to hold running the API waiting for a human to authorize, then continue fulfilling the request after that's solved. Potentially, a parameter `onUserMessage:(details)=>Promise<void>` could be added, which would send the authorization request (just an url and message) to that endpoint, with the same secret. That function could then send email, w'app, or notify in UI. Anything.
- Expose chat completions as async MCP tool with oauth (basically a sub-agent!)

## Other useful exploration

- Build in the same url expansion with different configuration (all urls or urls with prefix @) and IDP.
- Allow simplifying the response into text-only (reduce from reasoning, error messages, tool data, etc etc)
- Build a CLI that has the frontmatter
- A tool to search MCPs and continue the chat with different MCPs

## Skill router

This may not need to be something fully chained to the chat completions endpoint, but definitely a great thing to offer as well. A company should be able to list all their tools centrally so all employees can use all tools every prompt. A pre-selector prompt can do this.

Questions:

- How do we create a platform in which it's easy for companies to assign which users are their employees?
  - X: See X company and who got added (expensive, not everyone has it)
  - Email: see if people use company email (e.g. `@parallel.ai`)
  - Slack: everyone who's in Slack arguably is inside of the org.
- Do we need to let users be approved/invited into an org, or can the skill routing configuration be made public? May be more POC to be public. Also has benefits.

TODO:

- Create a super simple template for parallel

## Parallel:

- Create Integration-friendly Task API with MCP IDP built-in (by passing stable `user: string` ID) that instantly responds with a markdown-URL and JSON-URL on which the result will be able to be found without auth (`store:true` indefinitely, `store:false` for 24 hours)
- Create task API as chat completions endpoint.

<!--
# LMPIFY for Parallel

Why I can't post much about Parallel yet: Because I can't use it yet as part of the products I'm building. These are all things that will let me prototype faster:

What is mainly nice for my day-to-day

- Secondary models -> will allow showing parallel everywhere
- Hooks -> Will allow making a 'context-retrieval-task' when needed using Parallel `/chat/completions` model.
- flaredream agent -> will allow faster prototyping

What is interesting:

- Domain-based OAuth -> Will allow using different MCPs with easy sign-in, but also URL fetching.
- MCP -> Allows experimenting with search/task MCP on daily basis
- foreach -> will allow easy batch-prompting
- frontmatter, cronjobs -> will allow creating fresh datasets and experiment with that easily.

This is 'top-down' approach

Bottom-up is small exapmles in cookbook, won't go as viral, won't be usable for daily use. But also doing that.
-->

# LMPIFY LAUNCH

- Personal website: https://contextarea.com/make-me-a-personal-w-36k23j0
- DBZ Janwilmake & Friends - https://contextarea.com/httpshttpsmarkdow-gb4y8k0
- Durable Object - https://contextarea.com/httpsuithubcomj-uh41p00
- Website for a friend - https://contextarea.com/httpsmarkdownfeed-gpouhd0
- Worker with Assets - https://contextarea.com/httpsuithubcomj-4ssea90

# Model Changes

**1) Allowing selection of secondary models** (index.html, result.html, model-modal.js)

- Localstorage should have `{ model?: string, secondaryModels?:string[], secondaryModelsEnabled?:boolean }`
- Button for toggling `secondaryModelsEnabled`.
- If disabled, clicking a model should just change `model` and close model selector like now
- If enabled
  - Should be able to select/deselect multiple models (gets set to `localStorage`)
  - For any selected model that is not `model`, button 'Set As Primary' should show up behind it (should set to `localStorage`)
- Add `secondaryModelsEnabled` and `secondaryModels` to form submission.

**2) Adding/removing custom models** (main.ts, result.html, model-modal.js)

- Create endpoint `POST /model {model:string,action:"add"|"remove"}` adding/removing this model to user models in a KV belonging to user. This kv should have `{ customModels: { model:string, icon:string, color:string, type:"hook"|"default" }[] }`. Upon adding, icon and color can be inferred from base model.
- 'Add Model' button should be disabled after changing something in the prompt with alt text "First submit this prompt"
- 'Add model' button should send API call to backend
- Also disable if current viewed result is already a model in user account.
- "server-data" and `/me` should include `customModels`
- In model-modal, ensure to render custom models with a button to delete that sends `POST /model {model,action:"remove"}`

**3) Submission of all models**

- In backend, submissions with received `secondaryModels` and `secondaryModelsEnabled` (if enabled) should trigger independent DO creation for each secondaryModel in `ctx.waitUntil`. These responses all become independent results, streaming in separate DOs, - Every result gets `linkedGenerationIds:string[]` set, which are all generation URLs, including this one.
- The UI can show this by also linking to these other pages to easily switch, like tabs. Not invasive, but allows to quickly create multiple responses on any prompt.

This opens the door for parallel prompting and easy experimentation with it. The cool part is it requires minimal UI changes this way.

# "hooks" idea

Models users can install that allow performing additional analysis on the prompt, context, and result. This could make my modelselection even more complex and make it a marketplace in itself.

Imagine every model could have hooks: https://github.com/janwilmake/prompt_modules

Ideal situation: let people define hooks within LMPIFY and add them! as hooks!

```md
---
hook: prompt
hookTools: https://parallel.ai/search/mcp
hookContext: https://contextarea.com/PROMPT_ID?variable={detail}&key=prompt
model: cerebras-llama4-scout-17b
maxTokens: 1
---

SYSTEM:
some prompt that returns 0 or 1 or {detail}

PROMPT:
```

We could start with a simple thing like this, and allow people to add hooks by just defining frontmatter. If frontmatter contains `hook: prompt|result` we can show a button to add this to your models.

This makes it super easy to create hooks and turn them on/off.

# Lay-out Design

Massive improvements possible - https://x.com/kregenrek/status/1946152950872879590

# Parallel Execution - prompt-each idea

llms.txt is a guided navigation at the root of any domain. The key is that we should be able to find it at the root of the domain, and thus, the domain itself is sufficient to use llms.txt as a base notation. However, maybe this is not that useful.

What are interesting and powerful prompts that could help refining context? Can I somehow put them in a simple URL convention?

1. **file hierarchy filter**: filter on `llms.txt` itself to get a subset of links based on a prompt
2. **prompt each file**: run a given prompt for each file, then do something with the output

The first one is easy, it's just a prompt that outputs a new URL

What if you could run a prompt for each URL found at a given URL? What if we use a different protocol for this? What if you could just do this in a prompt in LMPIFY?

```md
https://flaredream.com/janwilmake

foreach://markdownfeed.com/janwilmake/following

based on the feed shown, is there any overlap in work and interests between the work from janwilmake and the things the person seems interested in?
```

This would be super powerful as it would do a prompt for each follower and it's super easy to understand that. If we have foreach twice, it could run every possible combination, potentially. We could then show the output like this:

````md
```md for="https://markdownfeed.com/flowisgreat"
He really loves cursor rules and it may be similar enough to the `user-agent-router` project of janwilmake
```

```md for="https://markdownfeed.com/carol"
She really loves iOS and it may be similar enough to the `screenless` project of janwilmake
```

...etc
````

This is basically a way of looping over prompts with the context being the only variable without any programming knowledge, just a simple 'trick'.

Other 'context protocols' I should consider:

- `foreach://{url}` will run a prompt many times and aggregate the results as they come back in the order of the urls found
- `expand://{url}` could expand every URL found at the url (going 1 level deeper)
- `goto://{url}` in the result could redirect the result to this url as the final answer. this url could also be a subset of the output itself, e.g. a link to a codeblock! In the browser for humans this could do an actual redirect. this means just a single goto url would be possible, although the output could technically also continue.

Expand and foreach are in the input prompt and therefore unlikely to be unsafe. It'd also be great to think in terms of nlang again. with nlang I had ideas about defining doing cronjobs as well, and every file had a name/path which determined output location as well.

For-each implementation: https://contextarea.com/httpspastebincon-1nej5v0

Seeing this now, i notice it's also interesting to try and figure it out the other way around as in, providing a file to a URL and post it there, e.g. referring to a codeblock. however, i don't know if that's feasible. the foreach protocol is quite elegant!

OTHER OPTION: Since there's just one, may be better to put it in frontmatter.

```
---
foreach: https://markdownfeed.com/janwilmake/following
limit:  5
---
```

This would be super cool! Especially if it would stream each of them after each other in the response.

# With-money refactor

Check `withMoney` again and see what context would be needed to do a drop-in replacement with that from what I have now

Replace Stripeflare with X Money (more reliable for all users, allows to see who created something with nice X profile pic, etc)

https://github.com/janwilmake/with-money

To simplify, let's also just require login; ideally after filling first prompt (Should temporarily store prompt in cookie).

Ensure it doesn't logout quickly.

This would also allow getting an API KEY and more securely deposit lots of cash. To easily to build against LMPIFY with XYTEXT. also will allow closed-loop monetary system between creators and generations of these prompts, etc.

Then, `agent-architecture.drawio.png`

# Flaredream Improvements

Create a flaredream template that uses typescript and packages! Do the bundling as separate step using esbuild. I should start doing all my own projects in this way. Also, attaching a local CLI for `flaredream build` will be nice, simply adding in the "durable-worker" idea. Great to introduce.

Also needed:

1. pass wrangler and export defaulted config to build.
2. have default entrypoint if wrangler not provided
3. generate types from flaredream types from remote url
4. use it to know what to do at deployment
5. ability to add formdata properties like name, pattern[], not query-params.

# Flaredream MCP

I can now already turn https://flaredream.com/system.md into an MCP, albeit with manual auth. Post about it?

First MCPs I want:

- **Iterate Agent** `deploy` tool at the end: `deploy.flaredream.com/download.flaredream.com/id` for Flaredreams initial generation, using `deploy` tool after it's done (deploy tool must have access to intermediate result)
- **Feedback agent** for Testing a flaredream deployment (`test(evaloncloudID,request,criteria)=>feedback` tool that processes request into feedback, and `final_feedback(feedback, replace_feedback:boolean, status: "ok"|"fail"|"retry")` will end the agent)

This is a great first milestone having the 2 MCPs separately. With this I can verify manually if this works. After that, a looping agent can use both in a loop!

# Deployment MCP

- ✅ Improve cloudflare provider, create `login-with-cloudflare` package.
- Use that in https://deploy.flaredream.com and make it an MCP using `withMcp`
- Use deploy.flaredream.com/mcp as MCP tool with flaredream LMPIFY FormData stream, from within flaredreams landingpage. This requires login with Cloudflare as well as my personal API key for LMPIFY (for now)

I should now be able to start the entire request from flaredream.com, and let users look into the response if they want to (but not require that). I can now just add XMoney to flaredream and use XYText as interface.

Idea - allow context of the generation to include MCP urls! This way the tools used become part of the definition. Logical! Imagine having a tweet MCP, all it'd take would be something like this:

```md
https://xymake.com/mcp

Hey, this is a tweet. It can literally just be understood one on one
```

# Make the tailproxy MCP work!!!

- ❌ Why doesn't this work sometimes? Is it permissions? is it the route?
- What else can I make to make this more user friendly? I wanna be able to manually test in this way in the browser, and see logs somehow. In a header is great, but what if a script can be injected into each html output that has a sw.js that observes all requests and adds tail logs? This could potentially be very insightful.
- The deployment API --> Tailproxy should also functions as MCPs and should be first made possible from contextarea.com

# Idea of simplification of the `text/event-stream`

Why don't I just make an endpoint `POST|GET /{id}/simple` that just returns a plain/markdown ReadableStream? This is much easier to use and stack, and could eventually replace the `text/event-stream` which should not be needed.

# Improved Usability & Benchmark For Workers

https://deploy.flaredream.com/https://uithub.com/janwilmake/xymake.profile didn't see route in `wrangler.toml`. Need perfect wrangler parsing!

In https://contextarea.com/httpspastebincon-ujmnhs0, `/api/stats` returns a 409 and doesn't log any error. Code seems fine. Let's try locally and see what's up.

Lot of generated things return errors. Tail worker often gets exception

Landingpage flaredream.com should retrieve all `featured:true` from benchmark and render them with 'view'

# COOL

https://llm.md

# Simple tools

https://letmeprompt.com/rules-httpsuithu-iuvmgx0

# Make `/chat/completions` with cache making it intelligently cheaper

- Later: Every `context` can automatically be cached as a system prompt intelligently when needed reducing cost significantly. It would keep an up-to-date cached context available for a url, and people would be able to build products for this easily. Ultimately, get back to https://x.com/EastlondonDev/status/1925191566362030380 about it
- Later: After this is there, a CLI like `npm i -g lmpify` and then `lmpify` to login and then `lmpify {url|path(|hash?)}` to change context and then `lmpify {message}` to chat and stream back response. This'd be epic.

# Images as context, videos as context

HTML is terrible since it's too big. However as a screenshot it can be great for making websites. Let's nudge people when they used a HTML context to instead use it as image. When clicked, it prepends https://quickog.com/{url}, which screenshots it.

Any URL that's an image should be inserted as image context to the model. Now we can do some sick sick stuff!

Video urls should be inserted as video context to the model (if the model supports it)

Whenever context is an image, it should show the # of tokens and it should show the fact that it's an image in the context UI.

# Variables

What if:

- If you prompt something with `{{var1}}` and `{{var2}}` it is required to be filled. This can be part of URLs too!
- https://letmeprompt.com/[id]/{{var1}}/{{var2}} is where you first get your result. Without variables, it should prompt to pass them.
- `https://[id].gptideas.com/{{var1}}/{{var2}}` is static results with routing (basepath being after variables; this now functions as API!)
- https://[id].chatcompletions.com/chat/completions would allow using the prompt + context as system prompt with additional variables in the headers in `variables:Object`. These would be required if they are present.

These are all GREAT primitives to allow making prompts more flexible

https://letmeprompt.com/httpsmarkdownfeed-jqin4k0 would be able to be done with variable. Imagine we could also choose a name: `xcategories`.

Now, https://xcategories.gptideas.com/janwilmake/categories.yaml should magically trigger prompting the same for me, IF I authorized it (either lazy with auth token, or predone with scope). We can now use this as some sort of API

Imagine now that we could also configure the scope and max-age. This would make this API truly valuable. It's a lot of extra complexity, and can be made more generically for URLs too, so maybe should be separated from letmeprompt itself, however, I could definitely see this as a quick way to prototype APIs. The API in-browser could then also immediately be the place where you find all results in one place.

I think a great place to start is:

- Establish as OAuth provider (login with letmeprompt)
- Ability to name prompts to replace, configure, budget for them later
- Named prompts should get history/versions and a DO as storage for all versions, including with variables.
- Variables in prompts should become indexes in the SQLite DB.

## Patchlink Plugin

IDEA: Help the idea guys with making their content more actionable

I basically created a 'mirror thread' and this could possibly be automated if lmpify had an MCP: https://x.com/janwilmake/status/1925218363774570938. But even if it's not automated it could be a great way to make ideas more actionable right away.

To truly optimise for actionability, it'd make a ton of sense to add 'patch for github' as a button, which would send the repo + result to the patch-api, which would basically be an independent glue. I can even charge a dollar for this instead since a lot of people don't know git, nor MCP.

The button should lead to this, and this should request permission to github oauth, then fork and patch, then redirect there! https://patch.forgithub.com/prepare?markdown={URL}&sourceOwner={OWNER}&sourceRepo={REPO}&sourceBranch={BRANCH}

This patch could also add the original lmpify that lead to the fork into the README, creating another viral loop! Besides, based on which boilerplate it is, it should add buttons to deploy (deploy to vercel, deploy to cloudflare, etc) so it's just one more click away from deployment.

The way the plugin system could work is by creating a **simple URL regex** that gets applied on the URLs in the prompt. For this patchlink to appear, the input prompt should have https://uithub.com/janwilmake/gists/tree/main/named-codeblocks.md

Add transformation to patcher:

- Ability inject HTML scripts
- Ability to inject buttons into README

Dream it --> Prompt it --> Ship it; flaredream!

**🤯 Brainstorm**: what if I had a generic worker that rendered HTML that executes a js-only worker script in-browser to then write the resulting HTML to the browser? This would be a way to achieve instant backends, safely. All that'd be needed would be to serve the right script on the right subdomain (proper separation), and write env secrets to localStorage with a wrapper script, before running the script. Now it basically allows eval! https://github.com/janwilmake/metaworker

# BACKLOG

- **Large Asset Buckets** Test for large files. Overcome `letmeprompt.download` limitations of max 128MB ram by streaming. Would be very cool to test if i can upload a huge music library or something.

# User-owned results 🤔🤔🤔

🤔 Not sure if I should add this to the already complex LMPIFY, or I should make this within xytext!?

User-owned pathnames that lead to the latest version and contain version history. Only logged in user can overwrite/remove them. These stay online forever, while one-off creations just stay for a week. In lmpify, show `name: httpsuithubcomj-9taiv70` editable. If editing, show checkmark 'available' and 'claim' button to claim it. Must be logged in.

Now that we have user-owned pathnames, ensure you can also easily get all/recent/top creations by a specific user.

Leaderboard! Who creates what, whose is shared the most, and whose chat completions are used? Make it fun. Separate worker.

## Link behavior markdown standard syntax

It could be interesting if we could make lmpify agentic more easily. I guess one of the ways to do this is by making found URLs and codeblocks alike easy to insert back into the prompt.

But imagine we even had a way for the agent to go off and immediately go to a particular URL, or even execute a new prompt? In this case, we've just made it agentic as it can choose to continue until it's satisfied a certain condition.

What if we use `goto://` as a protocol for this? If a link to `goto` is found in the response document, the behavior of lmpify client would be to immediately navigate there, even if the original prompt hasn't finished yet.

This can also be combined with lookup of information. What if you could specify a new promopt in a codeblock, then goto a new prompt, executing it, from that codeblock? I guess every codeblock should definitely have a fixed URL that can be made known to the LLM so it can self-reference stuff.

**Other way to look at it**: this should not be part of the UI, rather, it should be in the `/chat/completions` endpoint.

## Render links and urls as forms

If a link contains `{var}` or `?var=` (not filled in) it is assumed to require parameters and submission. Let's only support public GET

# Layers on top of lmpify: `context.json` or code generator

- A JS-based embed (`<div id="lmpify"></div><script src="https://letmeprompt.com/widget.js?query=a&b=c&d=e"></script>`) which renders it into a div, as a widget, in several sizes/ways (Could be separate files too) **the problem here is i need more than just the input. I need the result page and build around that**

- IDEA 1 = CONTEXT BUILDER: make my own personal landingpage that has a simple textarea and a bunch of contexts to easily click to add to the input box that links through to lmpify. for this, use an endpoint for all my lists where it finds and applies context.json and .genignore in each and shows different context's

- IDEA 2 = SYSTEM PROMPT SELECTOR: similar to https://mcpify.ai but with minimal code, I could build something that'd link through to lmpify. If I then OSS that template, I can convince people to build these with their own set of prompts, and make them earn money.

- IDEA 3 = Paid prompts. A way to incentivize people to share a prompt is by allowing them to price it. Not sure if this should be core or a layer on top somehow, but it could be a great product after people create collections.

# IDEAS

- IDEA: if at least one URL returns a `multipart/form-data` stream or file object, take the biggest of those, and use it with `uithub.filetransformers` with the rest of the prompt. we now apply the prompt on every file. Critical component: detecting streamable url response early + proxy traffic.

- IDEA: `/from/{url}` could be what shows up in address bar, may make it easier to learn that convention, or at least show it in the interface, if it was the source.

- IDEA: User-based DO that collects all history and keeps a live connection with any active browser session of that user, such that it is broadcastable from https://letmeprompt.com/{userslug} and a history is also collected there. xytext can definitely be used here too.

# IDEA: Make prompt button more appealing

- Add links alternative clients in the model modal
- Add copy button for prompt textarea contents

It's interesting ways to make the 'prompt it' button more appealing

**Different reasoning**: people linked to LMPIFY should ALWAYS HAVE AN ANSWER, NEVER HIT PAY WALL IMMEDIATELY, ALSO NOT FOR VERY GOOD MODELS.

# BUGS/Problems

Resultpage loads somewhat slow now some times, due to stripe middleware as the DO is being relocated. Could've been a temporary bug! It was supposed to be fast, so let's figure out why it is NOT fast. in private window, the DO is super fast. in current safari https://letmeprompt.com is slow (500+ms). figure out where it's located and how this is possible!? https://x.com/janwilmake/status/1922592298904219859 - potential solution; refresh access token after 24h so the DO doesn't stay slow, but gets refreshed; but need a proper transfer method for this too. It'd also be good to understand the problem better: log DO response time in `stripeflare` package with warning if its over 100ms?

# Incremental markdown parser

Problem: re-rendering entire text for every output token makes it slow, especially when doing so many calculations. Idea: seal markdown output after every section. Before beginning a codeblock, and after ending acodeblock, these are moments which we would be able to seal it up to there and create a new 'block'. This way only the latest block is being re-rendered, making it a lot faster. This would allow making complete codeblocks interactive already. Incomplete codeblocks can now also made interactive, especially if can figure out how to skip updating the UI for 95% of tokens, just update it everh 20th token. Besides, if I can do this, it'd be possible to render the unfinished html incrementally as it gets created, creating a magical experience.

https://x.com/__morse/status/1945589927820902562
https://github.com/remorses/fumabase/blob/main/contesto/src/lib/incremental-markdown-parser.ts

# Analytics & revshare idea (May 23, 2025)

See also `faircompletions`

🛑 talk with what OSS repo-owners want. make profit, or pay for larger free tier (and make profit elsewhere)? https://x.com/janwilmake/status/1926518646785917107

IDEA: to enable Rev-sharing with repo owners, X users, and knowledge-base builders

https://github.com/iannuttall/mcp-boilerplate/pull/8 <-- boilerplate owners should be able to earn money with it

I need to make them easily understand they can with this! One step to still do though, is to track the original location from where the payment was initiated, and which contexts were used for this... We can group these contexts on a per-owner basis, then get an overview on how much was added for each.

If this works out, it becomes easy way for viral github users to make money. Besides, it'd be a great idea anyway to track visitors on a per-github-owner-level.

Every day, let's go over these: https://www.lmpify.com/httpspopularforg-7mck8v0 and see if there are tweets I can mirror.

What about idea-guys? Can I search X with filter on this? Should make a monetised socialdata.tools search monitor cronjob and have these things made public.

Another one is the people that create the contexts and share them. It doesn't always need to be their context. What if the original creator of the prompt gets made public too? We can simply use the `client_reference_id` for this and expose it (also makes it possible to pay others).

Measure actions:

- Pageview
- Prompt or other action from page (spending money)
- New balance upgrade

Measure them with owners:

- `?ref`
- the prompt-page itself
- the creator of the prompt
- the creator of previous version(s) of the prompt
- the creators of the context (github accounts, x accounts linked)

Revshare with the creators is super epic. Can be done directly to client_reference_ids for users and to claimable accounts (x/github) in another table. can't believe this worked: https://github.com/janwilmake/stripeflare-p2p-demo

- **Edit history**; either by storing a single previous link, all previous links in array, only all previous metadata, or all previous contents. Sidebar to scroll through the edit history.

- **Add models and other mediatypes**: Add Gemini 2.5 Pro w/ video upload - https://x.com/tryingET/status/1924810864260960271. Add image urls as images for claude/chatgpt. Also grok would be nice. Also, let's use some cerebras models.

## Proper way to let REPO-OWNERS pay for generations, not users.

🤔 Ultimately I'd want to be able to set worker-name, repo-name, branch, and have these deployments happen automatically, instantly. For this to work, I require `Login with Cloudflare` and `Login with GitHub` to be a part of letmeprompt.com, and allow for generation-configs (name, repo, branch, worker-name). It's not clear to me yet if this should be a completely new app that uses letmeprompt.com? Maybe better; niched towards easy workers: flaredream!

The UI here is not nice: https://github.com/eastlondoner/vibe-tools

- it leads to use a bad model
- people may hit a ratelimit very quickly

What I'd want is a custom link that redirects to the cached response, e.g. https://contextjson.com/{owner}/{repo}/tree/{branch}/context/{id}. This should:

1. Check the `context.json` in the raw githubusercontent file
2. Generate uithub URL+prompt
3. With MY OWN API KEY (AND COST), call `POST https://letmeprompt.com/chat/completions` with preset model (if url/prompt didn't change, result should be cached). Also, result should include `X-Result-URL` header.
4. Redirect user to `X-Result-URL` where the result is being streamed to, paid for them.

After I have this, remove cheaper, smaller models; definitely discourage them. I can allow a budget of up to $5 free for anyone that puts a `context.json` file in their repo, but also should already have a way to see who's using it in a dashboard, and reach out to them easily.

# Ability to more easily do multi-context queries

A query like this can obviously be done with improved reasoning by splitting it up. we wanna be able to do foreach URL prompts and retrieve multiple results at once!
https://contextarea.com/rules-httpsuithu-3lg0if2oc0hs3h
