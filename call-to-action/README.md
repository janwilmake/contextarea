Apple made it notoriously hard to build your own Siri, except that they left one loophole open: the action button can be connected to a Shortcut, which can be set to call a contact.

This repo contains a way for you to create an AI contact that transcribes the recording and deletes it, then sends the transcript to your email, making this a fully GDPR proof solution.

To set this up, you need accounts at Cloudflare, Deepgram, and Twilio, and copy the [.env.example](.env.example) to [.env](.env), then fill the required secrets from the respective accounts. Also, be sure to deploy this worker on Cloudflare using [wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/).

# Challenges

- **Voice Entity Resolution** is a major challenge, and maybe Deepgram has better solutions for this these days that I'm unaware of. If we have better context we can properly transcribe names of repos, contacts, companies, etc. This'd be huge for voice. It must be possible as products like [Whispr Flow](https://wisprflow.ai) has succesfully solved this.

# TODO

TODO CONTEXTAREA

- Add functionality to add and verify phone number of user
- Allow for long-running MCP tools (in the same way as [this SEP](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1391)) - this makes this stateful though so may need to be done in a different place!
- Ability to hold running the API waiting for a human to authorize, then continue fulfilling the request after that's solved. Potentially, a parameter `onUserMessage:(details)=>Promise<void>` could be added, which would send the authorization request (just an url and message) to that endpoint, with the same secret. That function could then send email, w'app, or notify in UI. Anything.
- Subagent should return cost
- Add functionality to contextarea mcp to run a prompt at a recurring basis?

TODO CTA

- Add phone number login and subscription of $20/month. Use contextarea oauth (requires user to submit balance there too)
- Transcript gets submitted to the contextarea api with **contextarea MCP** enabled. Needed MCPs get found and subagent(s) get spawned doing tasks. The instructions last codeblock should contain structured data with all agents spawned and their success. The result should be stored and listed
- Ensure it can detect language instead of forcing English
- Dashboard shows all pending, recurring, and recently finished agents

<!-- having this allows me to create an OSS openclaw competitor -->
