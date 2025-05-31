Cloudflare has deeplinks! https://blog.cloudflare.com/deeplinks-and-scrollanchor/

General rule of thumb: Redirect to https://dash.cloudflare.com/?to=/:account/{URL} to navigate to any cloudflare dashboard page.

Here are some very useful ones:

Create new git repo from template:
https://dash.cloudflare.com/?to=/:account/workers-and-pages/create/deploy-to-workers&repository=https://github.com/janwilmake/freemyx

Link existing repo to automatic cloudflare deployment CI:
https://dash.cloudflare.com/?to=/:account/workers-and-pages/create/workers/provider/github/janwilmake/onlybrowse/configure

Manage the worker configuration:
https://dash.cloudflare.com/?to=/:account/workers-and-pages/workers/services/view/onlybrowse/production/settings
