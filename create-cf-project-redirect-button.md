Cloudflare has deeplinks! https://blog.cloudflare.com/deeplinks-and-scrollanchor/

General rule of thumb: Redirect to https://dash.cloudflare.com/?to=/:account/{URL} to navigate to any cloudflare dashboard page.

Here are some very useful examples:

- Create new git repo from template: https://dash.cloudflare.com/?to=/:account/workers-and-pages/create/deploy-to-workers&repository=https://github.com/janwilmake/freemyx

- Link existing repo to automatic Cloudflare deployment CI: https://dash.cloudflare.com/?to=/:account/workers-and-pages/create/workers/provider/github/janwilmake/onlybrowse/configure

- Manage the worker configuration: https://dash.cloudflare.com/?to=/:account/workers-and-pages/workers/services/view/onlybrowse/production/settings

- View deployments: https://dash.cloudflare.com/?to=/:account/workers/services/view/onlybrowse/production/deployments

The first one is what was used for the Cloudflare deploy button, probably a Celso initiative, copied from me and/or Vercel's ship button...

What I want is just a simpler integration between having a repo on github and having it deployed on Cloudflare.

- **lmpify's 'ship it' button** should automatically create a new repo if it wasn't your repo, create a pr to your repo otherwise
