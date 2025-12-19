/**
 * Script to index Midnight repositories into the vector store
 * Run with: npm run index
 */

import { Octokit } from "octokit";
import { config } from "../config.js";
import { addDocuments, clearCollection, CodeDocument } from "../vectorstore.js";

const octokit = new Octokit({ auth: config.githubToken });

// File patterns to index
const PATTERNS = {
  compact: ["**/*.compact"],
  typescript: ["**/*.ts", "**/*.tsx"],
  markdown: ["**/*.md"],
};

const EXCLUDE = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/*.test.ts",
  "**/*.spec.ts",
  "**/package-lock.json",
];

interface FileInfo {
  path: string;
  content: string;
}

/**
 * Get all files from a repository
 */
async function getRepositoryFiles(
  owner: string,
  repo: string,
  branch: string
): Promise<FileInfo[]> {
  console.log(`Fetching files from ${owner}/${repo}...`);

  try {
    // Get repository tree
    const { data: refData } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`,
    });

    const { data: treeData } = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: refData.object.sha,
      recursive: "true",
    });

    const files: FileInfo[] = [];
    const filePaths = treeData.tree
      .filter((item) => item.type === "blob" && item.path)
      .map((item) => item.path as string)
      .filter((path) => {
        // Check if file matches any pattern
        const ext = path.split(".").pop() || "";
        const matchesPattern =
          ext === "compact" || ext === "ts" || ext === "tsx" || ext === "md";

        // Check exclusions
        const isExcluded = EXCLUDE.some((pattern) => {
          const regex = new RegExp(
            pattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*")
          );
          return regex.test(path);
        });

        return matchesPattern && !isExcluded;
      });

    console.log(`Found ${filePaths.length} matching files`);

    // Fetch file contents (with rate limiting)
    for (const filePath of filePaths) {
      try {
        const { data } = await octokit.rest.repos.getContent({
          owner,
          repo,
          path: filePath,
          ref: branch,
        });

        if (!Array.isArray(data) && data.type === "file" && data.content) {
          const content = Buffer.from(data.content, "base64").toString("utf-8");
          files.push({ path: filePath, content });
        }

        // Small delay to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 50));
      } catch (error) {
        console.warn(`Failed to fetch ${filePath}:`, error);
      }
    }

    return files;
  } catch (error) {
    console.error(`Error fetching ${owner}/${repo}:`, error);
    return [];
  }
}

/**
 * Parse a file into indexable chunks
 */
function parseFileIntoChunks(
  file: FileInfo,
  repository: string
): CodeDocument[] {
  const documents: CodeDocument[] = [];
  const ext = file.path.split(".").pop() || "";
  const language =
    ext === "compact" ? "compact" : ext === "md" ? "markdown" : "typescript";

  // For now, do simple chunking by splitting on double newlines
  // In production, you'd want smarter parsing (AST for code, sections for docs)
  const chunks = splitIntoChunks(file.content, 1500);

  chunks.forEach((chunk, index) => {
    const id = `${repository}:${file.path}:${index}`;

    documents.push({
      id,
      content: chunk.content,
      metadata: {
        repository,
        filePath: file.path,
        language,
        codeType: detectCodeType(chunk.content, language),
        codeName: extractName(chunk.content, language) || `chunk-${index}`,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        isPublic:
          !chunk.content.includes("private") &&
          !chunk.content.includes("internal"),
      },
    });
  });

  return documents;
}

interface Chunk {
  content: string;
  startLine: number;
  endLine: number;
}

/**
 * Split content into chunks of roughly maxChars size
 */
function splitIntoChunks(content: string, maxChars: number): Chunk[] {
  const lines = content.split("\n");
  const chunks: Chunk[] = [];
  let currentChunk: string[] = [];
  let startLine = 1;

  for (let i = 0; i < lines.length; i++) {
    currentChunk.push(lines[i]);
    const chunkContent = currentChunk.join("\n");

    if (chunkContent.length >= maxChars || i === lines.length - 1) {
      if (currentChunk.length > 0) {
        chunks.push({
          content: chunkContent,
          startLine,
          endLine: startLine + currentChunk.length - 1,
        });
      }
      currentChunk = [];
      startLine = i + 2;
    }
  }

  return chunks;
}

/**
 * Detect the type of code in a chunk
 */
function detectCodeType(content: string, language: string): string {
  if (language === "markdown") return "documentation";

  if (language === "compact") {
    if (content.includes("circuit ")) return "circuit";
    if (content.includes("witness ")) return "witness";
    if (content.includes("ledger ")) return "ledger";
    if (content.includes("type ")) return "type";
    if (content.includes("export ")) return "export";
    return "code";
  }

  // TypeScript
  if (content.includes("interface ")) return "interface";
  if (content.includes("type ")) return "type";
  if (content.includes("class ")) return "class";
  if (content.includes("function ")) return "function";
  if (content.includes("const ") && content.includes(" = async"))
    return "async-function";
  if (content.includes("export ")) return "export";
  return "code";
}

/**
 * Extract a name from a code chunk
 */
function extractName(content: string, language: string): string | null {
  const patterns = [
    /circuit\s+(\w+)/,
    /witness\s+(\w+)/,
    /function\s+(\w+)/,
    /class\s+(\w+)/,
    /interface\s+(\w+)/,
    /type\s+(\w+)/,
    /const\s+(\w+)/,
    /export\s+(?:default\s+)?(?:function|class|const|interface|type)\s+(\w+)/,
    /^#\s+(.+)$/m, // Markdown heading
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

/**
 * Main indexing function
 */
async function main() {
  console.log("Starting Midnight repository indexing...\n");

  // Clear existing data
  console.log("Clearing existing collection...");
  try {
    await clearCollection();
  } catch (error) {
    console.log("No existing collection to clear");
  }

  const allDocuments: CodeDocument[] = [];

  // Fetch and parse all repositories
  for (const { owner, repo, branch } of config.repositories) {
    const repoName = `${owner}/${repo}`;
    console.log(`\nIndexing ${repoName}...`);

    const files = await getRepositoryFiles(owner, repo, branch);
    console.log(`Fetched ${files.length} files`);

    for (const file of files) {
      const documents = parseFileIntoChunks(file, repoName);
      allDocuments.push(...documents);
    }

    console.log(`Parsed ${allDocuments.length} documents so far`);
  }

  // Add all documents to vector store
  console.log(`\nIndexing ${allDocuments.length} total documents...`);
  await addDocuments(allDocuments);

  console.log("\n✅ Indexing complete!");
  console.log(`Total documents indexed: ${allDocuments.length}`);
}

main().catch(console.error);
