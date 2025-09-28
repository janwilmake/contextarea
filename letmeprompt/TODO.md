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

- Personal website: https://letmeprompt.com/make-me-a-personal-w-36k23j0
- DBZ Janwilmake & Friends - https://letmeprompt.com/httpshttpsmarkdow-gb4y8k0
- Durable Object - https://letmeprompt.com/httpsuithubcomj-uh41p00
- Website for a friend - https://letmeprompt.com/httpsmarkdownfeed-gpouhd0
- Worker with Assets - https://letmeprompt.com/httpsuithubcomj-4ssea90

# Model Changes

<!-- do after localhost works again. do giant prompt -->

- ✅ "Create Model" should be button on the left.
- ✅ Brain Icon!
- ✅ The model is always selected on whatever we had in `localStorage`, but it's better to set it to the configured value.

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
hookContext: https://letmeprompt.com/PROMPT_ID?variable={detail}&key=prompt
model: cerebras-llama4-scout-17b
maxTokens: 1
---

SYSTEM:
some prompt that returns 0 or 1 or {detail}

PROMPT:
```

We could start with a simple thing like this, and allow people to add hooks by just defining frontmatter. If frontmatter contains `hook: prompt|result` we can show a button to add this to your models.

This makes it super easy to create hooks and turn them on/off.

# Making localhost work again

🟠 In localhost, the thing isn't working as the server restarts. see where this bug comes from by changing versions and/or removing stuff (and ask claude)

This is probably resolved now as I moved away from `remote-sql-cursor`. Check again!

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

For-each implementation: https://letmeprompt.com/httpspastebincon-1nej5v0

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

Check `withMoney` again and see what context would be needed to do a drop-in replacement with that from what i have now

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

# Make the tailproxy MCP work!!!

- ❌ Why doesn't this work sometimes? Is it permissions? is it the route?
- What else can I make to make this more user friendly? I wanna be able to manually test in this way in the browser, and see logs somehow. In a header is great, but what if a script can be injected into each html output that has a sw.js that observes all requests and adds tail logs? This could potentially be very insightful.
- The deployment API --> Tailproxy should also functions as MCPs and should be first made possible from letmeprompt.com

# Idea of simplification of the `text/event-stream`

Why don't I just make an endpoint `POST|GET /{id}/simple` that just returns a plain/markdown ReadableStream? This is much easier to use and stack, and could eventually replace the `text/event-stream` which should not be needed.

# Improved Usability & Benchmark For Workers

https://deploy.flaredream.com/https://uithub.com/janwilmake/xymake.profile didn't see route in `wrangler.toml`. Need perfect wrangler parsing!

In https://letmeprompt.com/httpspastebincon-ujmnhs0, `/api/stats` returns a 409 and doesn't log any error. Code seems fine. Let's try locally and see what's up.

Lot of generated things return errors. Tail worker often gets exception

Landingpage flaredream.com should retrieve all `featured:true` from benchmark and render them with 'view'
