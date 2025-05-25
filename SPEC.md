. **Context API OpenAPI Spec**:
https://raw.githubusercontent.com/janwilmake/contextarea/main/context/openapi.json

2. **Pastebin API OpenAPI Spec**:
   https://raw.githubusercontent.com/janwilmake/contextarea/main/pastebin/openapi.json

based on this spec, create a demo HTML + JS + CSS for this.

lib.js:

- allows pasting anything (text or binary) into a textarea, captures that and sends to the api, and retrieves the URL, inserts the URL into the textarea instead.
- when the paste is a text that is a url in itself (or a trimmed version is a url) then just do a regular paste. also when the paste is a text of 1000 characters or less, make it a regular paste
- when holding shift while pasting, will do a regular paste also
- also supports drag and drop, when dropping anything in there, sends that instead.
- a upload button should be shown in bottom right that opens the file selector for multiple files, can be any files. this should have the same behavior as dropping
- it uses regex to extract all urls form the textarea. below the textarea, it uses the context api to retrieve all url data (cached). it renders a cards view showing all properties except context. the og image should be rendered if available
- on every card, a button have a button to open the actual url
- Instead of clearing and rebuilding everything, update only what changed for the context cards. it's only done a second after the last keyboard input (debounce). the fetches chan be done in parallel in a background thread, not blocking the ui.

index.html spec:

- it imports https://contextarea.com/lib.js and https://contextarea.com/style.css
- in the html its just html. the while in lib.js it acts on any element it finds that is <textarea id="contextarea" ...>...</textarea>
- add a description of the demo and link + stars to repo https://github.com/janwilmake/contextarea

style.css SPEC:

- it has good descriptions for each style and a namespace .contextarea-\* so its not colliding with anything.
- ensure the styling is modern and the drop behavior shows the dotted border light up

implement all 3 files fully:

- index.html,
- lib.js,
- style.css.

Return with the full implementation
