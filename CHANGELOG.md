# 2025-05-25

## Mission: Context Area

- ✅ make initial fast cached context api, and document it
- ✅ paste large texts should turn into a URL to keep it easy to oversee the prompt. use pastebin as imported code `from "./lmpify.pastebin/pastebin"` (`/lmpify.pastebin/README.md`)
- ✅ for each link in the prompt, the frontend should have an api to render the context card for it which includes url, title, tokens, og-image, and more. these should be dynamically rendered below your prompt, and must be clear which belongs to which url somehow.
- ❌ when a prompt is pre-loaded, context cards may be pre-loaded from head JSON
- ✅ the contextarea.context api returns mediatype
- ✅ Make this api ready for revshare too by extracting the 'context creator'. Leverage `meta name="author"` as well as `twitter:creator` but also simply the URL itself for github and x to identify the owner of the URL context.

# 3 more things

❗️ For https://xymake.com/janwilmake/status/1926366057482109066 ensure we prompt it in the way that it seems like a crawler so we show HTML

❗️❗️❗️❗️❗️❗️❗️ Fix bugs on response with ``` in code etc. this is very important: https://lmpify.com/httpsuithubcomj-odsfdc0.md?key=result

- rewrite this using `marked` ensuring it also supports codeblocks in codeblocks. try this with markdown example
- Test 1 https://lmpify.com/httpsuithubcomj-y3ac2c0
- Test 2 md example

❗️❗️❗️❗️❗️❗️❗️ Bookmark contexts: separate interface that I can just embed as js that allows adding contexts that I bookmark.

- Adds button 🔖 to topleft which opens/closes bookmarks sidepanel
- loads in all bookmarks through context.contextarea.com and renders in nice way showing url, title, tokens, og, may be a bit bigger
- button on every bookmark to remove bookmark or use
- also shows current textarea value ones on top with ability to bookmark
- search on top that searches over titles and urls
