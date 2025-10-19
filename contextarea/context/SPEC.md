# Cloudflare Worker Footprint

Input: url

How to gather context:

- try kv and ctx.waitUntil the actual fetch
- if no kv, do the actual fetch and store in kv afterwards
- it should do 2 fetches in parallel:
  - one preferring text/html
  - one preferring text/markdown
  - both have fallback to `*/*` to also get things like images
- temporarily caches the output into kv for faster retrieval
- must always get kv if available, but if it's too old, also re-retrieve it in ctx.waitUntil
- for HTML parsing, use `HTMLRewriter`, `DOMParser` is not available in Cloudflare Workers
- use tee to clone the response

output:

- `title` from HTML or response headers if no html
- `description` from HTML or create a custom description if no HTML
- `meta`: infer this from HTML if HTML was found. should be all meta-tags values
- `mime`: the content-type
- `type`: "text"|"image|"video"
- `ogImageUrl` from metatags og:image or twitter:image
- `context`: the actual text content if type is text. should prefer the result from the text/markdown fetch, but use the result from text/html if that wasn't available
- `tokens` amount of tokens of the text content (length / 5)
- `githubOwner` - incase it's known (can be based on URL)
- `twitterUsername` - incase it's known (can be based on URL or meta `twitter:author` value)

Ensure the output is a prettified JSON.stringify json object

Be sure not to run into the issue where we were trying to read the same response multiple times by being more careful with how we handle the response streams.

Add cors header to allow all

Implement this using `export default { fetch }` syntax in typescript, using the following up top:

```ts
/// <reference types="@cloudflare/workers-types" />
/// <reference lib="esnext" />
//@ts-check
```
