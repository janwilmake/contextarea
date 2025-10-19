# 2025-05-25

## Mission: Context Area

- ✅ make initial fast cached context api, and document it
- ✅ paste large texts should turn into a URL to keep it easy to oversee the prompt. use pastebin as imported code `from "./lmpify.pastebin/pastebin"` (`/lmpify.pastebin/README.md`)
- ✅ for each link in the prompt, the frontend should have an api to render the context card for it which includes url, title, tokens, og-image, and more. these should be dynamically rendered below your prompt, and must be clear which belongs to which url somehow.
- ❌ when a prompt is pre-loaded, context cards may be pre-loaded from head JSON
- ✅ the contextarea.context api returns mediatype
- ✅ Make this api ready for revshare too by extracting the 'context creator'. Leverage `meta name="author"` as well as `twitter:creator` but also simply the URL itself for github and x to identify the owner of the URL context.

# 2025-05-26

## contextarea.context fetch

✅ For https://xymake.com/janwilmake/status/1926366057482109066 ensure we prompt the default one in the way that it seems like a crawler (that wants the OG) so we show HTML.

✅ See how I did that in `user-agent-router`
