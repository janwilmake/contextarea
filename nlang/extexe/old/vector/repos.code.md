https://github.actionschema.com/codefromanywhere/upstash-vector/search?ext=ts

I have this package called 'upstash-vector' that can be imported using `import * as upstashVector from "upstash-vector";`

make me a wrapper sdk that uses all these endpoints specifically for:

- namespace: `repos_code`
- id: `{owner}/{repo}/{branch}{path}` (owner, repo, and branch must be lowercase)
- vector data: Summary of the purpose of a file
- metadata:

```ts
type Route = {
  path: string;
  params: { [key: string]: string };
  type: "openapi" | "prompt" | "code";
};
type ReposCode = {
  id: string;
  owner: string;
  repo: string;
  branch: string;
  /** always the code path*/
  path: string;
  promptPath: string | null;

  /** the extension of the file*/
  ext: string;
  /** key-value pairs needed in the code (only for backend code) */
  env?: Dict;
  /** The actual source code (not needed for assets) */
  code?: string;
  /** piece of typescript for second-order generations*/
  script?: string;
  /** summary */
  summary: string;
  /** The requirements of the code in natural language */
  prompt: string;

  source: "prompt" | "code";

  /** The OpenAPI Document JSON (only for backend code) */
  openapi?: object;
  /** sourcecode is made private if true */
  private: boolean;
  /** Unix timestamp*/
  createdAt: number;
  /** unix timestamp*/
  updatedAt: number;

  /** URL to an asset */
  url?: string;

  fileDependencies?: Route[];

  /** Allow for continuous deployment of this script, e.g. every hour, every day, or every week. */
  cron?: string;
  /** should follow from cron*/
  cronMessageId?: string;
  errors?: any[];
  /** API Dependencies of this code */
  apiDependencies?: { openapiUrl: string; operationId: string }[];
};
```

Don't include vector:number[] anywhere, as it is always converted from and to the data.

Include a function getPathsForRepo(owner,repo) that finds the paths (deconstructed via id) via range.

Please ensure the sdk is type safe and has all needed functionality.

Be sure to build up the id by its components.

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

Export the reuslting sdk as a simple `export const reposCode = {}` object with all functions in there
