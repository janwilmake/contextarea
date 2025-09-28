import { Token, lexer } from "marked";

export const extensionToMediaType = {
  // Web Documents
  html: "text/html",
  htm: "text/html",
  xhtml: "application/xhtml+xml",
  xml: "application/xml",
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",

  // Stylesheets
  css: "text/css",
  scss: "text/x-scss",
  sass: "text/x-sass",
  less: "text/x-less",
  styl: "text/x-stylus",

  // JavaScript & TypeScript
  js: "text/javascript",
  mjs: "text/javascript",
  jsx: "text/javascript",
  ts: "text/typescript",
  tsx: "text/typescript",
  json: "application/json",
  jsonc: "application/json",
  json5: "application/json5",

  // Web Assembly
  wasm: "application/wasm",

  // Images
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  avif: "image/avif",
  ico: "image/x-icon",
  bmp: "image/bmp",
  tiff: "image/tiff",
  tif: "image/tiff",

  // Audio
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  flac: "audio/flac",

  // Video
  webm: "audio/webm",
  mp4: "video/mp4",
  ogv: "video/ogg",
  avi: "video/x-msvideo",
  mov: "video/quicktime",
  wmv: "video/x-ms-wmv",
  flv: "video/x-flv",
  mkv: "video/x-matroska",

  // Fonts
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  eot: "application/vnd.ms-fontobject",

  // Archives
  zip: "application/zip",
  tar: "application/x-tar",
  gz: "application/gzip",
  "7z": "application/x-7z-compressed",
  rar: "application/vnd.rar",

  // Documents
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",

  // Configuration Files
  yaml: "text/yaml",
  yml: "text/yaml",
  toml: "application/toml",
  ini: "text/plain",
  cfg: "text/plain",
  conf: "text/plain",
  env: "text/plain",

  // Development Files
  dockerfile: "text/plain",
  gitignore: "text/plain",
  gitattributes: "text/plain",
  editorconfig: "text/plain",
  npmrc: "text/plain",
  babelrc: "application/json",
  eslintrc: "application/json",
  prettierrc: "application/json",
  package: "application/json", // package.json
  lock: "application/json", // package-lock.json

  // Shell Scripts
  sh: "text/x-shellscript",
  bash: "text/x-shellscript",
  zsh: "text/x-shellscript",
  fish: "text/x-shellscript",
  ps1: "text/plain",
  bat: "text/plain",
  cmd: "text/plain",

  // Programming Languages
  py: "text/x-python",
  rb: "text/x-ruby",
  php: "text/x-php",
  java: "text/x-java-source",
  c: "text/x-c",
  cpp: "text/x-c++src",
  cxx: "text/x-c++src",
  cc: "text/x-c++src",
  h: "text/x-c",
  hpp: "text/x-c++hdr",
  cs: "text/x-csharp",
  go: "text/x-go",
  rs: "text/x-rust",
  kt: "text/x-kotlin",
  swift: "text/x-swift",
  scala: "text/x-scala",
  r: "text/x-r",
  m: "text/x-objectivec",
  mm: "text/x-objectivec",
  pl: "text/x-perl",
  lua: "text/x-lua",
  sql: "text/x-sql",

  // Template Files
  ejs: "text/html",
  hbs: "text/x-handlebars-template",
  handlebars: "text/x-handlebars-template",
  mustache: "text/x-mustache",
  pug: "text/x-pug",
  jade: "text/x-jade",
  twig: "text/x-twig",
  blade: "text/x-php",
  vue: "text/x-vue",
  svelte: "text/x-svelte",

  // Data Files
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  geojson: "application/geo+json",
  kml: "application/vnd.google-earth.kml+xml",
  gpx: "application/gpx+xml",

  // Executable Files
  exe: "application/x-msdownload",
  msi: "application/x-msi",
  deb: "application/vnd.debian.binary-package",
  rpm: "application/x-rpm",
  dmg: "application/x-apple-diskimage",
  pkg: "application/x-newton-compatible-pkg",
  app: "application/x-executable",

  // Misc
  bin: "application/octet-stream",
  dat: "application/octet-stream",
  iso: "application/x-iso9660-image",
  torrent: "application/x-bittorrent",
  rss: "application/rss+xml",
  atom: "application/atom+xml",
  sitemap: "application/xml",
  robots: "text/plain", // robots.txt
  htaccess: "text/plain",
  htpasswd: "text/plain",
  log: "text/plain",
  cert: "application/x-x509-ca-cert",
  crt: "application/x-x509-ca-cert",
  pem: "application/x-pem-file",
  key: "application/pkcs8",
  p12: "application/x-pkcs12",
  pfx: "application/x-pkcs12",
};

