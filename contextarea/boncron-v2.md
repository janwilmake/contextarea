Imagine

- https://flaredream.com/janwilmake.md but filtered on time
- https://markdownfeed.com/janwilmake.md but filtered on time
- can do something like this, but automatically, every month: https://letmeprompt.com/httpshttpspastebi-qftbgz0

Primarily: Get SQLite access to all my personal data. Let the agent loose, Build a search engine ranked on emotive results, Build max-age prompt results.

Also:

- imagine if you could watch the top hackernews feed for specific items you care about. Same for X or the news generally

IDEA: boncron:

- URLs should be able to be paid for by the person that wants it freshened up
- Prompts should be able to contain urls with variables
- Prompts like this should have an easy way to be generated

# SPEC (Draft)

- https://boncron.com/create?...params would allow configuring a new ID with:
  - unique ID
  - which URL to proxy (with variables)
  - scoping which variable values to pay for (if no monetisation) and budget
  - what/how to charge (using xmoney provider) allowing downstream users to set budget (will be x price per day)
  - setting the triggers: `type Trigger = "cron" (proactive) | "max-age" (passive)`
- https://[id].boncron.com/{variable1}/{variable2} would present the fresh result, optionally charging or requiring downstream oauth provider login (client boncron.com).
- https://boncron.com/dashboard would show an overview of your boncrons with cost, earnings, and conversion (also in markdown)

NB: this would work with any URL, not just prompts, although those are definitely most valuable.

# ALTERNATIVE

Maybe Cloudflare is better since it allows much more freedom. This pretty much works as well. XMoney is an incredibly powerful primitive making this possible: https://letmeprompt.com/httpsdeployflare-3cyt690. Let's try this first; an entire app made in a single prompt (requires setting env bindings better (X authed admin panel on the worker?))
