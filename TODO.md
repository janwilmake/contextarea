# With-money refactor (Dependency)

Replace Stripeflare with X Money (more reliable for all users, allows to see who created something with nice X profile pic, etc)

https://github.com/janwilmake/with-money

To simplify, let's also just require login; ideally after filling first prompt (Should temporarily store prompt in cookie).

Ensure it doesn't logout quickly.

This would also allow getting an API KEY and more securely deposit lots of cash. To easily to build against LMPIFY with XYTEXT. also will allow closed-loop monetary system between creators and generations of these prompts, etc.

# CRITICAL

- **Charge broken** - Just log it and see what's up, fix on stripeflare. Might even be DORM problem. MESSY!
- Turn letmeprompt into oauth-provided `/chat/completion` endpoint with models (chance to not niche down too much and build flaredream chat with little complexity!)
- Turn `{subdomain}.letmeprompt.com/chat/completions` into the same thing, but with predetermined system prompt that is someone elses prompt. Results would not show the systemprompt, and would only be available with that model, but would still get their own new subdomain.

Ultimately I'd want to be able to set worker-name, repo-name, branch, and have these deployments happen automatically, instantly. For this to work, I require `Login with Cloudflare` and `Login with GitHub` to be a part of letmeprompt.com, and allow for generation-configs (name, repo, branch, worker-name). It's not clear to me yet if this should be a completely new app that uses letmeprompt.com? Maybe better; niched towards easy workers: flaredream!

# Lay-out

- both sides (prompt & result) must have sticky headers and bottoms of equal size and style (mirroring each other)
- instead of contextarea, i want monaco in the left one, with intellisense on URLs, autocomplete when writing new urls, and squiggly lines appearing dynamically to make suggestions, while editing.

Nailing this interface is key!!!

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
