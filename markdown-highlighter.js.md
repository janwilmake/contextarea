---
context: markdown-highlighter-old.js
---

improve this;

- keep track of localStorage codeblockView:"collapsed"|"code"|"render"
- button to change state for each codeblock, also sets default when changing to determine default upon page load. if not set, default is "code"
- if loading:true is provided to processContent function, don't allow changing the state and force "code" as default
- when collapsed, shows only the language, amount of tokens inside (length/5) with a nice button to toggle collapsing, copy (shows as card)
- when "code", shows the markdown as is but with color highlighting, like now
- if language is html and "render" is selected, show button to toggle showing code with iframe which the html is injected into. for other languages, render is not supported
- always have button 'copy' in header
  give me the new js
