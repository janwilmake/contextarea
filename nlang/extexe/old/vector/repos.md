https://github.actionschema.com/codefromanywhere/upstash-vector/search?ext=ts

I have this package called 'upstash-vector' that can be imported using `import * as upstashVector from "upstash-vector";`

make me a wrapper sdk that uses all these endpoints specifically for:

- namespace: `repos`
- id: `{owner}/{repo}/{branch}` (lowercase only)
- vector data: Summary of the purpose of a repo
- metadata:

```ts
type ReposCode = {
  id: string;
  owner: string;
  repo: string;
  branch: string;

  // properties same as in github that we need
  archived: boolean;
  private: boolean;
  topics: string[] | null;
  homepage: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  pushed_at: string | null;
  default_branch: string;

  /**cloudflare location*/
  serverUrl?: string | null;
  // properties specific to irfc cloud

  /** Can be specified if the generated code should be exported into another repo. Will use `repo` as source, and `targetRepo` to put the results if exporerted.
   *
   * NB: The code will not live in `repos-code:targetRepo` but simply in repo, the export just won't push it there.  */
  exportTargetRepo?: string;

  /** paths at which content is located. NB: if the github file is x.html.md, only x.html will show up here*/
  codePaths: string[];
  deployStartedAt: number | null;
  /** If we can't use this repo, the error can be set here*/
  deployError?: string | null;
  deploySha: string | null;
  deployFinishedAt: number | null;
  deployWorkflow?: string[][] | null;
  deployUnprocessedPaths: string[] | null;
  deployDurationMs?: number | null;
  deployWorkflowResult?: any[] | null;
};
```

Don't include vector:number[] anywhere, as it is always converted from and to the data.

Please ensure the sdk is type safe and has all needed functionality.

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

Export the reuslting sdk as a simple `export const repos = {}` object with all functions in there.
