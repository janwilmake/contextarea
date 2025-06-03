# GOAL: Make lmpify super accessible and minimise barrier to payment.

A lot of knowledge is stuck in the heads of smart prompt engineers. That's why I built 'let me prompt it for you', because it needs to be easier and more rewarding to share this. The potential of lmpify is far grander than it just being for developers!!! Let's double down on accessibility!

## Free 70B llama model

This can be taken for free from cloudflares credit!!! Should still have IP-based ratelimit though, but can easily be 100 requests per day per IP with this model.

Or we can see if people would pay $0.60 atleast, and set that as initial requirement. This is MUCH better!

POST: models added, lmpify now free for `llama70b`

## Put 'Prompt it' button on uithub.com

This is my biggest leverage thing I can do probably: Lead everything to the monetisation funnel.

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

## Proper Markdown Rendering

Problem: Fix bugs on response with ``` in code etc. this is very important: https://lmpify.com/httpsuithubcomj-odsfdc0.md?key=result

Research: https://x.com/janwilmake/status/1926992658536206687

The solution is bi-partial:

1. use `marked` and render things with that
2. ensure by default a system promopt is used that instructs how to write code block fences in markdown.

TODO:

- ✅ write system prompt that instructs using `````` (5 backticks by default or more when necessary)
- apply adding 1 backtick to fence in `getMarkdownResponse`
- ensure `named-codeblocks.md` system prompt is used by default without making things ugly
- rewrite `markdown-highlighter.js` using `marked`
- Test 1 https://lmpify.com/httpsuithubcomj-y3ac2c0
- Test 2 md-example that contains several codeblocks

After this works, deploy and get code for `x-oauth-stripe` repo (https://lmpify.com/httpsuuithubcom-waprk40)

## Render images

Just like html, images should be able to be shown as MD and as image. Sick! Now we can add any images into html using https://googllm-image.brubslabs.com. Just have a good system prompt for that

## Make links clickable

Links should still be shown as markdown but need to be clickable.

## Images as context

HTML is terrible since it's too big. Let's use HTML as screenshots by default

Any URL that's an image should be inserted as image context to the model. Now we can do some sick sick shit!

## Bookmarking context

❗️❗️❗️❗️❗️❗️❗️ Bookmark contexts: separate interface that I can just embed as js that allows adding contexts that I bookmark.

- Adds button 🔖 to topleft which opens/closes bookmarks sidepanel
- loads in all bookmarks through context.contextarea.com and renders in nice way showing url, title, tokens, og, may be a bit bigger
- button on every bookmark to remove bookmark or use
- also shows current textarea value ones on top with ability to bookmark
- search on top that searches over titles and urls

The state of bookmark contexts is just a flat list of urls and we can use localStorage to store that as `string[]`. Great thing about it is that we use the already authenticated api of context to expand it into something useful. The UI could just make it possible to send this `string[]` over to a predictable URL that is github-authorized, e.g. https://bookmarks.contextarea.com/janwilmake. This can be done by just using pastebin, then using https://bookmarks.contextarea.com/publish?url={url}. This would authenticate, then set the value, making it shareable everybody.
