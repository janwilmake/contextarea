# Let Me Prompt It For You - Fast, Smart Prompting for Devs

Launch:

- https://x.com/janwilmake/status/1924471476305932741
- https://news.ycombinator.com/item?id=44030556
- https://www.producthunt.com/posts/let-me-prompt-it-for-you-lmpify-com

# Requirements / Goals

- Viral LLM Product
- Strong Focus on Ease of use and Accessibility
- Edit Flow > Iterative Messaging
- URL Expansion with realtime insights (tokens, mediatype)
- Context landing page
- High Quality OG images
- Prompt Check (for OG, but also for missing context)
- Full Result is URL, each codeblock is URL
- Painpoint: Prompting workflows are very private, sharing functionality sucks. Visibility is value. Help devs share and monetise their learnings.

# Non-goals

- Chat history
- Inline previews
- Styles
- Integrations
- Uploads
- Tools

# LOGIN TO DB

Aggregate: https://letmeprompt.com/db/admin-readonly

- Username: admin
- Password: DB_SECRET

User DB: https://letmeprompt.com/db/user-{client_reference_id}

- Username: admin
- Password: access_token

# Why lmpify vs claude?

I'd say if you wanna make this a real product, you gotta nail the answer to the question how is it better than going to claude.com very nice

I like this idea. my personal reason was i want to replace claude because it's annoying

- Very slow to start up and TTFT is terrible. lmpify hits within 100ms and doesn't need to wait for pageload to start seeing result, result is already starting in DO as soon as you submit.
- Claude doesn't support URLs out of the box. When i create a new app/worker, i usually add URLs as source of truth for context . with claude it was still a hassle to copy/paste afterwards. now, this is seamless and fast.
- Claude can render HTML and React. I don't use React so I don't care. I use HTML. Claude HTML renders are super limited, as they can't run scripts. LMPIFY HTML renders render scripts and anything else, and can be easily opened in fullscreen.
- Claude is generally slow, buggy, and unreliable on my machine. LMPIFY is snappy / fast
- It's hard to share something with someone else in claude, requires several clicks. LMPIFY is optimised for sharing
- LMPIFY incentivizes people to edit the prompt rather than reply, which usually gives better and less lengthy results as token windows become shorter from it. It also incentivizes people to reduce tokens. Claude does NOT do this

I think this is my main list

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
