https://github.actionschema.com/codefromanywhere/upstash-vector/search?ext=ts

I have this package called 'upstash-vector' that can be imported using `import * as upstashVector from "upstash-vector";`

make me a wrapper sdk that uses all these endpoints specifically for:

- namespace: `owner`
- id: `{secret}`
- vector data: Github Bio of the owner
- metadata: {/\*owner the access token belongs to \*/ owner: string}

Please ensure the sdk is type safe and has all needed functionality. Be sure to build up the id by its components.

Especially important to bring back this datastructure but with the metadata better typed and the doc-comments rewritten based on this implementation.

```ts
interface Item {
  /** The id of the vector. */
  id: string;
  /** The similarity score of the vector. */
  score: number;
  /** The vector value. Only included if includeVectors is true. */
  vector?: number[];
  /** The metadata of the vector, if any. Only included if includeMetadata is true. */
  metadata?: Record<string, unknown>;
  /** The unstructured data of the vector, if any. Only included if includeData is true. */
  data?: string;
}
```

export the reuslting sdk as a simple `export const owner = {}` object with all functions in there
