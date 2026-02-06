# Flaredream Improvements

Create a flaredream template that uses typescript and packages! Do the bundling as separate step using esbuild. I should start doing all my own projects in this way. Also, attaching a local CLI for `flaredream build` will be nice, simply adding in the "durable-worker" idea. Great to introduce.

Also needed:

1. pass wrangler and export defaulted config to build.
2. have default entrypoint if wrangler not provided
3. generate types from flaredream types from remote url
4. use it to know what to do at deployment
5. ability to add formdata properties like name, pattern[], not query-params.

# Flaredream MCP

I can now already turn https://flaredream.com/system.md into an MCP, albeit with manual auth. Post about it?

First MCPs I want:

- **Iterate Agent** `deploy` tool at the end: `deploy.flaredream.com/download.flaredream.com/id` for Flaredreams initial generation, using `deploy` tool after it's done (deploy tool must have access to intermediate result)
- **Feedback agent** for Testing a flaredream deployment (`test(evaloncloudID,request,criteria)=>feedback` tool that processes request into feedback, and `final_feedback(feedback, replace_feedback:boolean, status: "ok"|"fail"|"retry")` will end the agent)

This is a great first milestone having the 2 MCPs separately. With this I can verify manually if this works. After that, a looping agent can use both in a loop!

# Deployment MCP

- ✅ Improve cloudflare provider, create `login-with-cloudflare` package.
- Use that in https://deploy.flaredream.com and make it an MCP using `withMcp`
- Use deploy.flaredream.com/mcp as MCP tool with flaredream LMPIFY FormData stream, from within flaredreams landingpage. This requires login with Cloudflare as well as my personal API key for LMPIFY (for now)

I should now be able to start the entire request from flaredream.com, and let users look into the response if they want to (but not require that). I can now just add XMoney to flaredream and use XYText as interface.

Idea - allow context of the generation to include MCP urls! This way the tools used become part of the definition. Logical! Imagine having a tweet MCP, all it'd take would be something like this:

```md
https://xymake.com/mcp

Hey, this is a tweet. It can literally just be understood one on one
```

# Make the tailproxy MCP work!!!

- ❌ Why doesn't this work sometimes? Is it permissions? is it the route?
- What else can I make to make this more user friendly? I wanna be able to manually test in this way in the browser, and see logs somehow. In a header is great, but what if a script can be injected into each html output that has a sw.js that observes all requests and adds tail logs? This could potentially be very insightful.
- The deployment API --> Tailproxy should also functions as MCPs and should be first made possible from contextarea.com
