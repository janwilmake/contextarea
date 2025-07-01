llms.txt is a guided navigation at the root of any domain. The key is that we should be able to find it at the root of the domain, and thus, the domain itself is sufficient to use llms.txt as a base notation. However, maybe this is not that useful.

What are interesting and powerful prompts that could help refining context? Can I somehow put them in a simple URL convention?

1. **file hierarchy filter**: filter on `llms.txt` itself to get a subset of links based on a prompt
2. **prompt each file**: run a given prompt for each file, then do something with the output

The first one is easy, it's just a prompt that outputs a new URL

What if you could run a prompt for each URL found at a given URL? What if we use a different protocol for this? What if you could just do this in a prompt in LMPIFY?

```md
https://flaredream.com/janwilmake

foreach://markdownfeed.com/janwilmake/following

based on the feed shown, is there any overlap in work and interests between the work from janwilmake and the things the person seems interested in?
```

This would be super powerful as it would do a prompt for each follower and it's super easy to understand that. If we have foreach twice, it could run every possible combination, potentially. We could then show the output like this:

````md
```md for="https://markdownfeed.com/flowisgreat"
He really loves cursor rules and it may be similar enough to the `user-agent-router` project of janwilmake
```

```md for="https://markdownfeed.com/carol"
She really loves iOS and it may be similar enough to the `screenless` project of janwilmake
```

...etc
````

This is basically a way of looping over prompts with the context being the only variable without any programming knowledge, just a simple 'trick'.

Other 'context protocols' I should consider:

- `foreach://{url}` will run a prompt many times and aggregate the results as they come back in the order of the urls found
- `expand://{url}` could expand every URL found at the url (going 1 level deeper)
- `goto://{url}` in the result could redirect the result to this url as the final answer. this url could also be a subset of the output itself, e.g. a link to a codeblock! In the browser for humans this could do an actual redirect. this means just a single goto url would be possible, although the output could technically also continue.

Expand and foreach are in the input prompt and therefore unlikely to be unsafe. It'd also be great to think in terms of nlang again. with nlang I had ideas about defining doing cronjobs as well, and every file had a name/path which determined output location as well.

For-each implementation: https://letmeprompt.com/httpspastebincon-1nej5v0

Seeing this now, i notice it's also interesting to try and figure it out the other way around as in, providing a file to a URL and post it there, e.g. referring to a codeblock. however, i don't know if that's feasible. the foreach protocol is quite elegant!
