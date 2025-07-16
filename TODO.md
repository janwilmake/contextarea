# Priority lmpify:

- `/chat/completions` as main interface <-- do first
- Then add x.stripeflare.com oauth
- customizable `/chat/completions` endpoint with system prompt
- add mcp tools capability (requires passing through auth too)
- after that, focus on a `/chat/completions` endpoint (and MCP server) for making cloudflare apps

Then, `agent-architecture.drawio.png`

# Lay-out

- Instead of contextarea, i want monaco in the left one, with intellisense on URLs, autocomplete when writing new urls, and squiggly lines appearing dynamically to make suggestions, while editing.

Nailing this interface is key!!!

# CRITICAL

- Turn letmeprompt into oauth-provided `/chat/completion` endpoint with models (chance to not niche down too much and build flaredream chat with little complexity!)
- Turn `{subdomain}.letmeprompt.com/chat/completions` into the same thing, but with predetermined system prompt that is someone elses prompt. Results would not show the systemprompt, and would only be available with that model, but would still get their own new subdomain.

Ultimately I'd want to be able to set worker-name, repo-name, branch, and have these deployments happen automatically, instantly. For this to work, I require `Login with Cloudflare` and `Login with GitHub` to be a part of letmeprompt.com, and allow for generation-configs (name, repo, branch, worker-name). It's not clear to me yet if this should be a completely new app that uses letmeprompt.com? Maybe better; niched towards easy workers: flaredream!

# Improved Usability & Benchmark For Workers

https://deploy.flaredream.com/https://uithub.com/janwilmake/xymake.profile didn't see route in `wrangler.toml`. Need perfect wrangler parsing!

In https://letmeprompt.com/httpspastebincon-ujmnhs0, `/api/stats` returns a 409 and doesn't log any error. Code seems fine. Let's try locally and see what's up.

Lot of generated things return errors. Tail worker often gets exception

Landingpage flaredream.com should retrieve all `featured:true` from benchmark and render them with 'view'

# With-money refactor (Dependency)

Replace Stripeflare with X Money (more reliable for all users, allows to see who created something with nice X profile pic, etc)

https://github.com/janwilmake/with-money

To simplify, let's also just require login; ideally after filling first prompt (Should temporarily store prompt in cookie).

Ensure it doesn't logout quickly.

This would also allow getting an API KEY and more securely deposit lots of cash. To easily to build against LMPIFY with XYTEXT. also will allow closed-loop monetary system between creators and generations of these prompts, etc.

# `/chat/completions`

Every `context` can automatically be cached as a system prompt intelligently when needed reducing cost significantly. It would keep an up-to-date cached context available for a url, and people would be able to build products for this easily.

Ultimately, get back to https://x.com/EastlondonDev/status/1925191566362030380 about it

Generally its a good idea to allow for programmatic access and give people an API for this!!!!!!!! Imagine if people could earn money by easily creating new stripeflare workers that allow access to this API? You could set any price and it'd be super easy to setup via a lmpify.

TODO:

1. Every url can be a basePath for the OpenAI SDK (as long as POST `*/chat/completions` is given, proxy with system prompt being set to context + prompt). Model value should follow the same allowed values as what I have now. Can still use all other values.

2. In the UI, show 'Use Context' in footer which shows how to use the API.

After this is there, a CLI like `npm i -g lmpify` and then `lmpify` to login and then `lmpify {url|path(|hash?)}` to change context and then `lmpify {message}` to chat and stream back response. This'd be epic.

Ultimately, also get back to https://x.com/EastlondonDev/status/1925191566362030380 about it

- give access_token
- simple api with ?query&parameters that streams as well
- /chat/completions api
- /responses api (openai new standard)

# OG

✅ Model logo should be big in the OG.

- ✅ Title (Generated)
- ✅ Subtitle: '[logo] GROK 4 Generation by Jan Wilmake [pfp]'

TODO: after X login works, add profile picture of creator. Maybe: add logo

# Error handling

It seems that the UI doesn't always properly handle errors. E.g. when claude is down sometimes, I'm getting just a blank screen, rather than a red error.

# Proper way to let REPO-OWNERS pay for generations, not users.

The UI here is not nice: https://github.com/eastlondoner/vibe-tools

- it leads to use a bad model
- people may hit a ratelimit very quickly

What I'd want is a custom link that redirects to the cached response, e.g. https://contextjson.com/{owner}/{repo}/tree/{branch}/context/{id}. This should:

1. Check the `context.json` in the raw githubusercontent file
2. Generate uithub URL+prompt
3. With MY OWN API KEY (AND COST), call `POST https://letmeprompt.com/chat/completions` with preset model (if url/prompt didn't change, result should be cached). Also, result should include `X-Result-URL` header.
4. Redirect user to `X-Result-URL` where the result is being streamed to, paid for them.

After I have this, remove cheaper, smaller models; definitely discourage them. I can allow a budget of up to $5 free for anyone that puts a `context.json` file in their repo, but also should already have a way to see who's using it in a dashboard, and reach out to them easily.
