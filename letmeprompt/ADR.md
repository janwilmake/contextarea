# Fixed annoying JSON parse bug

After asking LLM, it first came up with the wrong idea.

After googling, I found https://mathiasbynens.be/notes/etago which recommended a few escapes

After that i still got a json parse error, the abover is also very old

after telling that to claude, it came up with `safelyEmbedDataInScriptTag` which has just a single escape, which is great. Now the data can easily be parsed on the HTML side with `const data = JSON.parse(document.getElementById('server-data').textContent);`. I should probably always be using that.

# Security

added 'credentialless' to iframe so i don't think we need to worry about it ever executing functionality in lmpify draining someones balance. furthermore, the access-token itself was already not accessible as it's http only

# OpenAI `/chat/completions` spec

- https://github.com/openai/openai-openapi
- https://oapis.org/openapi/https%3A%2F%2Fapp.stainless.com%2Fapi%2Fspec%2Fdocumented%2Fopenai%2Fopenapi.documented.yml/createChatCompletion
- https://letmeprompt.com/rules-httpsuithu-ulcmkf0
- https://oapis.org/openapi/openai/createResponse has the stream types (the chat completions endpoint refers to it)
- https://letmeprompt.com/httpsoapisorgop-ewgxjq0 <-- these are reasoning traces
