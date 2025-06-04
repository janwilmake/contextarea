# GOAL: Make lmpify super accessible and minimise barrier to payment.

A lot of knowledge is stuck in the heads of smart prompt engineers. That's why I built 'let me prompt it for you', because it needs to be easier and more rewarding to share this. The potential of lmpify is far grander than it just being for developers!!! Let's double down on accessibility!

## uithub.com link

git clone https://github.com/janwilmake/uithub.v1

Put prompt it button on uithub v1

This is my biggest leverage thing I can do probably: Lead everything to the monetisation funnel.

improve og image? https://x.com/janwilmake/status/1929879737322598536 this gets liked. what if it became even clearer that you can prompt from here?

## Render images

Just like html, images should be able to be shown as MD and as image. Sick! Now we can add any images into html using https://googllm-image.brubslabs.com. Just have a good system prompt for that

## Make links clickable

Links should still be shown as markdown but need to be clickable.

## Proper Markdown Rendering

Problem: Fix bugs on response with ``` in code etc. this is very important: https://lmpify.com/httpsuithubcomj-odsfdc0.md?key=result

Research: https://x.com/janwilmake/status/1926992658536206687

The solution is bi-partial:

1. use `marked` and render things with that
2. ensure by default a system promopt is used that instructs how to write code block fences in markdown.

TODO:

- ✅ write system prompt that instructs using `````` (5 backticks by default or more when necessary)
- Apply adding 1 backtick to fence in `getMarkdownResponse`
- Ensure `named-codeblocks.md` system prompt is used by default without making things ugly
- Rewrite `markdown-highlighter.js` using `marked`
- Test 1 https://lmpify.com/httpsuithubcomj-y3ac2c0
- Test 2 md-example that contains several codeblocks

After this works, deploy and get code for `x-oauth-stripe` repo (https://lmpify.com/httpsuuithubcom-waprk40)

## Images as context, videos as context

HTML is terrible since it's too big. However as a screenshot it can be great for making websites. Let's nudge people when they used a HTML context to instead use it as image. When clicked, it prepends https://quickog.com/{url}, which screenshots it.

Any URL that's an image should be inserted as image context to the model. Now we can do some sick sick stuff!

Video urls should be inserted as video context to the model (if the model supports it)

Whenever context is an image, it should show the # of tokens and it should show the fact that it's an image in the context ui.

Worth a post!

## Bookmarking context

❗️❗️❗️❗️❗️❗️❗️ Bookmark contexts: separate interface that I can just embed as js that allows adding contexts that I bookmark.

- Adds button 🔖 to topleft which opens/closes bookmarks sidepanel
- loads in all bookmarks through context.contextarea.com and renders in nice way showing url, title, tokens, og, may be a bit bigger
- button on every bookmark to remove bookmark or use
- also shows current textarea value ones on top with ability to bookmark
- search on top that searches over titles and urls

The state of bookmark contexts is just a flat list of urls and we can use localStorage to store that as `string[]`. Great thing about it is that we use the already authenticated api of context to expand it into something useful. The UI could just make it possible to send this `string[]` over to a predictable URL that is github-authorized, e.g. https://bookmarks.contextarea.com/janwilmake. This can be done by just using pastebin, then using https://bookmarks.contextarea.com/publish?url={url}. This would authenticate, then set the value, making it shareable everybody.

The 'personal context base' should be available publicly as well! this in turn allows turning this into a simple fetch mcp to gather a context prompt!
