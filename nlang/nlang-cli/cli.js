#!/usr/bin/env node

const fs = require("fs").promises;
const path = require("path");
const { execSync } = require("child_process");
const readline = require("readline");
const https = require("https");
const http = require("http");

/**
 * Configuration object containing LLM settings
 * @typedef {Object} Config
 * @property {string} LLM_BASEPATH - Base URL for the LLM API
 * @property {string} LLM_SECRET - API secret/key for authentication
 * @property {string} LLM_MODEL - Model identifier to use
 * @property {string} LLM_SYSTEM - System prompt for the LLM
 */

/**
 * File information object
 * @typedef {Object} FileInfo
 * @property {string} filename - Name of the file
 * @property {Date} lastModified - Last modification date
 */

/**
 * Definition file with its associated destination
 * @typedef {Object} DefinitionFile
 * @property {string} definitionPath - Path to the definition file
 * @property {string} destinationPath - Path to the destination file
 * @property {Date} definitionModified - Last modified date of definition file
 * @property {Date|null} destinationModified - Last modified date of destination file (null if doesn't exist)
 */

/**
 * Gets environment configuration from various sources
 * @returns {Promise<Config>} Configuration object
 * @throws {Error} If required environment variables are missing
 */
async function getConfig() {
  let config = {
    LLM_BASEPATH: process.env.LLM_BASEPATH,
    LLM_SECRET: process.env.LLM_SECRET,
    LLM_MODEL: process.env.LLM_MODEL,
    LLM_SYSTEM: process.env.LLM_SYSTEM,
  };

  // Check if all required vars are present
  const missing = Object.entries(config)
    .filter(([key, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    // Try local .env.extexe
    const localEnvPath = path.join(process.cwd(), ".env.extexe");
    try {
      const localEnv = await fs.readFile(localEnvPath, "utf8");
      const localConfig = parseEnvFile(localEnv);
      config = { ...config, ...localConfig };
    } catch (err) {
      // Try home directory .env.extexe
      const homeEnvPath = path.join(require("os").homedir(), ".env.extexe");
      try {
        const homeEnv = await fs.readFile(homeEnvPath, "utf8");
        const homeConfig = parseEnvFile(homeEnv);
        config = { ...config, ...homeConfig };
      } catch (err) {
        // Still missing required vars
        const stillMissing = Object.entries(config)
          .filter(([key, value]) => !value)
          .map(([key]) => key);
        if (stillMissing.length > 0) {
          throw new Error(
            `Missing required environment variables: ${stillMissing.join(
              ", ",
            )}\nPlease set them in your environment, ./.env.extexe, or ~/.env.extexe`,
          );
        }
      }
    }
  }

  return config;
}

/**
 * Parses environment file content into key-value pairs
 * @param {string} content - Content of the .env file
 * @returns {Object} Parsed environment variables
 */
function parseEnvFile(content) {
  const config = {};
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      if (key && valueParts.length > 0) {
        config[key.trim()] = valueParts
          .join("=")
          .trim()
          .replace(/^["']|["']$/g, "");
      }
    }
  }

  return config;
}

/**
 * Finds the git root directory by walking up the directory tree
 * @returns {Promise<string>} Path to the git root directory
 * @throws {Error} If no git repository is found
 */
async function findGitRoot() {
  let currentDir = process.cwd();

  while (currentDir !== path.dirname(currentDir)) {
    try {
      await fs.access(path.join(currentDir, ".git"));
      return currentDir;
    } catch (err) {
      currentDir = path.dirname(currentDir);
    }
  }

  throw new Error(
    "No git repository found. This tool only works within a git repository.",
  );
}

/**
 * Checks if git repository has uncommitted changes
 * @returns {Promise<boolean>} True if git is dirty (has uncommitted changes)
 */
async function isGitDirty() {
  try {
    const output = execSync("git status --porcelain", { encoding: "utf8" });
    return output.trim().length > 0;
  } catch (err) {
    return false;
  }
}

/**
 * Prompts user for confirmation to continue with dirty git
 * @returns {Promise<boolean>} True if user wants to continue
 */
async function promptContinue() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(
      "Git repository has uncommitted changes. Press Enter to continue, or Ctrl+C to abort: ",
      (answer) => {
        rl.close();
        resolve(answer === "");
      },
    );
  });
}

/**
 * Gets file information for all files in current directory
 * @returns {Promise<FileInfo[]>} Array of file information objects
 */
async function getFileInfo() {
  const files = await fs.readdir(process.cwd());
  const fileInfos = [];

  for (const file of files) {
    try {
      const stats = await fs.stat(file);
      if (stats.isFile()) {
        fileInfos.push({
          filename: file,
          lastModified: stats.mtime,
        });
      }
    } catch (err) {
      // Skip files we can't stat
    }
  }

  return fileInfos;
}

/**
 * Finds definition files that need processing
 * @param {FileInfo[]} fileInfos - Array of file information
 * @returns {Promise<DefinitionFile[]>} Array of definition files to process
 */
async function findDefinitionFiles(fileInfos) {
  const definitionFiles = [];

  for (const fileInfo of fileInfos) {
    const { filename, lastModified } = fileInfo;
    const parts = filename.split(".");

    // Check if file has two or more extensions and ends with .md
    if (parts.length >= 3 && parts[parts.length - 1] === "md") {
      const destinationFilename = parts.slice(0, -1).join(".");
      const destinationPath = path.join(process.cwd(), destinationFilename);

      let destinationModified = null;
      try {
        const stats = await fs.stat(destinationPath);
        destinationModified = stats.mtime;
      } catch (err) {
        // Destination file doesn't exist
      }

      // Include if destination doesn't exist or definition is newer
      if (!destinationModified || lastModified > destinationModified) {
        definitionFiles.push({
          definitionPath: path.join(process.cwd(), filename),
          destinationPath,
          definitionModified: lastModified,
          destinationModified,
        });
      }
    }
  }

  return definitionFiles;
}

