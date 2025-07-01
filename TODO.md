<!-- head down focus on this -->

# Big improvements (FIRST)

Ensure variable `{{prompt_id}}` is filled into context if directly present in prompt. This is happening at execution, the variable stays variable.

Default chosen URL should be prettier. For one, we could filter out URLs first, looking for the first language part.

Codeblocks should outlink to {prompt_id}.gptideas.com/index/{index} or if available `/{path}`

# with-money refactor (Dependency)

Replace Stripeflare with X Money (more reliable for all users, allows to see who created something with nice X profile pic, etc)

https://github.com/janwilmake/with-money

To simplify, let's also just require login; ideally after filling first prompt (Should temporarily store prompt in cookie).

Ensure it doesn't logout quickly.

This would also allow getting an API KEY and more securely deposit lots of cash. To easily to build against LMPIFY with XYTEXT. also will allow closed-loop monetary system between creators and generations of these prompts, etc.

# Some more nice Quality of life improvements

## Render images

Just like html, images should be able to be shown as MD and as image. Sick! Now we can add any images into html using https://googllm-image.brubslabs.com. Just have a good system prompt for that

## Make links clickable

Links should still be shown as markdown but need to be clickable.

## Images as context, videos as context

HTML is terrible since it's too big. However as a screenshot it can be great for making websites. Let's nudge people when they used a HTML context to instead use it as image. When clicked, it prepends https://quickog.com/{url}, which screenshots it.

Any URL that's an image should be inserted as image context to the model. Now we can do some sick sick stuff!

Video urls should be inserted as video context to the model (if the model supports it)

Whenever context is an image, it should show the # of tokens and it should show the fact that it's an image in the context ui.

Worth a post!

# Variables

What if:

- If you prompt something with `{{var1}}` and `{{var2}}` it is required to be filled. This can be part of URLs too!
- https://letmeprompt.com/[id]?var1={{var1}}&var2={{var2}}&key=result&codeblock=0 is where you first get your result. Without variables, it should prompt to pass them.
- https://[id].gptideas.com is static results with routing.
- https://[id].chatcompletions.com/chat/completions would allow using the prompt + context as system prompt with additional variables in the headers in `variables:Object`. These would be required if they are present.

These are all GREAT primitives to allow making prompts more flexible
