Simple API built using cloudflare worker that uses kv and typescript (Available at https://pastebin.lmpify.com or as default exported `{ async fetch(request: Request, env: { PASTEBIN_KV: KVNamespace }, ctx: ExecutionContext) => Promise<Response> }` function) that:

POST `/`

- send it a text or binary in post body `POST /`
- stream in the body chunk by chunk. first, extract as many characters as needed to determine if it's a string or binary (the first chunk should be enough)
- determine the key: look at the headers for the filename and content-type. If present, use `{slugify(filename)}-{randomString(14)}.ext`. If these headers aren't present, a the 7-character random key is enough (no ext for binary, `.md` for text)
- in `ctx.waitUntil`, stream entire body to kv. use putWithMetadata and add `content-type`
- If POST ends up being over 25mb in size, fail for binary. for text, strip anything after 25mb (stop streaming in)
- ensure the response of this endpoint is a stream that writes the URL first and only closes the stream after the entire request is streamed through

Other endpoints:

- expose `HEAD|GET /{key}` to retrieve any pastebin with the right `content-type` and `content-length`
- expose `OPTIONS` method allowing any cors
