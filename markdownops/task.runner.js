const defaultBasePath = "https://api.parallel.ai/v1";

/**
 * @param {Request} request
 * @returns {Promise<{basePath?:string,content:string,processor?:string,input_schema_url?:string,output_schema_url?:string,metadata?:{[key:string]:string}}>}
 */
const parseRunnerRequest = async (request) => {
  const json = await request.json();
  return json;
};

/**
 * Fetches schema from URL and returns as JSON object
 * @param {string} url
 * @returns {Promise<Object|null>}
 */
const fetchSchema = async (url) => {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
};

/**
 * Creates a task run via Parallel API
 * @param {string} basePath
 * @param {string} apiKey
 * @param {Object} taskSpec
 * @param {string} input
 * @param {string} processor
 * @param {Object} metadata
 * @param {boolean} enableEvents
 * @returns {Promise<Object>}
 */
const createTaskRun = async (
  basePath,
  apiKey,
  taskSpec,
  input,
  processor,
  metadata,
  enableEvents
) => {
  const payload = {
    input,
    processor: processor || "base",
    ...(taskSpec && { task_spec: taskSpec }),
    ...(metadata && { metadata }),
    ...(enableEvents && { enable_events: true }),
  };

  const response = await fetch(`${basePath}/tasks/runs`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "content-type": "application/json",
      ...(enableEvents && { "parallel-beta": "events-sse-2025-07-24" }),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to create task run: ${response.status} ${await response.text()}`
    );
  }

  return await response.json();
};

/**
 * Retrieves task run status
 * @param {string} basePath
 * @param {string} apiKey
 * @param {string} runId
 * @returns {Promise<Object>}
 */
const getTaskRun = async (basePath, apiKey, runId) => {
  const response = await fetch(`${basePath}/tasks/runs/${runId}`, {
    method: "GET",
    headers: {
      "x-api-key": apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to get task run: ${response.status} ${await response.text()}`
    );
  }

  return await response.json();
};

/**
 * Retrieves task run result (blocking)
 * @param {string} basePath
 * @param {string} apiKey
 * @param {string} runId
 * @param {number} timeout
 * @returns {Promise<Object>}
 */
