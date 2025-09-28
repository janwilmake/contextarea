this works well. let's make a simple demo html that:

- fetches /me and redirects to /authorize if it returns 401
- allows to fill basepath, api key, model (saved in local storage)
- fills user: result from me (id property)
- allows to fill mcp server urls
- allows to fill message
- streams back response and renders as markdown

it's called MCP IDP Completions. ensure to not forget 'reasoning_content', and 'refusal' in the delta

use style from https://assets.p0web.com
