# Context Area - Fast, Smart Prompting for Devs

> [!TIP]
>
> **Looking for Sponsor**
> I'm looking for one or multiple sponsors that believe in context engineering and want me to build the best possible experience! Please [reach out on X](https://x.com/janwilmake)

## Goals

Create the best possible Cloud-Based Context Engineering Experience for Developers

- **Easy to Share** configurations and results with team
- Strong Focus on Ease of use and Accessibility
- Edit Flow > Iterative Messaging
- URL Expansion with realtime insights (tokens, mediatype)
- Prompt Check (for OG, but also for missing context)
- Full Result is URL, each codeblock is URL
- Painpoint: Prompting workflows are very private, sharing functionality sucks. Visibility is value. Help devs share and monetise their learnings.

## Non-goals

We are not aiming to match the UX non-technical folks need in any way.

- Chat history
- Inline previews
- Styles
- Integrations
- Uploads
- Tools

## LOGIN TO DB

Aggregate: https://contextarea.com/db/admin-readonly

- Username: admin
- Password: DB_SECRET

User DB: https://letmeprompt.com/db/user-{client_reference_id}

- Username: admin
- Password: access_token

# Why lmpify vs claude?

Examples:

https://x.com/janwilmake/status/1924762246074314974

I'd say if you wanna make this a real product, you gotta nail the answer to the question how is it better than going to claude.com very nice

I like this idea. my personal reason was i want to replace claude because it's annoying

- Very slow to start up and TTFT is terrible. lmpify hits within 100ms and doesn't need to wait for pageload to start seeing result, result is already starting in DO as soon as you submit.
- Claude doesn't support URLs out of the box. When i create a new app/worker, i usually add URLs as source of truth for context . with claude it was still a hassle to copy/paste afterwards. now, this is seamless and fast.
- Claude can render HTML and React. I don't use React so I don't care. I use HTML. Claude HTML renders are super limited, as they can't run scripts. LMPIFY HTML renders render scripts and anything else, and can be easily opened in fullscreen.
- Claude is generally slow, buggy, and unreliable on my machine. LMPIFY is snappy / fast
- It's hard to share something with someone else in claude, requires several clicks. LMPIFY is optimised for sharing
- LMPIFY incentivizes people to edit the prompt rather than reply, which usually gives better and less lengthy results as token windows become shorter from it. It also incentivizes people to reduce tokens. Claude does NOT do this

I think this is my main list.

Follow up posts (type them into markdown here, then just quote https://x.com/janwilmake/status/1924471476305932741) compare with claude on every aspect (6 posts).

- how can it be so fast?
- how does the monetisation and authentication work?
- how do I build my workers?
- why is edit workflow better than conversational?

# Table of Contents

- [connectconnector](connectconnector): simple landingpage for connectconnector.com
- [letmeprompt](letmeprompt): makes chat completions stateful, monetized with stripe, and adds nice frontend
- [letmeprompt.streamserve](letmeprompt.streamserve): way to quickly serve a UI streamed from a completion
- [mcp-completions](mcp-completions): chat completions proxy that adds authenticated mcp tools
- [mcp-completions-demo](mcp-completions-demo)

High Level Goals:

- Creating the best API for stateful chat completions
- Creating better ways of LLMs using tools
- Easy interface for chat completions standard
- MCP playground
- X Login -> user-owned results, user payouts.
- Easy way to create "agents" that have many MCPs (by default)
- Integration with OpenRouter to make it super generic
