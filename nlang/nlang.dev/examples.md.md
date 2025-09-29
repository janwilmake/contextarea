Context: https://api.nlang.dev/openapi.json

Please consider the openapi, and come up with several simple examples of how stacked nlang files are named, what is their content, and what would be the output.

Make at least these examples:

- index.html.md describes a html page to be generated
- animals.json.md describes a datastructure of animals to be generated
- endpoint.ts.md describes a typescript endpoint in cloudflare
- cats.url.md describes a proxy that fetches cats from the cat api. it becomes a .url file that proxies the request to the url
- animal/[animal].json.md takes the animal from animals.json if available. its dynamic route allows any animal
