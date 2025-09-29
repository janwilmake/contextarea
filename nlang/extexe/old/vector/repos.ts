import * as upstashVector from "upstash-vector";

export interface ReposCode {
  id: string;
  owner: string;
  repo: string;
  branch: string;
  archived: boolean;
  private: boolean;
  topics: string[] | null;
  homepage: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  pushed_at: string | null;
  default_branch: string;

  /** Can be specified if the generated code should be exported into another repo. Will use `repo` as source, and `targetRepo` to put the results if exporerted.
   *
   * NB: The code will not live in `repos-code:targetRepo` but simply in repo, the export just won't push it there.  */
  exportTargetRepo?: string;
  /**cloudflare location*/
  serverUrl?: string | null;

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
}

export interface QueryResultItem {
  /** Unique identifier for the repository in the format "{owner}/{repo}/{branch}" (lowercase). */
  id: string;
  /** Similarity score of the vector. */
  score: number;
  /** Metadata associated with the repository. */
  metadata?: ReposCode;
  /** Summary of the repository's purpose. */
  data?: string;
}

const NAMESPACE = "repos";

function createId(owner: string, repo: string, branch: string): string {
  return `${owner.toLowerCase()}/${repo.toLowerCase()}/${branch.toLowerCase()}`;
}

export const repos = {
  /**
   * Upserts (inserts or updates) repository data in the vector database.
   * @param repoData Repository data to upsert.
   * @returns A promise that resolves when the operation is complete.
   */
  async upsert(repoData: Omit<ReposCode, "id">): Promise<void> {
    const id = createId(repoData.owner, repoData.repo, repoData.branch);
    await upstashVector.upsertData(
      {
        id,
        data: repoData.description || "",
        metadata: { ...repoData, id },
      },
      NAMESPACE,
    );
  },

  /**
   * Retrieves repository data by its components.
   * @param owner Repository owner.
   * @param repo Repository name.
   * @param branch Repository branch.
   * @returns A promise that resolves to the repository data or null if not found.
   */
  async get(
    owner: string,
    repo: string,
    branch: string,
  ): Promise<ReposCode | null> {
    const id = createId(owner, repo, branch);
    const result = await upstashVector.fetchVectors(
      {
        ids: [id],
        includeMetadata: true,
        includeData: true,
      },
      NAMESPACE,
    );

    if (result.result[0]) {
      return result.result[0].metadata as unknown as ReposCode;
    }
    return null;
  },

  /**
   * Updates repository data in the vector database.
   * @param repoData Repository data to update.
   * @returns A promise that resolves when the operation is complete.
   */
  async update(
    repoData: Partial<ReposCode> & Pick<ReposCode, "owner" | "repo" | "branch">,
  ): Promise<void> {
    const id = createId(repoData.owner, repoData.repo, repoData.branch);
    await upstashVector.updateVector(
      {
        id,
        data: repoData.description || repoData.repo,
        metadata: repoData,
        metadataUpdateMode: "PATCH",
      },
      NAMESPACE,
    );
  },

  /**
   * Deletes repository data from the vector database.
   * @param owner Repository owner.
   * @param repo Repository name.
   * @param branch Repository branch.
   * @returns A promise that resolves when the operation is complete.
   */
  async delete(owner: string, repo: string, branch: string): Promise<void> {
    const id = createId(owner, repo, branch);
    await upstashVector.deleteVectors(id, NAMESPACE);
  },

  /**
   * Queries repositories based on a text description.
   * @param query Text query to search for similar repositories.
   * @param options Query options.
   * @returns A promise that resolves to an array of matching repository data.
   */
  async query(
    query: string,
    options?: { topK?: number; filter?: string },
  ): Promise<QueryResultItem[]> {
    const result = await upstashVector.queryData({
      data: query,
      topK: options?.topK || 10,
      includeMetadata: true,
      includeData: true,
      filter: options?.filter,
      namespace: NAMESPACE,
    });

    return result.map((item) => ({
      id: item.id,
      score: item.score,
      metadata: item.metadata as ReposCode,
      data: item.data,
    }));
  },

  /**
   * Lists all repositories in the database.
   * @param options Listing options.
   * @returns A promise that resolves to an array of repository data.
   */
  async list(options?: {
    limit?: number;
    cursor?: string;
  }): Promise<{ nextCursor: string; repos: ReposCode[] }> {
    const result = await upstashVector.rangeVectors(NAMESPACE, {
      cursor: options?.cursor || "0",
      limit: options?.limit || 100,
      includeMetadata: true,
      includeData: true,
    });

    return {
      nextCursor: result.nextCursor,
      repos: result.vectors.map((v) => v.metadata as ReposCode),
    };
  },

  /**
   * Resets all repository data in the database.
   * @returns A promise that resolves when the operation is complete.
   */
  async reset(): Promise<void> {
    await upstashVector.resetNamespace(NAMESPACE);
  },
};
