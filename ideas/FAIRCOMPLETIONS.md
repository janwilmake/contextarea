# Analytics & revshare idea (May 23, 2025)

See also `faircompletions`

🛑 talk with what OSS repo-owners want. make profit, or pay for larger free tier (and make profit elsewhere)? https://x.com/janwilmake/status/1926518646785917107

IDEA: to enable Rev-sharing with repo owners, X users, and knowledge-base builders

https://github.com/iannuttall/mcp-boilerplate/pull/8 <-- boilerplate owners should be able to earn money with it

I need to make them easily understand they can with this! One step to still do though, is to track the original location from where the payment was initiated, and which contexts were used for this... We can group these contexts on a per-owner basis, then get an overview on how much was added for each.

If this works out, it becomes easy way for viral github users to make money. Besides, it'd be a great idea anyway to track visitors on a per-github-owner-level.

Every day, let's go over these: https://www.lmpify.com/httpspopularforg-7mck8v0 and see if there are tweets I can mirror.

What about idea-guys? Can I search X with filter on this? Should make a monetised socialdata.tools search monitor cronjob and have these things made public.

Another one is the people that create the contexts and share them. It doesn't always need to be their context. What if the original creator of the prompt gets made public too? We can simply use the `client_reference_id` for this and expose it (also makes it possible to pay others).

Measure actions:

- Pageview
- Prompt or other action from page (spending money)
- New balance upgrade

Measure them with owners:

- `?ref`
- the prompt-page itself
- the creator of the prompt
- the creator of previous version(s) of the prompt
- the creators of the context (github accounts, x accounts linked)

Revshare with the creators is super epic. Can be done directly to client_reference_ids for users and to claimable accounts (x/github) in another table. can't believe this worked: https://github.com/janwilmake/stripeflare-p2p-demo

- **Edit history**; either by storing a single previous link, all previous links in array, only all previous metadata, or all previous contents. Sidebar to scroll through the edit history.

- **Add models and other mediatypes**: Add Gemini 2.5 Pro w/ video upload - https://x.com/tryingET/status/1924810864260960271. Add image urls as images for claude/chatgpt. Also grok would be nice. Also, let's use some cerebras models.
