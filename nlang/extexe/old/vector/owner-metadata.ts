import * as upstashVector from "upstash-vector";

const NAMESPACE = "owner-metadata";

interface RepoInfo {
  repo: string;
  branch: string;
}

interface OwnerMetadata {
  repos: RepoInfo[];
  info: any;
}

interface OwnerItem {
  /** The lowercase GitHub username of the owner. */
  id: string;
  /** The similarity score of the vector. */
  score: number;
  /** The GitHub bio of the owner. */
  data?: string;
  /** The metadata containing information about the owner's repositories. */
  metadata?: OwnerMetadata;
}

export const ownerMetadata = {
  /**
   * Upserts (inserts or updates) an owner's metadata and GitHub bio.
   * @param owner - The GitHub username of the owner.
   * @param githubBio - The GitHub bio of the owner.
   * @param metadata - The metadata containing information about the owner's repositories.
   * @returns A promise that resolves when the upsert is complete.
   */
  upsert: async (
    owner: string,
    githubBio: string,
    metadata: OwnerMetadata,
  ): Promise<void> => {
    await upstashVector.upsertData(
      {
        id: owner.toLowerCase(),
        data: githubBio,
        metadata: metadata as any,
      },
      NAMESPACE,
    );
  },

  /**
   * Fetches an owner's metadata and GitHub bio.
   * @param owner - The GitHub username of the owner.
   * @returns A promise that resolves to the owner's data and metadata, or null if not found.
   */
  fetch: async (owner: string): Promise<Omit<OwnerItem, "score"> | null> => {
    const result = await upstashVector.fetchVectors(
      {
        ids: [owner.toLowerCase()],
        includeMetadata: true,
        includeData: true,
      },
      NAMESPACE,
    );

    const item = result.result[0];
    if (!item) return null;

    return {
      id: item.id,
      data: item.data,
      metadata: item.metadata as unknown as OwnerMetadata,
    };
  },

  /**
   * Updates an owner's metadata and/or GitHub bio.
   * @param owner - The GitHub username of the owner.
   * @param updates - The updates to apply. Can include new GitHub bio and/or metadata updates.
   * @returns A promise that resolves when the update is complete.
   */
  update: async (
    owner: string,
    updates: { githubBio?: string; metadata?: Partial<OwnerMetadata> },
  ): Promise<void> => {
    const updateData: upstashVector.UpdateVectorRequest = {
      id: owner.toLowerCase(),
    };

    if (updates.githubBio !== undefined) {
      updateData.data = updates.githubBio;
    }

    if (updates.metadata !== undefined) {
      updateData.metadata = updates.metadata;
      updateData.metadataUpdateMode = "PATCH";
    }

    await upstashVector.updateVector(updateData, NAMESPACE);
  },

  /**
   * Deletes an owner's metadata and GitHub bio.
   * @param owner - The GitHub username of the owner.
   * @returns A promise that resolves when the deletion is complete.
   */
  delete: async (owner: string): Promise<void> => {
    await upstashVector.deleteVectors(owner.toLowerCase(), NAMESPACE);
  },

  /**
   * Queries for owners with similar GitHub bios.
   * @param githubBio - The GitHub bio to use as a query.
   * @param topK - The number of similar owners to return.
   * @returns A promise that resolves to an array of similar owners' data and metadata.
   */
  query: async (githubBio: string, topK: number): Promise<OwnerItem[]> => {
    const result = await upstashVector.queryData({
      data: githubBio,
      topK,
      includeMetadata: true,
      includeData: true,
      namespace: NAMESPACE,
    });

    const items = result.map((item) => ({
      id: item.id,
      score: item.score,
      data: item.data,
      metadata: item.metadata as OwnerMetadata,
    }));
    return items;
  },

  /**
   * Lists all owners in the database.
   * @param limit - The maximum number of owners to return.
   * @returns A promise that resolves to an array of owners' data and metadata.
   */
  list: async (
    limit: number,
    cursor = "0",
  ): Promise<{ items: Omit<OwnerItem, "score">[]; nextCursor: string }> => {
    const result = await upstashVector.rangeVectors(NAMESPACE, {
      cursor,
      limit,
      includeMetadata: true,
      includeData: true,
    });

    return {
      nextCursor: result.nextCursor,
      items: result.vectors.map((item) => ({
        id: item.id,
        data: item.data,
        metadata: item.metadata as OwnerMetadata,
      })),
    };
  },
};
