# Flaredream Improvements

Create a flaredream template that uses typescript and packages! Do the bundling as separate step using esbuild. I should start doing all my own projects in this way. Also, attaching a local CLI for `flaredream build` will be nice, simply adding in the "durable-worker" idea. Great to introduce.

Also needed:

1. pass wrangler and export defaulted config to build.
2. have default entrypoint if wrangler not provided
3. generate types from flaredream types from remote url
4. use it to know what to do at deployment
5. ability to add formdata properties like name, pattern[], not query-params.

# MCP Use

I can now already turn https://flaredream.com/system.md into an MCP, albeit with manual auth. Post about it?

First MCPs I want:

- **Iterate Agent** `deploy` tool at the end: `deploy.flaredream.com/download.flaredream.com/id` for Flaredreams initial generation, using `deploy` tool after it's done (deploy tool must have access to intermediate result)
- **Feedback agent** for Testing a flaredream deployment (`test(evaloncloudID,request,criteria)=>feedback` tool that processes request into feedback, and `final_feedback(feedback, replace_feedback:boolean, status: "ok"|"fail"|"retry")` will end the agent)

This is a great first milestone having the 2 MCPs separately. With this I can verify manually if this works. After that, a looping agent can use both in a loop!

Tools:

```ts
type Tool = {
  /**The type of the MCP tool. Always mcp.*/
  type: "mcp";
  /** A label for this MCP server, used to identify it in tool calls. */
  server_label: string;
  /** The URL for the MCP server. */
  server_url: string;
  allowed_tools?: { tool_names: string[] };
  /** Optional HTTP headers to send to the MCP server. Use for authentication or other purposes.*/
  headers?: { [key: string]: string };
  require_approval?:
    | "always"
    | "never"
    | { always?: { tool_names?: string[] }; never?: { tool_names?: string[] } };
  server_description?: string;
};
```

MCP implementations that are already there:

- https://docs.anthropic.com/en/api/messages#body-mcp-servers
- https://platform.openai.com/docs/api-reference/responses/create#responses-create-tools

This means in order to add MCP support to LMPIFY, I could choose to do it for just the models that support it, rather than making my own tools to MCP adaptor. Another important question is: are generations always stored publicly, even if you use authenticated MCPs? This might be problematic.

It is assumable that there will be other aggregators that allow mcp execution for any provider. It is also assumable that more providers like groq and xai will follow with MCP as tool, and it's possible that openai will add mcp tools to /chat/completions.

However, I COULD also choose to implement the ability to pass MCP server(s) in a config, pass them as tools to the chat-completion endpoint, and execute them myself. This would need to be done for both /chat/completions as well as for the StreamDO.

Other scenarios that need work:

- Ability to configure MCP URL and perform OAuth from within UI where it stores auth on a per-url basis into localStorage. This requires making a POC first (possibly with dynamic client registration etc)
- Ability to configure MCP tools in /chat/completions with X-MCP-Authorization in header
- Ability to create a /chat/completions AND /mcp endpoint that uses an MCP as tools. The OAuth of it should perform 2 steps, gathering both the downstream MCP OAuth as well as the user itself

For now I decide to go for the simplest approach that directly allows for creating my agent without complex mappings, and use things just in Anthropic.

**[STEP 1]** Allow using Anthropic MCP functionality everywhere:

