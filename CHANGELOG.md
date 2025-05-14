# Original prompt (2025-05-12)

create a cloudflare worker in js with doc-comments and //@check-ts and /// cloudflare worker types directive

it should

accept method post and get

check pathname and read kv key of that pathname. if already exist, return ./result.html content (import resultHtml from "./result.html"). add <script> with json of kv value to end of head.

if not:

get prompt, model, basePath, apiKey from FormData

serve share.html (import it using `import shareHtml from "./share.html")

set kv key pathname value {pending:true, prompt,model,basePath,apiKey}

send to queue with the formdata items gathered.

also, queue should:

read message body out

get all urls in the prompt using regex

fetch all urls in parallel, getting text back

the context is then constructed from the urls: format: {url}\n{text}\n------\n\n{url2}\n{text2}\n\n (etc)

do a call to llm using POST {basePath}/chat/completions with the context as system prompt (if any) and the prompt as first message content

the result is added to kv under key of pathname

# ADR

- Need a simple interface for freemium LLM answers that has support for URL expansion. Must be FAST and pay-as-you-go.
- by design, I want to have a homepage, share page, and result page, so the user is incentivized to share. However, it may be better to combine them. with googling you kinda trust google to provide a good response. with llms we aren't there yet; you may want to verify. The share piece could be a footer visible on the result page.
- byok is a possibility to showcase models to people, but the main value proposition is shareability in general and an ability to use links as context building method. over-focusing on models might end up being an anti-pattern. i focus on context building instead, allowing lmpify to become a embeddable piece into any website through API and script.
- I want things to be fast and my current solution doesn't even stream. It sucks! The post request must stream itself but also immediately return the HTML and do other things. The cache must be set as soon as it's done but since it's only eventually consistent but it's meant for sharing, it should be there in the DO until the KV is available. KV ensures REAL speed everywhere globally, while DO ensures the thing happens close to the user.

# New specification

> Tomorrow: make new spec that streams prompt. Think first if chatcompletions.stream is the right abstraction..? or do I need this whole thing custom?
