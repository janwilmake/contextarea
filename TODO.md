# Context Area

- paste large texts should turn into a URL to keep it easy to oversee the prompt. use pastebin as imported code `from "./lmpify.pastebin/pastebin"` (`/lmpify.pastebin/README.md`)

- for each link in the prompt, the frontend should have an api to render the context card for it which includes url, title, tokens, og-image, and more. these should be dynamically rendered below your prompt, and must be clear which belongs to which url somehow. when a prompt is pre-loaded, context cards may be pre-loaded from head JSON

- the contextarea.context api returns mediatype, so we can embed images as images into chat/completions. same for videos, which should force models.

Leverage `meta name="author"` as well as `twitter:creator` but also simply the URL itself for github and x to identify the owner of the URL context.

🔥 Basically for any xymake person link I want their face appear with a title/description. Need to improve the HTML result metadata for this, but is definitely possible!

Make this api ready for revshare too by extracting the 'context creator'
