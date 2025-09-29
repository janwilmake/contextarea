export interface StepOutput {
  status?: number;
  headers?: Record<string, string>;
  content?: string;
  /** route-normalised URL incase we have content proxied from another URL */
  url?: string;
  contextUrlErrors?: { url: string; status: number; error?: string }[];
  contextUrls?: string[];
  contextResultUrl?: string;
  generationResultUrl?: string;
}

export type StepInput = {
  /** Path to the source at this step (may include dynamic route filenames) */
  pathAtStep: string;
  /** Route that was loaded. params can be inferred from this */
  routeAtStep: string;
  path: string;
  /** content of the sourcetext */
  content?: string;
  originUrl: string;
  originApiKey?: string;
  llmBasePath: string;
  llmModelName: string;
  llmApiKey: string;
};

export type Step = {
  input?: StepInput;
  output: StepOutput;
};

export type CompileContext = {
  llmBasePath: string;
  llmModelName: string;
  llmApiKey: string;
  /**
   * Path to the original sourcetext of the route that was loaded. If any, params are still dynamic here
   */
  originalPath: string;
  /**
   * Actual route that was requested. This should be a nlang-compatible server that serves all intermediate files on the expected address, including the original file.
   *
   * Params are filled here.
   */
  route: string;
  /** Actual pathname that was requested */
  path: string;
  /** content at the originalPath  */
  content: string;
  /** base origin that is the origin for both route and original path */
  originUrl: string;

  /**
   * Authorization for baseUrl for context files that need to be loaded.
   *
   * Please note that this:
   *
   * - should be able to respond with original sourcetext files
   * - should be able to respond with intermediate files
   * - should also be able to respond with generated files in order for this to be recursive
   */
  originApiKey?: string;
};
