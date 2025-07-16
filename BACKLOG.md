# Make /chat/completions with cache making it intelligently cheaper

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

- IDEA: "hooks" - plugins users can install that allow performing additional analysis on the prompt, context, and result. This could become a marketplace in itself.

- IDEA: `/from/{url}` could be what shows up in address bar, may make it easier to learn that convention, or at least show it in the interface, if it was the source.

- IDEA: User-based DO that collects all history and keeps a live connection with any active browser session of that user, such that it is broadcastable from https://letmeprompt.com/{userslug} and a history is also collected there. A good MVP would be to first make websocket-markdown editor DO like bruna almost did

# IDEA: Make prompt button more appealing

- Add links alternative clients in the model modal
- Add copy button for prompt textarea contents

It's interesting ways to make the 'prompt it' button more appealing

**Different reasoning**: people linked to LMPIFY should ALWAYS HAVE AN ANSWER, NEVER HIT PAY WALL IMMEDIATELY, ALSO NOT FOR VERY GOOD MODELS.

# BUGS/Problems

- 🟠 Resultpage loads somewhat slow now some times, due to stripe middleware as the DO is being relocated. Could've been a temporary bug! It was supposed to be fast, so let's figure out why it is NOT fast. in private window, the DO is super fast. in current safari https://letmeprompt.com is slow (500+ms). figure out where it's located and how this is possible!? https://x.com/janwilmake/status/1922592298904219859 - potential solution; refresh access token after 24h so the DO doesn't stay slow, but gets refreshed; but need a proper transfer method for this too. It'd also be good to understand the problem better: log DO response time in `stripeflare` package with warning if its over 100ms?

- 🟠 In localhost, the thing isn't working as the server restarts. see where this bug comes from by changing versions and/or removing stuff (and ask claude)

- Problem: re-rendering entire text for every output token makes it slow, especially when doing so many calculations. Idea: seal markdown output after every section. Before beginning a codeblock, and after ending acodeblock, these are moments which we would be able to seal it up to there and create a new 'block'. This way only the latest block is being re-rendered, making it a lot faster. This would allow making complete codeblocks interactive already. Incomplete codeblocks can now also made interactive, especially if can figure out how to skip updating the UI for 95% of tokens, just update it everh 20th token. Besides, if I can do this, it'd be possible to render the unfinished html incrementally as it gets created, creating a magical experience.

# prompt-each idea

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
