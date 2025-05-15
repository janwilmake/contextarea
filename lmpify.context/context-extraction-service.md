# Context Extraction Service

Requirements:

- For each link in the prompt, the frontend should have an api to render the context card for it which includes `{url, title, tokens, og-image, ...other}`. these should be dynamically rendered below your prompt, and must be clear which belongs to which url somehow. when a prompt is pre-loaded, context cards may be pre-loaded from head JSON
- Get the appropriate context for showing "context-cards" as well as for building context
- Sanetize/DOMPurify?
- Structured response: Invdividual URLs (url => object), but also think about string => array
- Strong focus on performance: KV-level initial response speeds.
- Possibly separate in 2 apis: per item and for entire string.
- ability to `omitContext` to just get details for api.

# Footprint

- input: url or text

- output:

  - metadata (title, description, og-details) from HTML or response headers
  - the appropriate context
  - array of the above for all urls, if input wasn't a single url

- notes:

  - temporarily caches the output into kv for faster retrieval
  - must always get kv if available, but if it's too old, also re-retrieve it in ctx.waitUntil

How to gather context:

- try kv and ctx.waitUntil the actual fetch
- if no kv, quickfetch (max 2 seconds) and ctx.waitUntil the longer fetch
- if raw url is not HTML, use it directly
- use vercel-based reader for links that returned HTML https://reader.llmtext.com/openapi.json

# TODO

1. Make this work as embeddable worker lib as well as browser-based memory lib (maybe `get-context.js` to which getters and setters to storage are passed?)
2. In api, add result to `window.data.context: object[]`
3. In both `homepage.html` and `result.html` use `get-context.js` and properly render the cards. Also cool: When cursor is on URL, highlight that card, and add a button on card that puts the textarea cursor to the start of the encountered url.
