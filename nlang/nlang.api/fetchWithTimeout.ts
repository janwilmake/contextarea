// Custom error class for timeout
class FetchTimeoutError extends Error {
  constructor(message: string = "Request timed out") {
    super(message);
    this.name = "FetchTimeoutError";
  }
}

// Type for the configuration options
interface FetchWithTimeoutOptions extends RequestInit {
  timeout?: number;
}

/**
 * Performs a fetch request that automatically aborts after a specified timeout
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {},
): Promise<Response> {
  const { timeout = 60000, ...fetchOptions } = options;
  const controller = new AbortController();
  const { signal } = controller;

  // Create a timeout promise that rejects after the specified time
  const timeoutPromise = new Promise<never>((_, reject) => {
    const timeoutId = setTimeout(() => {
      controller.abort();
      reject(new FetchTimeoutError());
    }, timeout);

    // If the signal is aborted, clear the timeout
    signal.addEventListener("abort", () => clearTimeout(timeoutId));
  });

  try {
    // Race between the fetch and the timeout
    const response = await Promise.race([
      fetch(url, { ...fetchOptions, signal }),
      timeoutPromise,
    ]);

    return response;
  } catch (error) {
    if (error instanceof FetchTimeoutError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new FetchTimeoutError();
    }
    throw error;
  }
}
