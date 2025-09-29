import * as upstashVector from "upstash-vector";

// Helper function to build the vector ID
const buildVectorId = (secret: string) => `owner:${secret}`;

// Type for the owner metadata
interface OwnerMetadata {
  owner: string;
}

// Improved Item interface with better typed metadata
interface OwnerItem {
  /** The unique identifier of the vector, in the format "owner:{secret}". */
  id: string;
  /** The similarity score of the vector, indicating how closely it matches the query. */
  score: number;
  /** The vector representation of the owner's GitHub bio. Only included if includeVectors is true. */
  vector?: number[];
  /** Metadata associated with the vector, containing the owner's information. Only included if includeMetadata is true. */
  metadata?: OwnerMetadata;
  /** The raw text of the owner's GitHub bio. Only included if includeData is true. */
  data?: string;
}

export const owner = {
  /**
   * Upserts (inserts or updates) an owner's vector in the Upstash Vector database.
   * @param secret - The secret used to generate the unique vector ID.
   * @param githubBio - The GitHub bio of the owner, used as the vector data.
   * @param ownerName - The name of the owner, stored in the metadata.
   * @returns A promise that resolves when the upsert operation is successful.
   */
  upsertOwner: async (
    secret: string,
    githubBio: string,
    ownerName: string,
  ): Promise<void> => {
    const id = buildVectorId(secret);
    await upstashVector.upsertData(
      {
        id,
        data: githubBio,
        metadata: { owner: ownerName },
      },
      "owner",
    );
  },

  /**
   * Fetches an owner's vector from the Upstash Vector database.
   * @param secret - The secret used to generate the unique vector ID.
   * @returns A promise that resolves to the owner's vector data, or null if not found.
   */
  getOwner: async (secret: string): Promise<OwnerItem | null> => {
    const id = buildVectorId(secret);
    const result = await upstashVector.fetchVectors(
      {
        ids: [id],
        includeMetadata: true,
        includeVectors: true,
        includeData: true,
      },
      "owner",
    );
    return result.result[0] as OwnerItem | null;
  },

  /**
   * Updates an owner's vector in the Upstash Vector database.
   * @param secret - The secret used to generate the unique vector ID.
   * @param githubBio - The updated GitHub bio of the owner.
   * @param ownerName - The updated name of the owner.
   * @returns A promise that resolves when the update operation is successful.
   */
  updateOwner: async (
    secret: string,
    githubBio?: string,
    ownerName?: string,
  ): Promise<void> => {
    const id = buildVectorId(secret);
    const updateData: upstashVector.UpdateVectorRequest = { id };
    if (githubBio !== undefined) updateData.data = githubBio;
    if (ownerName !== undefined) updateData.metadata = { owner: ownerName };
    await upstashVector.updateVector(updateData, "owner");
  },

  /**
   * Deletes an owner's vector from the Upstash Vector database.
   * @param secret - The secret used to generate the unique vector ID.
   * @returns A promise that resolves when the delete operation is successful.
   */
  deleteOwner: async (secret: string): Promise<void> => {
    const id = buildVectorId(secret);
    await upstashVector.deleteVectors(id, "owner");
  },

  /**
   * Queries the Upstash Vector database for similar owners based on a GitHub bio.
   * @param githubBio - The GitHub bio to use as a query.
   * @param topK - The number of similar owners to return (default: 10).
   * @returns A promise that resolves to an array of similar owner items.
   */
  querySimilarOwners: async (
    githubBio: string,
    topK: number = 10,
  ): Promise<OwnerItem[]> => {
    const result = await upstashVector.queryData({
      data: githubBio,
      topK,
      includeMetadata: true,
      includeVectors: true,
      includeData: true,
      namespace: "owner",
    });
    return result as OwnerItem[];
  },

  /**
   * Lists all owners in the Upstash Vector database.
   * @param limit - The maximum number of owners to return (default: 100).
   * @returns A promise that resolves to an array of owner items.
   */
  listAllOwners: async (limit: number = 100): Promise<OwnerItem[]> => {
    const result = await upstashVector.rangeVectors("owner", {
      cursor: "0",
      limit,
      includeMetadata: true,
      includeVectors: true,
      includeData: true,
    });
    return result.vectors as OwnerItem[];
  },

  /**
   * Resets the entire "owner" namespace in the Upstash Vector database.
   * @returns A promise that resolves when the reset operation is successful.
   */
  resetOwnerNamespace: async (): Promise<void> => {
    await upstashVector.resetNamespace("owner");
  },
};
