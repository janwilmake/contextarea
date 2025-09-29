Extexe CLI does the following:

- get environment variables `LLM_BASEPATH`, `LLM_SECRET`, `LLM_MODEL`, and `LLM_SYSTEM` from the node process if present. if not, look in `./.env.extexe` relative to cwd. if not available, look at `~/.env.extexe`. if not available, instruct the user they need to set it. they're all required.
- check for `.git` and go up the file hierarchy if not present until you find one. if not found, instruct the user this only works in a `.git` folder
- check if git is dirty. if so, prompt user whether or not to continue. only enter is continue. if git is not dirty, skip this step.
- look at all files in your cwd to retrieve the filename and last modified date
- for each file with two or more extensions that ends with md, find the associated destination filename (remove the last extension). e.g. `main.js.md` becomes `main.js`. These are extexe pairs. If there are none, return early.
- For each extexe pair, check whether or not the last updated date of the definition is later than the last update date of the destination (or the destination file doesn't exist yet). Print all pairs and whether or not this is the case. If there are no definitions that are newer than destinations, return early here.
- expand the definition file by finding all URLs present and fetching them, then prepending `context:\n\n${url1}\n${urlResult1}\n----\nn${url2}\n${urlResult2}\n----\n` to the content of the definition. if the url response had the `text/html` content-type, omit it and show a warning. If a response wasn't 200 or errored, show a warning (but still continue).
- run `/chat/completions` for each of them in parallel. use LLM_SYSTEM as system prompt.
- For each response:
  - show warning if output couldn't be found
  - In the output find the first codeblock. If not found, show warning.
  - Write the content of the codeblock to the destination filename.
  - Show a log that the file has been written

It runs in node.js without any depdencies. use regular `fetch` (not node-fetch) for the url fetching

Please use doc-comments with type definitions.
