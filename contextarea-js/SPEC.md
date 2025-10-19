. **Context API OpenAPI Spec**:
https://raw.githubusercontent.com/janwilmake/contextarea/main/context/openapi.json

2. **Pastebin API OpenAPI Spec**:
   https://raw.githubusercontent.com/janwilmake/contextarea/main/pastebin/openapi.json

Based on this API Spec, create a demo HTML + JS + CSS for this.

# `lib.js`:

Pasting:

- when the paste is a text that is a url in itself (or a trimmed version is a url) then just do a regular paste.
- also when the paste is a text of 1000 characters or less, make it a regular paste
- when holding shift while pasting, will do a regular paste
- if none of the above, captures that and sends to the paste api (use string for text, blob for binary), and retrieves the URL, inserts the URL into the textarea instead.

Drag and drop:

- also supports drag and drop, when dropping anything in there, sends that instead.

Upload button:

- a upload button should be shown in bottom right that opens the file selector for multiple files, can be any files. this should have the same behavior as dropping

Context List

- it uses regex to extract all urls form the textarea
- it uses the context api to retrieve all url data (cached).
- below the textarea, it renders a listview (2 lines) showing a tiny summary of the context
  - the og image 40x30px
  - the url on the first line
  - the title + type + token count on the second line
- Instead of clearing and rebuilding everything, update only what changed for the context list. it's only done a second after the last keyboard input (debounce). the fetches chan be done in parallel in a background thread, not blocking the ui.

# `index.html` SPEC:

- it imports lib.js and style.css from the root domain contextarea.com (absolute urls)
- in the html its just html. the while in lib.js it acts on any element it finds that is <textarea id="contextarea" ...>...</textarea>
- add a description of the demo and link + stars to repo janwilmake/contextarea

# `style.css` SPEC:

- it has good descriptions for each style and a namespace `.contextarea-*` so its not colliding with anything.
- ensure the styling is modern and the drop behavior shows the dotted border light up

implement all 3 files fully:

- index.html,
- lib.js,
- style.css.

Return with the full implementation.
