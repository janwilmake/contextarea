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
