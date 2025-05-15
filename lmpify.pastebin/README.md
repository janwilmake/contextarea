Simple API (Available at https://pastebin.lmpify.com or as default exported `{ async fetch(request: Request, env: { PASTEBIN_KV: KVNamespace }, ctx: ExecutionContext) => Promise<Response> }` function) that:

- send it a text in post body `POST /`
- stream in the body chunk by chunk. first, extract first 20 characters and respond with url
- in ctx.waitUntil, stream entire body to kv. The key should be `{slugify(first 20 characters)}-{7character-random-string}`
- if POST ends up being over 25mb in size, strip anything after 25mb (stop streaming in)
- expose `GET /{key}` to retrieve same any pastebin

Make the above in a cloudflare worker that uses kv. use typescript.
