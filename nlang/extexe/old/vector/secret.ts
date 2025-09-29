import * as upstashVector from "upstash-vector";

// Metadata type with better typing
interface SecretMetadata {
  /** GitHub access token */
  secret: string;
}

/**
 * Represents an item returned from vector queries.
 */
export interface SecretItem {
  /** The id of the vector, composed of the owner's name. */
  id: string;
  /** The similarity score of the vector. */
  score: number;
  /** The vector representation of the GitHub Bio. Only included if includeVectors is true. */
  vector?: number[];
  /** The metadata of the vector. Only included if includeMetadata is true. */
  metadata?: SecretMetadata;
  /** The GitHub Bio of the owner. Only included if includeData is true. */
  data?: string;
}

const NAMESPACE = "secret";

/**
 * Constructs the vector ID from the owner's name.
 * @param owner - The GitHub owner's name.
 * @returns The constructed vector ID.
 */
const constructId = (owner: string): string => `${owner}`;

export const secret = {
  /**
   * Upserts (inserts or updates) a vector for a GitHub owner.
   * @param owner - The GitHub owner's name.
   * @param bio - The GitHub Bio of the owner.
   * @param accessToken - The GitHub access token.
   * @returns A promise that resolves when the upsert is complete.
   */
  upsertOwner: async (
    owner: string,
    bio: string,
    accessToken: string,
  ): Promise<void> => {
    await upstashVector.upsertData(
      {
        id: constructId(owner),
        data: bio,
        metadata: { secret: accessToken },
      },
      NAMESPACE,
    );
  },

  /**
   * Fetches the vector data for a specific GitHub owner.
   * @param owner - The GitHub owner's name.
   * @returns A promise that resolves to the SecretItem or null if not found.
   */
  getOwner: async (owner: string): Promise<SecretItem | null> => {
    const result = await upstashVector.fetchVectors(
      {
        ids: [constructId(owner)],
        includeMetadata: true,
        includeVectors: true,
        includeData: true,
      },
      NAMESPACE,
    );

    return result.result[0]
      ? mapToSecretItem(result.result[0] as upstashVector.QueryResultItem)
      : null;
  },

  /**
   * Deletes the vector data for a specific GitHub owner.
   * @param owner - The GitHub owner's name.
   * @returns A promise that resolves to the number of deleted vectors (0 or 1).
   */
  deleteOwner: async (owner: string): Promise<number> => {
    return await upstashVector.deleteVectors(constructId(owner), NAMESPACE);
  },

  /**
   * Queries for similar GitHub owners based on their bio.
   * @param queryBio - The query bio to find similar owners.
   * @param topK - The number of results to return.
   * @returns A promise that resolves to an array of SecretItems.
   */
  querySimilarOwners: async (
    queryBio: string,
    topK: number,
  ): Promise<SecretItem[]> => {
    const result = await upstashVector.queryData({
      data: queryBio,
      topK,
      includeMetadata: true,
      includeVectors: true,
      includeData: true,
      namespace: NAMESPACE,
    });

    return result.map(mapToSecretItem);
  },

  /**
   * Updates the GitHub access token for a specific owner.
   * @param owner - The GitHub owner's name.
   * @param newAccessToken - The new GitHub access token.
   * @returns A promise that resolves when the update is complete.
   */
  updateAccessToken: async (
    owner: string,
    newAccessToken: string,
  ): Promise<void> => {
    await upstashVector.updateVector(
      {
        id: constructId(owner),
        metadata: { secret: newAccessToken },
        metadataUpdateMode: "PATCH",
      },
      NAMESPACE,
    );
  },
};

/**
 * Maps the raw upstash-vector result to a SecretItem.
 * @param item - The raw item from upstash-vector.
 * @returns A SecretItem with properly typed fields.
 */
function mapToSecretItem(item: upstashVector.QueryResultItem): SecretItem {
  return {
    id: item.id,
    score: item.score,
    vector: item.vector,
    metadata: item.metadata as SecretMetadata | undefined,
    data: item.data,
  };
}
