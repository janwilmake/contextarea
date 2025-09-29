import * as upstashVector from "upstash-vector";

type Route = {
  path: string;
  params: { [key: string]: string };
  type: "openapi" | "prompt" | "code" | "openapi-html";
};

/**
 * Metadata structure for repos_code vectors
 */
export interface ReposCodeMetadata {
  id: string;
  owner: string;
  repo: string;
  branch: string;
  path: string;
  promptPath: string | null;

  /** The extension of the file */
  ext: string;
  /** Key-value pairs needed in the code (only for backend code) */
  env?: { [key: string]: string };
  /** The actual source code (not needed for assets) */
  code?: string;
  /** piece of typescript for second-order generations*/
  script?: string;
  errors?: any[];
  /** Summary of the file's purpose */
  summary: string;
  /** The requirements of the code in natural language */
  prompt: string;
  source: "prompt" | "code";

  /** The OpenAPI Document JSON (only for backend code) */
  openapi?: object;
  /** Indicates if the sourcecode is private */
  private: boolean;
  /** Unix timestamp of creation */
  createdAt: number;
  /** Unix timestamp of last update */
  updatedAt: number;

  /** URL to an asset  */
  url?: string;

  fileDependencies?: Route[];

  /** Allow for continuous deployment of this script, e.g. every hour, every day, or every week. */
  cron?: string;
  /** should follow from cron*/
  cronMessageId?: string;

  /** API Dependencies of this code */
  apiDependencies?: { openapiUrl: string; operationId: string }[];
}

/**
 * Represents a single item in the query results
 */
export interface ReposCodeItem {
  /** The id of the vector */
  id: string;
  /** The similarity score of the vector */
  score: number;
  /** The metadata of the vector */
  metadata: ReposCodeMetadata;
  /** The summary of the file's purpose */
  data: string;
}

/**
 * Builds the vector ID from its components
 */
function buildId(
  owner: string,
  repo: string,
  branch: string,
  path: string,
): string {
  return `${owner.toLowerCase()}/${repo.toLowerCase()}/${branch.toLowerCase()}${path}`;
}

export const reposCode = {
  /**
   * Upserts a vector in the repos_code namespace
   * @param metadata - The metadata for the vector
   * @returns A promise that resolves when the upsert is complete
   */
  async upsert(
    metadata: ReposCodeMetadata,
  ): Promise<{ status: number; message?: string }> {
    const { summary } = metadata;
    const data = summary || metadata.path;
    if (!data) {
      return { status: 500, message: "No data given" };
    }
    const result = await upstashVector.upsertData(
      {
        id: buildId(
          metadata.owner,
          metadata.repo,
          metadata.branch,
          metadata.path,
        ),
        data,
        metadata,
      },
      "repos_code",
    );
    return result;
  },

  /**
   * Queries vectors in the repos_code namespace
   * @param query - The query string
   * @param topK - The number of results to return
   * @returns A promise that resolves to an array of ReposCodeItem
   */
  async query(
    query: string,
    topK: number,
    filter?: string,
  ): Promise<ReposCodeItem[]> {
    const result = await upstashVector.queryData({
      data: query,
      topK,
      includeMetadata: true,
      includeData: true,
      namespace: "repos_code",
      filter,
    });

    return result.map((item) => ({
      id: item.id,
      score: item.score,
      metadata: item.metadata as ReposCodeMetadata,
      data: item.data!,
    }));
  },

  /**
   * Fetches vectors by their IDs from the repos_code namespace
   * @param ids - An array of vector IDs to fetch
   * @returns A promise that resolves to an array of ReposCodeItem
   */
  async fetch(ids: string[]): Promise<(ReposCodeItem | undefined)[]> {
    const result = await upstashVector.fetchVectors(
      {
        ids,
        includeMetadata: true,
        includeData: true,
      },
      "repos_code",
    );

    return result.result
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .map((item) => ({
        id: item.id,
        score: item.score ?? 0,
        metadata: item.metadata as unknown as ReposCodeMetadata,
        data: item.data!,
      }));
  },

  /**
   * Updates a vector in the repos_code namespace
   * @param metadata - The updated metadata for the vector
   * @returns A promise that resolves when the update is complete
   */
  async update(
    metadata: Partial<ReposCodeMetadata> &
      Pick<ReposCodeMetadata, "id" | "owner" | "repo" | "branch" | "path">,
  ): Promise<upstashVector.UpdateVectorResponse> {
    const { summary, ...rest } = metadata;
    const result = await upstashVector.updateVector(
      {
        id: buildId(
          metadata.owner,
          metadata.repo,
          metadata.branch,
          metadata.path,
        ),
        data: summary,
        metadata: rest,
        metadataUpdateMode: "PATCH",
      },
      "repos_code",
    );

    return result;
  },

  /**
   * Deletes vectors by their IDs from the repos_code namespace
   * @param ids - An array of vector IDs to delete
   * @returns A promise that resolves to the number of deleted vectors
   */
  async delete(ids: string[]): Promise<number> {
    return upstashVector.deleteVectors(ids, "repos_code");
  },

  /**
   * Gets all paths for a specific repository
   * @param owner - The owner of the repository
   * @param repo - The name of the repository
   * @returns A promise that resolves to an array of paths
   */
  async getPathsForRepo(owner: string, repo: string): Promise<string[]> {
    const paths: string[] = [];
    let cursor = "0";

    while (true) {
      const result = await upstashVector.rangeVectors("repos_code", {
        cursor,
        limit: 100,
        includeMetadata: true,
      });

      for (const vector of result.vectors) {
        const metadata = vector.metadata as ReposCodeMetadata;
        if (
          metadata.owner.toLowerCase() === owner.toLowerCase() &&
          metadata.repo.toLowerCase() === repo.toLowerCase()
        ) {
          paths.push(metadata.path);
        }
      }

      if (result.nextCursor === "0") break;
      cursor = result.nextCursor;
    }

    return paths;
  },
};
