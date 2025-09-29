https://github.actionschema.com/codefromanywhere/upstash-vector/search?ext=ts

I have this package called 'upstash-vector' that can be imported using `import * as upstashVector from "upstash-vector";`

make me a wrapper sdk that uses all these endpoints specifically for:

- namespace: `owner-metadata`
- id: `{owner}`
- vector data: Github Bio of the owner
- metadata: { repos: {repo:string, branch:string}[], info:any }

Please ensure the sdk is type safe and has all needed functionality.

Don't include vector:number[] anywhere, as it is always converted from and to the data.

Be sure to build up the id by its components, and the id is always made lowercase.

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

Export the reuslting sdk as a simple `export const ownerMetadata = {}` object with all functions in there.
