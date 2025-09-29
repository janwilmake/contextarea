import * as upstashVector from "upstash-vector";

/**
 * Metadata structure for domain vectors
 */
export type DomainMetadata = {
  owner: string;
  repo: string;
  branch: string;
};

/**
 * Represents a domain item returned from vector operations
 */
export interface DomainItem {
  /** The hostname of the domain */
  id: string;
  /** The similarity score of the vector (only applicable in query results) */
  score?: number;
  /** The summary of the purpose of the repo */
  data?: string;
  /** Metadata associated with the domain */
  metadata?: DomainMetadata;
}

const NAMESPACE = "domains";

/**
 * SDK for managing domain vectors in Upstash Vector
 */
export const domains = {
  /**
   * Upserts (inserts or updates) a domain vector
   * @param hostname - The hostname of the domain
   * @param summary - Summary of the purpose of the repo
   * @param metadata - Metadata associated with the domain
   * @returns A promise that resolves when the upsert is complete
   */
  upsert: async (
    hostname: string,
    summary: string,
    metadata: DomainMetadata,
  ): Promise<void> => {
    await upstashVector.upsertData(
      {
        id: hostname,
        data: summary,
        metadata,
      },
      NAMESPACE,
    );
  },

  /**
   * Fetches a domain vector by hostname
   * @param hostname - The hostname of the domain to fetch
   * @returns A promise that resolves to the domain item or null if not found
   */
  fetch: async (hostname: string): Promise<DomainItem | null> => {
    const result = await upstashVector.fetchVectors(
      {
        ids: [hostname],
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
      metadata: item.metadata as DomainMetadata,
    };
  },

  /**
   * Queries for similar domains based on a summary
   * @param summary - The summary to query against
   * @param topK - The number of results to return (default: 10)
   * @returns A promise that resolves to an array of domain items
   */
  query: async (summary: string, topK: number = 10): Promise<DomainItem[]> => {
    const result = await upstashVector.queryData({
      data: summary,
      topK,
      includeMetadata: true,
      includeData: true,
      namespace: NAMESPACE,
    });

    return result.map((item) => ({
      id: item.id,
      score: item.score,
      data: item.data,
      metadata: item.metadata as DomainMetadata,
    }));
  },

  /**
   * Deletes a domain vector
   * @param hostname - The hostname of the domain to delete
   * @returns A promise that resolves to the number of deleted vectors (0 or 1)
   */
  delete: async (hostname: string): Promise<number> => {
    return await upstashVector.deleteVectors(hostname, NAMESPACE);
  },

  /**
   * Updates the metadata of a domain vector
   * @param hostname - The hostname of the domain to update
   * @param metadata - The new metadata to set
   * @returns A promise that resolves when the update is complete
   */
  updateMetadata: async (
    hostname: string,
    metadata: Partial<DomainMetadata>,
  ): Promise<void> => {
    await upstashVector.updateVector(
      {
        id: hostname,
        metadata,
        metadataUpdateMode: "PATCH",
      },
      NAMESPACE,
    );
  },

  /**
   * Lists all domains in the database
   * @param limit - The maximum number of results to return per page
   * @returns An async generator that yields domain items
   */
  list: async function* (
    limit: number = 100,
  ): AsyncGenerator<DomainItem, void, undefined> {
    let cursor = "0";
    while (true) {
      const response = await upstashVector.rangeVectors(NAMESPACE, {
        cursor,
        limit,
        includeMetadata: true,
        includeData: true,
      });

      for (const vector of response.vectors) {
        yield {
          id: vector.id,
          data: vector.data,
          metadata: vector.metadata as DomainMetadata,
        };
      }

      if (response.nextCursor === "0") break;
      cursor = response.nextCursor;
    }
  },

  /**
   * Resets the domains namespace, deleting all vectors
   * @returns A promise that resolves when the reset is complete
   */
  reset: async (): Promise<void> => {
    await upstashVector.resetNamespace(NAMESPACE);
  },
};
