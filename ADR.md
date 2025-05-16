# Requirements / Goals

- Viral LLM Product
- Strong Focus on Ease of use and Accessibility
- Edit Flow > Iterative Messaging
- URL Expansion with realtime insights (tokens, mediatype)
- Context landing page
- High Quality OG images
- Prompt Check (for OG, but also for missing context)
- Full Result is URL, each codeblock is URL
- Painpoint: Prompting workflows are very private, sharing functionality sucks. Visibility is value. Help devs share and monetise their learnings.

# Non-goals

- Chat history
- Inline previews
- Styles
- Integrations
- Uploads
- Tools

# Fixed annoying JSON parse bug

After asking LLM, it first came up with the wrong idea.

After googling, I found https://mathiasbynens.be/notes/etago which recommended a few escapes

After that i still got a json parse error, the abover is also very old

after telling that to claude, it came up with `safelyEmbedDataInScriptTag` which has just a single escape, which is great. Now the data can easily be parsed on the HTML side with `const data = JSON.parse(document.getElementById('server-data').textContent);`. I should probably always be using that.
