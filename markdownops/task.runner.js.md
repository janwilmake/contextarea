```js
const defaultBasePath = "https://api.parallel.ai/v1";

/**
 * @param {Request} request
 * @returns {Promise<{basePath?:string,content:string,processor?:string,input_schema_url?:string,output_schema_url?:string,metadata?:{[key:string]:string}}>}
 */
const parseRunnerRequest = async (request) => {
  const json = await request.json();
  return json;
};

export default {
  /**
   * @param {Request} request
   */
  fetch: async (request) => {
    let {
      content,
      input_schema_url,
      metadata,
      output_schema_url,
      processor,
      basePath,
    } = await parseRunnerRequest(request);
    basePath = basePath || defaultBasePath;
    // Should run task endpoint https://docs.parallel.ai/api-reference/task-api-v1/create-task-run.md
    // Then call recursively with until it returns the result (https://docs.parallel.ai/api-reference/task-api-v1/retrieve-task-run-result.md
    // NB: On serverless we can poll https://docs.parallel.ai/api-reference/task-api-v1/retrieve-task-run.md
    // NB: we can use processor info to determine how often to poll to not unneededly poll too often
    // NB: We can allow 'accept' header SSE to intermediately send file updates coming from https://docs.parallel.ai/features/task-sse.md (NB: our SSE events should always be of format {result,raw})

    // should be the string of the final output
    const result = "";
    // should be the raw json output (from 'retrieve-task-run-result' endpoint)
    const raw = "";
    return new Response({ result, raw });
  },
};
```

implement this
