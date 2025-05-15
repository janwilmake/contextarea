make a demo for @README.md that:

- allows pasting anything (text or binary) into a textarea, captures that and sends to the api, and retrieves the URL, inserts the URL into the textarea instead.

- when the paste is a text that is a url in itself (or a trimmed version is a url) then just do a regular paste.

- when holding shift while pasting, will do a regular paste also

- also supports drag and drop, when dropping anything in there, sends that instead.

- it uses regex to extract all urls form the textarea. below the textarea, it renders a horizontally scrollable row where it renders a card for each url. each card shows the hostname and extension (if any). each card should also do a head request (cached) to that URL to get the content-length and content-type, and render these headers (if available)
