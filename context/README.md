# Context Extraction Service

High level Requirements:

- Strong focus on performance: KV-level initial response speeds.
- For each link in the prompt, the frontend should have an api to render the context card for it which includes `{url, title, tokens, ogImage, contentType, ...other}`. these should be dynamically rendered below your prompt, and must be clear which belongs to which url somehow. when a prompt is pre-loaded, context cards may be pre-loaded from head JSON
- Get the appropriate context for showing "context-cards" as well as for building context
- Sanetize/DOMPurify?
- Structured response: Invdividual URLs (url => object), but also think about string => array
- Possibly separate in 2 apis: per item and for entire string.
- ability to `omitContext` to just get details for api.

# TODO

1. ✅ **Make this work** as embeddable worker lib
2. ✅ Use this in pastebin `demo.html` instead of doing the fetch in there (risking cors or other different results)
3. ✅ Make demo into a js-lib (`contextarea.js`) so the HTML has full control over styling and page composition.
4. ✅ In both `homepage.html` and `result.html` use `contextarea.js`
