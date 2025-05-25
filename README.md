# contextarea.js - textarea for context-building

## Usage

In your head, add the following

```html
<link rel="stylesheet" href="https://contextarea.com/style.css" />
<script src="https://contextarea.com/lib.js" defer></script>
```

To your textarea, add `id="contextarea"` and poof! It's all there.

> ![IMPORTANT]
> This is meant to be self-hosted. Please do not use this in production.

## Components

| Component                  | Description                                                  | URL                                           |     |
| -------------------------- | ------------------------------------------------------------ | --------------------------------------------- | --- |
| [pastebin](./pastebin)     | for OS-provided text or binary files (via copy or drag/drop) | https://pastebin.contextarea.com/openapi.json |     |
| [context](./context)       | for fetching/caching any URL into the belonging metadata     | https://context.contextarea.com/openapi.json  |     |
| [lib.js](lib.js)           | the js lib                                                   | https://contextarea.com/lib.js                |     |
| [style.css](style.css)     | the styles                                                   | https://contextarea.com/style.css             |     |
| [index.html](./index.html) |                                                              | https://contextarea.com                       |     |