/**
 * Fetches content from a URL
 * @param {string} url - URL to fetch
 * @returns {Promise<string|null>} Content of the URL or null if HTML
 */
async function fetchUrl(url) {
  return new Promise((resolve) => {
    const client = url.startsWith("https:") ? https : http;

    const req = client.get(url, (res) => {
      const contentType = res.headers["content-type"] || "";

      // Skip HTML content
      if (contentType.includes("text/html")) {
        resolve(null);
        return;
      }

      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        resolve(data);
      });
    });

    req.on("error", (err) => {
      console.warn(`Failed to fetch ${url}: ${err.message}`);
      resolve(null);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      console.warn(`Timeout fetching ${url}`);
      resolve(null);
    });
  });
}

/**
 * Expands definition file by fetching URLs and prepending context
 * @param {string} definitionPath - Path to the definition file
 * @returns {Promise<string>} Expanded content
 */
async function expandDefinitionFile(definitionPath) {
  const content = await fs.readFile(definitionPath, "utf8");
  const urlRegex = /https?:\/\/[^\s]+/g;
  const urls = content.match(urlRegex) || [];

  if (urls.length === 0) {
    return content;
  }

  const contextParts = [];

  for (const url of urls) {
    const urlContent = await fetchUrl(url);
    if (urlContent !== null) {
      contextParts.push(`${url}\n${urlContent}`);
    }
  }

  if (contextParts.length === 0) {
    return content;
  }

  const contextHeader = `context:\n\n${contextParts.join(
    "\n----\n",
  )}\n----\n\n`;
  return contextHeader + content;
}

/**
 * Makes a chat completion request to the LLM API
 * @param {Config} config - Configuration object
 * @param {string} content - Content to send to the LLM
 * @returns {Promise<string>} Response from the LLM
 */
async function makeChatCompletion(config, content) {
  const url = new URL("/chat/completions", config.LLM_BASEPATH);

  const requestData = JSON.stringify({
    model: config.LLM_MODEL,
    messages: [
      {
        role: "system",
        content: config.LLM_SYSTEM,
      },
      {
        role: "user",
        content: content,
      },
    ],
  });

  return new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(requestData),
        Authorization: `Bearer ${config.LLM_SECRET}`,
      },
    };

    const req = client.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const response = JSON.parse(data);
          const content = response.choices[0].message.content;
          resolve(content);
        } catch (err) {
          reject(new Error(`Failed to parse LLM response: ${err.message}`));
        }
      });
    });

    req.on("error", (err) => {
      reject(new Error(`LLM request failed: ${err.message}`));
    });

    req.write(requestData);
    req.end();
  });
}

/**
 * Extracts the first code block from markdown content
 * @param {string} content - Markdown content
 * @returns {string|null} Content of the first code block or null if not found
 */
function extractFirstCodeBlock(content) {
  const codeBlockRegex = /```[\s\S]*?\n([\s\S]*?)```/;
  const match = content.match(codeBlockRegex);
  return match ? match[1] : null;
}

/**
 * Processes a single definition file
 * @param {Config} config - Configuration object
 * @param {DefinitionFile} defFile - Definition file to process
 * @returns {Promise<void>}
 */
async function processDefinitionFile(config, defFile) {
  try {
    console.log(`Processing ${path.basename(defFile.definitionPath)}...`);

    const expandedContent = await expandDefinitionFile(defFile.definitionPath);
    const llmResponse = await makeChatCompletion(config, expandedContent);
    const codeBlock = extractFirstCodeBlock(llmResponse);

    if (codeBlock) {
      await fs.writeFile(defFile.destinationPath, codeBlock, "utf8");
      console.log(`✓ Generated ${path.basename(defFile.destinationPath)}`);
    } else {
      console.warn(
        `⚠ No code block found in response for ${path.basename(
          defFile.definitionPath,
        )}`,
      );
    }
  } catch (err) {
    console.error(
      `✗ Failed to process ${path.basename(defFile.definitionPath)}: ${
        err.message
      }`,
    );
  }
}

/**
 * Main function that orchestrates the entire process
 * @returns {Promise<void>}
 */
async function main() {
  try {
    // Get configuration
    const config = await getConfig();

    // Find git root and check if dirty
    const gitRoot = await findGitRoot();
    process.chdir(gitRoot);

    const isDirty = await isGitDirty();
    if (isDirty) {
      const shouldContinue = await promptContinue();
      if (!shouldContinue) {
        console.log("Aborted.");
        process.exit(0);
      }
    }

    // Get file information and find definition files
    const fileInfos = await getFileInfo();
    const definitionFiles = await findDefinitionFiles(fileInfos);

    if (definitionFiles.length === 0) {
      console.log("No definition files need processing.");
      return;
    }

    console.log(
      `Found ${definitionFiles.length} definition file(s) to process.`,
    );

    // Process all definition files in parallel
    await Promise.all(
      definitionFiles.map((defFile) => processDefinitionFile(config, defFile)),
    );

    console.log("Processing complete.");
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

// Run main function if this file is executed directly
if (require.main === module) {
  main();
}

module.exports = {
  getConfig,
  findGitRoot,
  isGitDirty,
  getFileInfo,
  findDefinitionFiles,
  expandDefinitionFile,
  makeChatCompletion,
  extractFirstCodeBlock,
  processDefinitionFile,
  main,
};
