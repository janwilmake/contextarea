Install Needed Plugins First

# Mission: Context Area

- make initial fast cached context api, and document it

- paste large texts should turn into a URL to keep it easy to oversee the prompt. use pastebin as imported code `from "./lmpify.pastebin/pastebin"` (`/lmpify.pastebin/README.md`)

- for each link in the prompt, the frontend should have an api to render the context card for it which includes url, title, tokens, og-image, and more. these should be dynamically rendered below your prompt, and must be clear which belongs to which url somehow. when a prompt is pre-loaded, context cards may be pre-loaded from head JSON

- the contextarea.context api returns mediatype we can embed images as images into chat/completions. same for videos, which should force models.

Make this api ready for revshare too by extracting the 'context creator'. Leverage `meta name="author"` as well as `twitter:creator` but also simply the URL itself for github and x to identify the owner of the URL context.

🔥 Basically for any xymake person link I want their face appear with a title/description. Need to improve the HTML result metadata for this, but is definitely possible!

# After contextarea works... add to lmpify and focus on this

Add contextarea! seeing tokens of urls and seeing if urls not work is huge for understanding.

On homepage, ensure shift+enter is submit, not enter.

Fix bugs on mdapply: we can't accomodate for all structures progamatically but we can accomodate for ```ext filename=""`. Let's do that instead, and instruct this to be system-prompted on how to respond. In lmpify, I'd want a simple system prompt that can be deleted. It can just be a URL!

Fix bugs on response with ``` in code etc. this is very important.

Add toggle button to view context in right panel rather than result. this could be live connected with context-cards, rather than from data.

# hackathon sub mission

Submission to [this hackathon](https://x.com/mattzcarey/status/1926186148369408354): to make humans better we have to optimise for truth and human understanding. to do that, we have to make the interface be a map of reality. this is why URLs, universal resource locators, are perfect, and we should not hide them away, we should embrace them for what they are: they are maps to expand our perception.
