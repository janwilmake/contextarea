FLAREDREAM (or is this claudeflair material?)

- ✅ https://deploy.flaredream.com prompt in lmpify should generate the one file needed to deploy
- ✅ add additional system prompt
- ✅ add `prompt it!` button
- Make `?key=result&codeblock={path-or-index}` work (i may have better ideas)
- Ensure variable `{{prompt_id}}` is filled into context if present there. I had ideas for this
- MAKE IT A STREAMING `/chat/completions` endpoint with-money ™️ (I had ideas for this)
- Add "prompt it!" button to flaredream
- Put extexe in xytext terminal. Output should be a new file you make and already named.
- Make extexe-cli (see `cli.js.md`).

# GOAL: Make lmpify super accessible and minimise barrier to payment.

A lot of knowledge is stuck in the heads of smart prompt engineers. That's why I built 'let me prompt it for you', because it needs to be easier and more rewarding to share this. The potential of lmpify is far grander than it just being for developers!!! Let's double down on accessibility!

## uithub.com link

✅ git clone https://github.com/janwilmake/uithub.v1

✅ Put prompt it button on uithub v1

This is my biggest leverage thing I can do probably: Lead everything to the monetisation funnel.

Improve og image? https://x.com/janwilmake/status/1929879737322598536 this gets liked. what if it became even clearer that you can prompt from here?

## Render images

Just like html, images should be able to be shown as MD and as image. Sick! Now we can add any images into html using https://googllm-image.brubslabs.com. Just have a good system prompt for that

## Make links clickable

Links should still be shown as markdown but need to be clickable.

## Render links and urls as forms

If a link contains `{var}` or `?var=` (not filled in) it is assumed to require parameters and submission. Let's only support public GET.

## Link behavior markdown standard syntax

It could be interesting if we could make lmpify agentic more easily. I guess one of the ways to do this is by making found URLs and codeblocks alike easy to insert back into the prompt.

But imagine we even had a way for the agent to go off and immediately go to a particular URL, or even execute a new prompt? In this case, we've just made it agentic as it can choose to continue until it's satisfied a certain condition.

What if we use `goto://` as a protocol for this? If a link to `goto` is found in the response document, the behavior of lmpify client would be to immediately navigate there, even if the original prompt hasn't finished yet.

This can also be combined with lookup of information. What if you could specify a new promopt in a codeblock, then goto a new prompt, executing it, from that codeblock? I guess every codeblock should definitely have a fixed URL that can be made known to the LLM so it can self-reference stuff.

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
