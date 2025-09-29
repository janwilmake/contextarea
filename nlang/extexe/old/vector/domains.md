https://github.actionschema.com/codefromanywhere/upstash-vector/search?ext=ts

I have this package called 'upstash-vector' that can be imported using `import * as upstashVector from "upstash-vector";`

make me a wrapper sdk that uses all these endpoints specifically for:

- namespace: `domains`
- id: `{hostname}`
- vector data: Summary of the purpose of a repo
- metadata:

```ts
type DomainMetadata = {
  owner: string;
  repo: string;
  branch: string;
};
```

Don't include vector:number[] anywhere, as it is always converted from and to the data.

Please ensure the sdk is type safe and has all needed functionality.

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

Export the reuslting sdk as a simple `export const domains = {}` object with all functions in there.
