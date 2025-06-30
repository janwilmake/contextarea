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

## Render links and urls as forms

If a link contains `{var}` or `?var=` (not filled in) it is assumed to require parameters and submission. Let's only support public GET

# QOL:

- Add 💡 logo to og-image **didn't work last time. figure out what is wrong with the png format**

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

# High Impact Improvements

We can embed images as images into chat/completions.

Add support for videos too by doing a model update, adding gemini. which should return an error if the model doesnt support video

Make `?prompt&query&model` work from homepage (prompt insta-submits, is this safe?). Improve the widget making it very well documented and turn that into a README.

Add easily embeddable link that links to result. It's now just clickable but not insertable.

New footer. Footer Real Estate:

- ✔️ copy link
- ✔️ change model
- ✔️ try again or reply
- if output has codeblocks: patch button
- markdown for prompt-it button

# `/chat/completions`

Every `context` can automatically be cached as a system prompt intelligently when needed reducing cost significantly. It would keep an up-to-date cached context available for a url, and people would be able to build products for this easily.

Ultimately, get back to https://x.com/EastlondonDev/status/1925191566362030380 about it

Generally its a good idea to allow for programmatic access and give people an API for this!!!!!!!! Imagine if people could earn money by easily creating new stripeflare workers that allow access to this API? You could set any price and it'd be super easy to setup via a lmpify.

TODO:

1. Every url can be a basePath for the OpenAI SDK (as long as POST `*/chat/completions` is given, proxy with system prompt being set to context + prompt). Model value should follow the same allowed values as what I have now. Can still use all other values.

2. In the UI, show 'Use Context' in footer which shows how to use the API.

After this is there, a CLI like `npm i -g lmpify` and then `lmpify` to login and then `lmpify {url|path(|hash?)}` to change context and then `lmpify {message}` to chat and stream back response. This'd be epic.

Ultimately, also get back to https://x.com/EastlondonDev/status/1925191566362030380 about it

- give access_token
- simple api with ?query&parameters that streams as well
- /chat/completions api
- /responses api (openai new standard)

# Analytics & revshare

🛑 talk with what OSS repo-owners want. make profit, or pay for larger free tier (and make profit elsewhere)? https://x.com/janwilmake/status/1926518646785917107

IDEA: to enable Rev-sharing with repo owners, X users, and knowledge-base builders

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

- **Edit history**; either by storing a single previous link, all previous links in array, only all previous metadata, or all previous contents. Sidebar to scroll through the edit history.

- **Add models and other mediatypes**: Add Gemini 2.5 Pro w/ video upload - https://x.com/tryingET/status/1924810864260960271. Add image urls as images for claude/chatgpt. Also grok would be nice. Also, let's use some cerebras models.

# IDEA: Make prompt button more appealing

- Add links alternative clients in the model modal
- Add copy button for prompt textarea contents

It's interesting ways to make the 'prompt it' button more appealing

# BUGS/Problems

- 🟠 In localhost, the thing isn't working as the server restarts. see where this bug comes from by changing versions and/or removing stuff (and ask claude)

- 🟠 Resultpage loads somewhat slow now some times, due to stripe middleware as the DO is being relocated. Could've been a temporary bug! It was supposed to be fast, so let's figure out why it is NOT fast. in private window, the DO is super fast. in current safari https://letmeprompt.com is slow (500+ms). figure out where it's located and how this is possible!? https://x.com/janwilmake/status/1922592298904219859 - potential solution; refresh access token after 24h so the DO doesn't stay slow, but gets refreshed; but need a proper transfer method for this too. It'd also be good to understand the problem better: log DO response time in `stripeflare` package with warning if its over 100ms?

- Problem: re-rendering entire text for every output token makes it slow, especially when doing so many calculations. Idea: seal markdown output after every section. Before beginning a codeblock, and after ending acodeblock, these are moments which we would be able to seal it up to there and create a new 'block'. This way only the latest block is being re-rendered, making it a lot faster. This would allow making complete codeblocks interactive already. Incomplete codeblocks can now also made interactive, especially if can figure out how to skip updating the UI for 95% of tokens, just update it everh 20th token. Besides, if I can do this, it'd be possible to render the unfinished html incrementally as it gets created, creating a magical experience.