const getTaskRunResult = async (basePath, apiKey, runId, timeout = 600) => {
  const response = await fetch(
    `${basePath}/tasks/runs/${runId}/result?timeout=${timeout}`,
    {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to get task run result: ${
        response.status
      } ${await response.text()}`
    );
  }

  return await response.json();
};

/**
 * Gets polling interval based on processor type
 * @param {string} processor
 * @returns {number} interval in milliseconds
 */
const getPollingInterval = (processor) => {
  const intervals = {
    lite: 2000,
    base: 3000,
    pro: 5000,
    core: 5000,
    max: 8000,
  };
  return intervals[processor] || 3000;
};

/**
 * Polls task run until completion
 * @param {string} basePath
 * @param {string} apiKey
 * @param {string} runId
 * @param {string} processor
 * @returns {Promise<Object>}
 */
const pollTaskRun = async (basePath, apiKey, runId, processor) => {
  const interval = getPollingInterval(processor);
  const maxAttempts = 120; // 6 minutes max polling

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const taskRun = await getTaskRun(basePath, apiKey, runId);

    if (taskRun.status === "completed") {
      // Get the final result
      return await getTaskRunResult(basePath, apiKey, runId);
    }

    if (taskRun.status === "failed" || taskRun.status === "cancelled") {
      throw new Error(
        `Task run ${taskRun.status}: ${
          taskRun.error?.message || "Unknown error"
        }`
      );
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error("Task run timed out");
};

/**
 * Streams SSE events from task run
 * @param {string} basePath
 * @param {string} apiKey
 * @param {string} runId
 * @returns {ReadableStream}
 */
const streamTaskRunEvents = (basePath, apiKey, runId) => {
  return new ReadableStream({
    async start(controller) {
      try {
        const response = await fetch(
          `${basePath.replace("/v1", "/v1beta")}/tasks/runs/${runId}/events`,
          {
            method: "GET",
            headers: {
              "x-api-key": apiKey,
              "content-type": "text/event-stream",
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to stream events: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const eventData = JSON.parse(line.slice(6));

                  // Send formatted SSE event
                  const sseEvent = {
                    result: null,
                    raw: eventData,
                  };

                  controller.enqueue(`data: ${JSON.stringify(sseEvent)}\n\n`);

                  // Check if task is completed
                  if (
                    eventData.type === "run_status" &&
                    (eventData.status === "completed" ||
                      eventData.status === "failed" ||
                      eventData.status === "cancelled")
                  ) {
                    if (eventData.status === "completed") {
                      // Get final result
                      const result = await getTaskRunResult(
                        basePath,
                        apiKey,
                        runId
                      );
                      const finalEvent = {
                        result: result.output.content,
                        raw: result,
                      };
                      controller.enqueue(
                        `data: ${JSON.stringify(finalEvent)}\n\n`
                      );
                    }

                    controller.close();
                    return;
                  }
                } catch (e) {
                  // Ignore malformed JSON
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      } catch (error) {
        controller.error(error);
      }
    },
  });
};

export default {
  /**
   * @param {Request} request
   */
  fetch: async (request) => {
    try {
      const {
        content,
        input_schema_url,
        metadata,
        output_schema_url,
        processor,
        basePath,
      } = await parseRunnerRequest(request);

      const actualBasePath = basePath || defaultBasePath;
      const apiKey = request.headers.get("x-api-key");

      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: "Missing x-api-key header" }),
          {
            status: 401,
            headers: { "content-type": "application/json" },
          }
        );
      }

      if (!content) {
        return new Response(
          JSON.stringify({ error: "Missing content field" }),
          {
            status: 400,
            headers: { "content-type": "application/json" },
          }
        );
      }

      // Build task spec if schemas are provided
      let taskSpec = null;
      if (input_schema_url || output_schema_url) {
        taskSpec = {};

        if (input_schema_url) {
          const inputSchema = await fetchSchema(input_schema_url);
          if (inputSchema) {
            taskSpec.input_schema = {
              type: "json",
              json_schema: inputSchema,
            };
          }
        }

        if (output_schema_url) {
          const outputSchema = await fetchSchema(output_schema_url);
          if (outputSchema) {
            taskSpec.output_schema = {
              type: "json",
              json_schema: outputSchema,
            };
          }
        }
      }

      // Check if client wants SSE
      const acceptHeader = request.headers.get("accept");
      const wantsSSE =
        acceptHeader && acceptHeader.includes("text/event-stream");

      // Determine if we should enable events (for pro+ processors or if SSE requested)
      const processorName = processor || "base";
      const isProProcessor = ["pro", "core", "max"].includes(processorName);
      const enableEvents = wantsSSE || isProProcessor;

      // Create task run
      const taskRun = await createTaskRun(
        actualBasePath,
        apiKey,
        taskSpec,
        content,
        processorName,
        metadata,
        enableEvents
      );

      // If SSE requested, stream events
      if (wantsSSE) {
        const stream = streamTaskRunEvents(
          actualBasePath,
          apiKey,
          taskRun.run_id
        );

        return new Response(stream, {
          headers: {
            "content-type": "text/event-stream",
            "cache-control": "no-cache",
            connection: "keep-alive",
          },
        });
      } else {
        // Poll for completion
        const result = await pollTaskRun(
          actualBasePath,
          apiKey,
          taskRun.run_id,
          processorName
        );

        return new Response(
          JSON.stringify({
            result: result.output.content,
            raw: result,
          }),
          {
            headers: { "content-type": "application/json" },
          }
        );
      }
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error.message,
          result: "",
          raw: null,
        }),
        {
          status: 500,
          headers: { "content-type": "application/json" },
        }
      );
    }
  },
};