/**
 * Recursively flatten a marked token and return something if a find function is met
 */
const flattenMarkedTokenRecursive = (
  token: Token,
  findFunction: (token: any) => boolean,
): Token[] => {
  if (findFunction(token)) {
    return [token];
  }

  if (token.type === "table") {
    const header = token.header
      .map((token: any) => {
        const result = token.tokens
          .map((x: any) => flattenMarkedTokenRecursive(x, findFunction))
          .flat();
        return result;
      })
      .flat();

    const rows = token.rows
      .map((row: any) => {
        const result = row
          .map((token: any) => {
            const result = token.tokens
              .map((x: any) => flattenMarkedTokenRecursive(x, findFunction))
              .flat();

            return result;
          })
          .flat();

        return result;
      })
      .flat();

    return [header, rows].flat();
  }

  if (token.type === "list") {
    const result = token.items
      .map((token: any) => {
        const result = token.tokens
          .map((x: any) => flattenMarkedTokenRecursive(x, findFunction))
          .flat();
        return result;
      })
      .flat();

    return result;
  }

  if (
    token.type === "del" ||
    token.type === "em" ||
    token.type === "heading" ||
    token.type === "link" ||
    token.type === "paragraph" ||
    token.type === "strong"
  ) {
    if (!token.tokens) {
      return [];
    }
    const result = token.tokens
      .map((x: any) => flattenMarkedTokenRecursive(x, findFunction))
      .flat();
    return result;
  }

  return [];
};

/**
 * find all items that match a token, recursively in all nested things
 */
const flattenMarkdownString = (
  markdownString: string,
  findFunction: (token: Token) => boolean,
): Token[] => {
  const tokenList = lexer(markdownString);
  const result = tokenList
    .map((x) => flattenMarkedTokenRecursive(x, findFunction))
    .filter((x) => !!x)
    .map((x) => x!)
    .flat();

  return result;
};

export type Codeblock = {
  text: string;
  lang?: string;
  parameters?: { [key: string]: string };
  isIncomplete: boolean;
};
/**
 * find all codeblocks  (stuff between triple bracket)
 *
 * ```
 * here
 * is
 * example
 * ```
 */
export const findCodeblocks = (markdownString: string): Codeblock[] => {
  const result = flattenMarkdownString(
    markdownString,
    (token) => token.type === "code",
  );

  const codeblocks = result
    .map((token) => {
      if (token.type !== "code") return;

      const { text, lang } = token;

      const [ext, ...meta] = lang ? (lang as string).trim().split(" ") : [];
      const parameters = Object.fromEntries(
        meta.map((chunk) => {
          const key = chunk.split("=")[0].trim();
          const value0 = chunk.split("=").slice(1).join("=").trim();
          const isQuoted =
            (value0.startsWith('"') && value0.endsWith('"')) ||
            (value0.startsWith("'") && value0.endsWith("'"));

          const value = isQuoted ? value0.slice(1, value0.length - 1) : value0;

          return [key, value];
        }),
      );

      return { text, lang: ext, parameters };
    })
    .filter((x) => !!x)
    .map((x, index, array) => {
      const isLast = index === array.length - 1;

      const isIncomplete = isLast && markdownString.endsWith(x.text);
      return { ...x!, isIncomplete };
    });

  return codeblocks;
};

/**
This implementation:

1. **Prioritizes the language hint** - If a language is specified and we recognize it, we trust it
2. **Handles common aliases** - Maps things like "javascript" → "js", "python" → "py", etc.
3. **Falls back to content analysis** - Uses various heuristics to detect content type from the actual text
4. **Uses sensible defaults** - Returns `text/plain` when nothing else matches
5. **Handles edge cases** - Like trying to parse JSON to verify it's actually valid JSON before assigning that content type

The content analysis looks for distinctive patterns that are reliable indicators of specific languages/formats, starting with the most distinctive ones (like HTML doctypes) and working down to more general patterns.
 */
