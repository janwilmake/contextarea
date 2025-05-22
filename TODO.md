# API for Paid Users

Every `context` can automatically be cached as a system prompt intelligently when needed reducing cost significantly. It would keep an up-to-date cached context available for a url, and people would be able to build products for this easily.

https://x.com/EastlondonDev/status/1925191566362030380

Generally its a good idea to allow for programmatic access and give people an API for this!!!!!!!! Imagine if people could earn money by easily creating new stripeflare workers that allow access to this API? You could set any price and it'd be super easy to setup via a lmpify.

TODO:

1. Every url can be a basePath for the OpenAI SDK (as long as POST `*/chat/completions` is given, proxy with system prompt being set to context + prompt). Model value should follow the same allowed values as what I have now. Can still use all other values.

2. In the UI, show 'Use Context' in footer which shows how to use the API.

After this is there, a CLI like `npm i -g lmpify` and then `lmpify` to login and then `lmpify {url|path(|hash?)}` to change context and then `lmpify {message}` to chat and stream back response. This'd be epic.

# IDEA: Analytics to enable Rev-sharing with repo owners, X users, and knowledge-base builders

https://github.com/iannuttall/mcp-boilerplate/pull/8 <-- boilerplate owners should be able to earn money with it

I need to make them easily understand they can with this! One step to still do though, is to track the original location from where the payment was initiated, and which contexts were used for this... We can group these contexts on a per-owner basis, then get an overview on how much was added for each.

If this works out, it becomes easy way for viral github users to make money. Besides, it'd be a great idea anyway to track visitors on a per-github-owner-level.

Every day, let's go over these: https://www.lmpify.com/httpspopularforg-7mck8v0 and see if there are tweets I can mirror.

What about idea-guys? Can i search X with filter on this? Should make a monetised socialdata.tools search monitor cronjob and have these things made public.

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
- the creators of the context (github accounts, x accounts)

Revshare with the creators is super epic. Can be done directly to client_reference_ids for users and to claimable accounts (x/github) in another table. can't believe this worked: https://github.com/janwilmake/stripeflare-p2p-demo

# IDEA: Help the idea guys with making their content more actionable

I basically created a 'mirror thread' and this could possibly be automated if lmpify had an MCP: https://x.com/janwilmake/status/1925218363774570938. But even if it's not automated it could be a great way to make ideas more actionable right away.

To truly optimise for actionability, it'd make a ton of sense to add 'patch for github' as a button, which would send the repo + result to the patch-api, which would basically be an independent glue. I can even charge a dollar for this instead since a lot of people don't know git, nor MCP.

The button should lead to this, and this should request permission to github oauth, then fork and patch, then redirect there! https://patch.forgithub.com/prepare?markdown={URL}&sourceOwner={OWNER}&sourceRepo={REPO}&sourceBranch={BRANCH}

This patch could also add the original lmpify that lead to the fork into the README, creating another viral loop! Besides, based on which boilerplate it is, it should add buttons to deploy (deploy to vercel, deploy to cloudflare, etc) so it's just one more click away from deployment.

# Fix uuithub ❗️

https://contextbuilding.com/janwilmake/dorm the uuithub links must work and be fast! Show result after to Christian Cazzaza.

For this I need to pass API key to uithub

For this I need to allow devs to create an API key for uithub they can use in their apps

For this I need to first fix all uithub stuff

# High Impact Features

Make `?prompt&query&model` work from homepage (prompt insta-submits, is this safe?). Improve the widget making it very well documented and turn that into a README.

Add toggle button to view context in right panel rather than result.

Add easily embeddable link that links to to result. Could be live connected with context-cards, rather than from data.

- **Pastebin**: paste large texts should turn into a URL to keep it easy to oversee the prompt. use pastebin as imported code `from "./lmpify.pastebin/pastebin"` (`/lmpify.pastebin/README.md`) https://github.com/janwilmake/contextarea

- **Context Cards**: for each link in the prompt, the frontend should have an api to render the context card for it which includes url, title, tokens, og-image, and more. these should be dynamically rendered below your prompt, and must be clear which belongs to which url somehow. when a prompt is pre-loaded, context cards may be pre-loaded from head JSON

- **Mediatype url analysis support** the contextarea.context api returns mediatype, so we can embed images as images into chat/completions.

- **Edit history**; either by storing a single previous link, all previous links in array, only all previous metadata, or all previous contents. Sidebar to scroll through the edit history.

- **Add models and other mediatypes**: Add Gemini 2.5 Pro w/ video upload - https://x.com/tryingET/status/1924810864260960271. Add image urls as images for claude/chatgpt. Also grok would be nice. Also, let's use some cerebras models.

# BUGS/Problems

- 🟠 In localhost, the thing isn't working as the server restarts. see where this bug comes from by changing versions and/or removing stuff (and ask claude)

- 🟠 Resultpage loads somewhat slow now some times, due to stripe middleware as the DO is being relocated. Could've been a temporary bug! It was supposed to be fast, so let's figure out why it is NOT fast. in private window, the DO is super fast. in current safari https://lmpify.com is slow (500+ms). figure out where it's located and how this is possible!? https://x.com/janwilmake/status/1922592298904219859 - potential solution; refresh access token after 24h so the DO doesn't stay slow, but gets refreshed; but need a proper transfer method for this too. It'd also be good to understand the problem better: log DO response time in `stripeflare` package with warning if its over 100ms?

- Problem: re-rendering entire text for every output token makes it slow, especially when doing so many calculations. Idea: seal markdown output after every section. Before beginning a codeblock, and after ending acodeblock, these are moments which we would be able to seal it up to there and create a new 'block'. This way only the latest block is being re-rendered, making it a lot faster. This would allow making complete codeblocks interactive already. Incomplete codeblocks can now also made interactive, especially if can figure out how to skip updating the UI for 95% of tokens, just update it everh 20th token. Besides, if I can do this, it'd be possible to render the unfinished html incrementally as it gets created, creating a magical experience.
