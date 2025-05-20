# QOL:

- Add 💡 logo to og-image **didn't work last time. figure out what is wrong with the png format**

- Every codeblock should be available using the proper mediatype at `https://{slug}-{hash}.lmpify.com/{path}`. All links should be easy to find and add to the prompt.

# Layers on top of lmpify: `context.json` or code generator

- A JS-based embed (`<div id="lmpify"></div><script src="https://lmpify.com/widget.js?query=a&b=c&d=e"></script>`) which renders it into a div, as a widget, in several sizes/ways (Could be separate files too) **the problem here is i need more than just the input. I need the result page and build around that**

- IDEA 1 = CONTEXT BUILDER: make my own personal landingpage that has a simple textarea and a bunch of contexts to easily click to add to the input box that links through to lmpify. for this, use an endpoint for all my lists where it finds and applies context.json and .genignore in each and shows different context's

- IDEA 2 = SYSTEM PROMPT SELECTOR: similar to https://mcpify.ai but with minimal code, I could build something that'd link through to lmpify. If I then OSS that template, I can convince people to build these with their own set of prompts, and make them earn money.

- IDEA 3 = Paid prompts. A way to incentivize people to share a prompt is by allowing them to price it. Not sure if this should be core or a layer on top somehow, but it could be a great product after people create collections.

- Idea: bookmarks - ability to save cool generations; NO; lets focus on superior personal X search which could accomplish the same goal.

# IDEAS

- IDEA: if at least one URL returns a `multipart/form-data` stream or file object, take the biggest of those, and use it with `uithub.filetransformers` with the rest of the prompt. we now apply the prompt on every file. Critical component: detecting streamable url response early + proxy traffic.

- IDEA: "hooks" - plugins users can install that allow performing additional analysis on the prompt, context, and result. This could become a marketplace in itself.

- IDEA: `/from/{url}` could be what shows up in address bar, may make it easier to learn that convention, or at least show it in the interface, if it was the source.

- IDEA: User-based DO that collects all history and keeps a live connection with any active browser session of that user, such that it is broadcastable from https://lmpify.com/{userslug} and a history is also collected there. A good MVP would be to first make websocket-markdown editor DO like bruna almost did

# Virality

There are many things to do with output

- **md/html prompt-it buttons**: buttons that can be added to a website or markdown file that link to a resultpage.

- **mdapply**: Proposed flow: 1. make post on X, 2. use xymake url and a prompt, 3. now get resulting files and a cli to paste them into cwd: `npx mdapply {url}`. All I need is a nice function to fetch the url, parse the codeblocks and belonging filenames (either in codeblock variable or use the above backtick-code as filename). It should then simply write these files into the cwd, which allows testing and seeing what was made. If this works, a button to find this command would be useful!