export const getContentType = (
  lang: string | undefined,
  text: string,
): string => {
  // First, try to get content type from language hint if provided
  if (lang) {
    const normalizedLang = lang.toLowerCase().trim();

    // Direct language mappings
    const langToContentType: { [key: string]: string } = {
      // Web technologies
      html: "text/html",
      htm: "text/html",
      xml: "application/xml",
      css: "text/css",
      scss: "text/x-scss",
      sass: "text/x-sass",
      less: "text/x-less",

      // JavaScript/TypeScript
      javascript: "text/javascript",
      js: "text/javascript",
      jsx: "text/javascript",
      typescript: "text/typescript",
      ts: "text/typescript",
      tsx: "text/typescript",
      json: "application/json",
      json5: "application/json5",

      // Programming languages
      python: "text/x-python",
      py: "text/x-python",
      java: "text/x-java-source",
      c: "text/x-c",
      cpp: "text/x-c++src",
      "c++": "text/x-c++src",
      cxx: "text/x-c++src",
      cs: "text/x-csharp",
      csharp: "text/x-csharp",
      go: "text/x-go",
      golang: "text/x-go",
      rust: "text/x-rust",
      rs: "text/x-rust",
      php: "text/x-php",
      ruby: "text/x-ruby",
      rb: "text/x-ruby",
      swift: "text/x-swift",
      kotlin: "text/x-kotlin",
      kt: "text/x-kotlin",
      scala: "text/x-scala",
      r: "text/x-r",
      sql: "text/x-sql",
      shell: "text/x-shellscript",
      sh: "text/x-shellscript",
      bash: "text/x-shellscript",
      zsh: "text/x-shellscript",
      powershell: "text/plain",
      ps1: "text/plain",
      lua: "text/x-lua",
      perl: "text/x-perl",
      pl: "text/x-perl",

      // Markup/Config
      markdown: "text/markdown",
      md: "text/markdown",
      yaml: "text/yaml",
      yml: "text/yaml",
      toml: "application/toml",
      ini: "text/plain",
      conf: "text/plain",
      config: "text/plain",

      // Template languages
      handlebars: "text/x-handlebars-template",
      hbs: "text/x-handlebars-template",
      mustache: "text/x-mustache",
      pug: "text/x-pug",
      jade: "text/x-jade",
      ejs: "text/html",
      vue: "text/x-vue",
      svelte: "text/x-svelte",

      // Data formats
      csv: "text/csv",
      tsv: "text/tab-separated-values",
      geojson: "application/geo+json",

      // Other
      dockerfile: "text/plain",
      docker: "text/plain",
      makefile: "text/plain",
      make: "text/plain",
      gitignore: "text/plain",
      log: "text/plain",
      text: "text/plain",
      txt: "text/plain",
      plain: "text/plain",
    };

    if (langToContentType[normalizedLang]) {
      return langToContentType[normalizedLang];
    }
  }

  // Fallback to content analysis
  const trimmedText = text.trim().toLowerCase();

  // Check for common patterns at the start of content
  if (
    trimmedText.startsWith("<!doctype html") ||
    trimmedText.startsWith("<html") ||
    trimmedText.includes("<head>") ||
    trimmedText.includes("<body>")
  ) {
    return "text/html";
  }

  if (
    trimmedText.startsWith("<?xml") ||
    (trimmedText.startsWith("<") && trimmedText.includes("xmlns"))
  ) {
    return "application/xml";
  }

  if (trimmedText.startsWith("{") && trimmedText.endsWith("}")) {
    try {
      JSON.parse(text);
      return "application/json";
    } catch {
      // Not valid JSON, continue with other checks
    }
  }

  if (trimmedText.startsWith("[") && trimmedText.endsWith("]")) {
    try {
      JSON.parse(text);
      return "application/json";
    } catch {
      // Not valid JSON, continue with other checks
    }
  }

  // CSS detection
  if (
    trimmedText.includes("{") &&
    trimmedText.includes("}") &&
    (trimmedText.includes(":") || trimmedText.match(/[.#][a-zA-Z]/))
  ) {
    return "text/css";
  }

  // JavaScript/TypeScript patterns
  if (
    trimmedText.includes("function ") ||
    trimmedText.includes("const ") ||
    trimmedText.includes("let ") ||
    trimmedText.includes("var ") ||
    trimmedText.includes("=>") ||
    trimmedText.includes("console.log") ||
    trimmedText.includes("import ") ||
    trimmedText.includes("export ")
  ) {
    // Check for TypeScript-specific patterns
    if (
      trimmedText.includes(": string") ||
      trimmedText.includes(": number") ||
      trimmedText.includes(": boolean") ||
      trimmedText.includes("interface ") ||
      trimmedText.includes("type ") ||
      trimmedText.includes("<T>") ||
      trimmedText.includes("as ")
    ) {
      return "text/typescript";
    }
    return "text/javascript";
  }

  // Python detection
  if (
    trimmedText.includes("def ") ||
    trimmedText.includes("import ") ||
    trimmedText.includes("from ") ||
    trimmedText.includes("print(") ||
    trimmedText.includes("if __name__")
  ) {
    return "text/x-python";
  }

  // Shell script detection
  if (
    trimmedText.startsWith("#!/bin/bash") ||
    trimmedText.startsWith("#!/bin/sh") ||
    trimmedText.startsWith("#!/usr/bin/env")
  ) {
    return "text/x-shellscript";
  }

  // YAML detection
  if (
    trimmedText.match(/^[a-zA-Z_][a-zA-Z0-9_]*:\s/) ||
    trimmedText.includes("---") ||
    trimmedText.match(/^\s*-\s+[a-zA-Z]/m)
  ) {
    return "text/yaml";
  }

  // SQL detection
  if (
    trimmedText.match(/\b(select|insert|update|delete|create|drop|alter)\b/i)
  ) {
    return "text/x-sql";
  }

  // Markdown detection
  if (
    trimmedText.includes("# ") ||
    trimmedText.includes("## ") ||
    trimmedText.includes("```") ||
    (trimmedText.includes("[") && trimmedText.includes("]("))
  ) {
    return "text/markdown";
  }

  // Default fallback
  return "text/plain";
};

// Quick tests for isIncomplete functionality
if (import.meta.main) {
  console.log("Testing isIncomplete functionality...\n");

  const tests = [
    {
      name: "Complete codeblock",
      markdown:
        "Here's some code:\n```js\nconsole.log('hello');\n```\n\nAnd some text after.",
      expected: false,
    },
    {
      name: "Incomplete codeblock (ends with code text)",
      markdown: "Here's some code:\n```js\nconsole.log('hello');",
      expected: true,
    },
    {
      name: "Multiple blocks, last one incomplete",
      markdown:
        "First block:\n```js\nconsole.log('first');\n```\n\nSecond block:\n```python\nprint('second')",
      expected: true,
    },
    {
      name: "Multiple blocks, all complete",
      markdown:
        "First block:\n```js\nconsole.log('first');\n```\n\nSecond block:\n```python\nprint('second')\n```",
      expected: false,
    },
    {
      name: "Empty codeblock, complete",
      markdown: "Empty:\n```\n```",
      expected: false,
    },
    {
      name: "Empty codeblock, incomplete",
      markdown: "Empty:\n```",
      expected: true,
    },
    {
      name: "Codeblock with language, incomplete",
      markdown: "```typescript\ninterface User {\n  name: string;",
      expected: true,
    },
    {
      name: "Codeblock with parameters, incomplete",
      markdown: "```js filename='test.js' line=5\nconst x = 1;",
      expected: true,
    },
    {
      name: "No codeblocks",
      markdown: "Just some regular text here.",
      expected: null, // No codeblocks found
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const codeblocks = findCodeblocks(test.markdown);
    const lastBlock = codeblocks[codeblocks.length - 1];
    const actual = lastBlock?.isIncomplete ?? null;

    if (actual === test.expected) {
      console.log(`✅ ${test.name}`);
      passed++;
    } else {
      console.log(`❌ ${test.name}`);
      console.log(`   Expected: ${test.expected}, Got: ${actual}`);
      console.log(`   Markdown: ${JSON.stringify(test.markdown)}`);
      console.log(`   Codeblocks found: ${codeblocks.length}`);
      if (lastBlock) {
        console.log(`   Last block text: ${JSON.stringify(lastBlock.text)}`);
      }
      console.log("");
      failed++;
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
}
