# Let Me Prompt Stream-Server - A single prompt should be enough to share simple GPT ideas!

- ✅ serve response files in right mediatype from codeblock index as well as path
- ✅ easy to share and navigate any gpt idea
- ✅ Serve it with `/llms.txt|json`
- ✅ Easy to go back to editing prompt interface

# Non-goals

- landing page
- auth
- pricing
- leaderboard

All of the above are not part of the POC and are likely done in other workers.

# Earlier work

- https://github.com/janwilmake/githus
- https://github.com/janwilmake/iRFC-cloud

# ADR

This relies on the simplest way to allow all subdomains to route to the same worker in Cloudflare:

In your wrangler:

```toml path="wrangler.toml"
route.pattern = "*.letmeprompt.com/*"
route.zone_name = "letmeprompt.com"
```

In your DNS, add type: `AAAA`, name: `*`, content: `100::`, proxied.

# TODO:

## Make it stream incomplete pages?

What if we could proxy to the streaming endpoint of LMPIFY from the iframe URL, incase we are visiting a incomplete page?

- We could do this by adding `?_streamfromiframe=1` to the url
- This could connect to the stream and return a direc text stream with content-type `text/html` that starts at the last codeblock from the initialisation, and concats everything until we find a codeblock-ending segment.

TODO:

- improve lmpify to have more documented streaming docs
- throw this prompt against current implementation and see if it works. should be possible!

This probably also may bring some more problems, but could be very cool.

Another technique could be `multipart/x-mixed-replace`: https://addmaple.com/blog/using-multipartx-mixed-replace-for-multi-modal https://addmaple.com/blog/using-multipartx-mixed-replace-for-multi-modal
