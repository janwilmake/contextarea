# July 1 - 2025

First version

# Low hanging fruit (July 3, 2025)

- ✅ Convention to make files from URLs: Codeblocks whose content is just a URL (without further newlines) can be assumed to require to be fetched (without auth).
- ✅ Add link to "download" https://download.flaredream.com/{id}
- ✅ Add link to "patch": patch.forgithub.com/prepare?markdown=https://{id}.letmeprompt.com/result
- ✅ Add link to "upload": https://upload.flaredream.com/https://download.flaredream.com/{id}.json (should give JSON with JWT)
- ✅ Fix upload problems that may arise like 429.
- ✅ Connect upload link to worker upload where it'd just use a default `wrangler.json` with assets jwt.

# Fixed broken HTML injection

- ✅ Created improved codeblock parser to know whether or not the last codeblock `isIncomplete:true`
- ✅ Differentiate between complete HTML (renders with regular injection) and incomplete HTML (renders with wrapper html and incompelte html in sidebar)
- ✅ Fixed problems with iframe:
  - added `<base>` to let it know what the base URL is
  - replace all `<a href>` adding `target="_parent"`

This works wonders. It now allows navigating to both incomplete and complete HTML files, without EVER breaking the sidebar.
