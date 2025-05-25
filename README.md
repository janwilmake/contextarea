# contextarea.js - textarea for context-building

## Usage

In your head, add the following

```html
<link rel="stylesheet" href="https://contextarea.com/style.css" />
<script src="https://contextarea.com/lib.js" defer></script>
```

To your textarea, add `id="contextarea"` and poof! It's all there.

## Requirements

| Component              | Description                                                                                               | URL                                        |     |
| ---------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------ | --- |
| [pastebin](./pastebin) | for OS-provided text or binary files (via copy or drag/drop)                                              | https://pastebin.contextarea.com/worker.js |     |
| [context](./context)   | for fetching/caching any URL (or string with urls) into the belonging metadata to build up a beautiful UI | https://context.contextarea.com/worker.js  |     |
| [root](.)              | for js library to enhance any textarea with the above, easily embeddable                                  | https://contextarea.com/lib.js             |     |
| [demo](./demo)         | that brings it all together in a standalone html                                                          | https://demo.contextarea.com               |     |