- Create `handleAnthropicAsChatCompletion` (maybe take from what I made before and add `tools[].type=mcp`)
- Create conversion from tools [type:mcp] property to the format of anthropic (https://docs.anthropic.com/en/api/messages#body-mcp-servers)
- Make sure `handleChatCompletions` uses the above for anthropic.
- Do not support any `require_approval` other than `never`
- Do not support for any provider that does not have `mcp:true`
- Use `handleChatCompletions` inside of the `StreamDO` to avoid code duplication.
- Do not support mcp tools icm with `store:true`

Now, I should be able to use an MCP server in the `/{id}/chat/completions` endpoint by passing mcp configs as tools. Test this first!

**[STEP 2]** MCP in Streamer

- Add `mcp_url` and `mcp_authorization` to POST FormData to allow a single MCP tool from there too.
- Ensure to properly handle MCP use responses in the StreamDO so it can be formatted into nice-looking markdown (using `>`)

**[STEP 3]** Deployment MCP

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
- The deployment API --> Tailproxy should also functions as MCPs and should be first made possible from letmeprompt.com

# Idea of simplification of the `text/event-stream`

Why don't I just make an endpoint `POST|GET /{id}/simple` that just returns a plain/markdown ReadableStream? This is much easier to use and stack, and could eventually replace the `text/event-stream` which should not be needed.

# Lay-out & UX

Massive improvements possible - https://x.com/kregenrek/status/1946152950872879590

It seems that the UI doesn't always properly handle errors. E.g. when claude is down sometimes, I'm getting just a blank screen, rather than a red error.

The model is always selected on whatever we had in localStorage, but it's better to set it to the configured value. Does it make sense to allow setting the model with frontmatter, overwriting whatever state is in lmpify? Would be cool!

E.g.

```
---
model: lmpify/flaredream
tools: https://deploy.flaredream.com/mcp
---
```

Frontmatter, if present, would always be removed from the prompt. It could also allow for tools this way (running it would first redirect to login if mcp isn't authenticated yet)

# Improved Usability & Benchmark For Workers

https://deploy.flaredream.com/https://uithub.com/janwilmake/xymake.profile didn't see route in `wrangler.toml`. Need perfect wrangler parsing!

In https://letmeprompt.com/httpspastebincon-ujmnhs0, `/api/stats` returns a 409 and doesn't log any error. Code seems fine. Let's try locally and see what's up.

Lot of generated things return errors. Tail worker often gets exception

Landingpage flaredream.com should retrieve all `featured:true` from benchmark and render them with 'view'

# With-money refactor

Check `withMoney` again and see what context would be needed to do a drop-in replacement with that from what i have now

Replace Stripeflare with X Money (more reliable for all users, allows to see who created something with nice X profile pic, etc)

https://github.com/janwilmake/with-money

To simplify, let's also just require login; ideally after filling first prompt (Should temporarily store prompt in cookie).

Ensure it doesn't logout quickly.

This would also allow getting an API KEY and more securely deposit lots of cash. To easily to build against LMPIFY with XYTEXT. also will allow closed-loop monetary system between creators and generations of these prompts, etc.

Then, `agent-architecture.drawio.png`

# Proper way to let REPO-OWNERS pay for generations, not users.

🤔 Ultimately I'd want to be able to set worker-name, repo-name, branch, and have these deployments happen automatically, instantly. For this to work, I require `Login with Cloudflare` and `Login with GitHub` to be a part of letmeprompt.com, and allow for generation-configs (name, repo, branch, worker-name). It's not clear to me yet if this should be a completely new app that uses letmeprompt.com? Maybe better; niched towards easy workers: flaredream!

The UI here is not nice: https://github.com/eastlondoner/vibe-tools

- it leads to use a bad model
- people may hit a ratelimit very quickly

What I'd want is a custom link that redirects to the cached response, e.g. https://contextjson.com/{owner}/{repo}/tree/{branch}/context/{id}. This should:

1. Check the `context.json` in the raw githubusercontent file
2. Generate uithub URL+prompt
3. With MY OWN API KEY (AND COST), call `POST https://letmeprompt.com/chat/completions` with preset model (if url/prompt didn't change, result should be cached). Also, result should include `X-Result-URL` header.
4. Redirect user to `X-Result-URL` where the result is being streamed to, paid for them.

After I have this, remove cheaper, smaller models; definitely discourage them. I can allow a budget of up to $5 free for anyone that puts a `context.json` file in their repo, but also should already have a way to see who's using it in a dashboard, and reach out to them easily.
