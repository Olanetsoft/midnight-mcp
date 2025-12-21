/**
 * Script to index Midnight repositories into Cloudflare Vectorize
 * Run locally with: npm run index
 *
 * Requires:
 * - OPENAI_API_KEY env var
 * - CLOUDFLARE_API_TOKEN env var
 * - CLOUDFLARE_ACCOUNT_ID env var
 * - GITHUB_TOKEN env var (recommended - increases rate limit from 60 to 5000 req/hr)
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load .env from parent directory (project root)
config({ path: resolve(__dirname, "../../.env") });

import { Octokit } from "octokit";
import OpenAI from "openai";

const VECTORIZE_INDEX = "midnight-code";

// Validate required environment variables
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN || !OPENAI_API_KEY) {
  console.error("Missing required environment variables:");
  if (!CLOUDFLARE_ACCOUNT_ID) console.error("- CLOUDFLARE_ACCOUNT_ID");
  if (!CLOUDFLARE_API_TOKEN) console.error("- CLOUDFLARE_API_TOKEN");
  if (!OPENAI_API_KEY) console.error("- OPENAI_API_KEY");
  process.exit(1);
}

if (!GITHUB_TOKEN) {
  console.warn(
    "⚠️  GITHUB_TOKEN not set - rate limit is 60 req/hr (vs 5000 with token)"
  );
  console.warn("   Set GITHUB_TOKEN for faster indexing\n");
}

const octokit = new Octokit({ auth: GITHUB_TOKEN });
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Rate limit handling with exponential backoff
async function withRateLimitRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 5
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const isRateLimit =
        error?.status === 403 ||
        error?.message?.includes("rate limit") ||
        error?.message?.includes("quota exhausted");

      if (isRateLimit && attempt < maxRetries - 1) {
        const waitTime = Math.min(Math.pow(2, attempt) * 1000, 60000); // Max 60s
        console.log(`  ⏳ Rate limited, waiting ${waitTime / 1000}s...`);
        await sleep(waitTime);
        continue;
      }
      throw error;
    }
  }
  throw new Error("Max retries exceeded");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Repositories to index - all high-value Midnight repos
const REPOSITORIES = [
  // Core language & SDK
  { owner: "midnightntwrk", repo: "compact", branch: "main" },
  { owner: "midnightntwrk", repo: "midnight-js", branch: "main" },
  { owner: "midnightntwrk", repo: "midnight-wallet", branch: "main" },
  {
    owner: "midnightntwrk",
    repo: "midnight-dapp-connector-api",
    branch: "main",
  },

  // Core infrastructure (Rust)
  { owner: "midnightntwrk", repo: "midnight-node", branch: "main" },
  { owner: "midnightntwrk", repo: "midnight-indexer", branch: "main" },
  { owner: "midnightntwrk", repo: "midnight-ledger", branch: "main" },
  { owner: "midnightntwrk", repo: "midnight-zk", branch: "main" },

  // Documentation
  { owner: "midnightntwrk", repo: "midnight-docs", branch: "main" },
  {
    owner: "midnightntwrk",
    repo: "midnight-improvement-proposals",
    branch: "main",
  },

  // Examples & templates
  { owner: "midnightntwrk", repo: "example-counter", branch: "main" },
  { owner: "midnightntwrk", repo: "example-bboard", branch: "main" },
  { owner: "midnightntwrk", repo: "example-dex", branch: "main" },
  { owner: "midnightntwrk", repo: "midnight-awesome-dapps", branch: "main" },
  { owner: "midnightntwrk", repo: "create-mn-app", branch: "main" },

  // Third-party libraries
  { owner: "OpenZeppelin", repo: "compact-contracts", branch: "main" },
];

// Timestamp for when this indexing run started
const INDEXED_AT = new Date().toISOString();

interface Document {
  id: string;
  content: string;
  metadata: {
    repository: string;
    filePath: string;
    language: string;
    startLine: number;
    endLine: number;
    indexedAt: string;
  };
}

// File extensions to index
const EXTENSIONS: Record<string, string> = {
  ".compact": "compact",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".rs": "rust",
  ".md": "markdown",
  ".mdx": "markdown",
};

async function getRepoFiles(
  owner: string,
  repo: string,
  branch: string
): Promise<Array<{ path: string; content: string }>> {
  const files: Array<{ path: string; content: string }> = [];
  let fileCount = 0;

  async function fetchDir(path: string = "") {
    try {
      const { data } = await withRateLimitRetry(() =>
        octokit.rest.repos.getContent({
          owner,
          repo,
          path,
          ref: branch,
        })
      );

      if (!Array.isArray(data)) return;

      for (const item of data) {
        if (item.type === "dir") {
          // Skip directories that don't contain useful indexable code
          const skipDirs = [
            // Build outputs
            "node_modules",
            "dist",
            "build",
            "target", // Rust
            ".next",
            "out",

            // Version control & editor config
            ".git",
            ".github", // Workflows not useful for code search
            ".husky",
            ".vscode",
            ".idea",
            ".cargo", // Rust cargo config
            ".config",

            // Caches
            ".cache",
            ".turbo",
            "__pycache__",
            ".parcel-cache",
            ".yarn", // Yarn cache/releases

            // Test artifacts (skip generated output, but KEEP actual test code!)
            "coverage",
            "__snapshots__",
            "__mocks__",

            // Dependencies
            "vendor",

            // Docs redundancy (Docusaurus)
            "versioned_docs",
            "versioned_sidebars",
            "i18n",
            "static", // Images/assets
            "static-html",
            "blog", // Blog posts not useful for API search
            "plugins", // Docusaurus plugins

            // Rust specific
            "benches",

            // Midnight-specific directories (from actual repo inspection)
            ".earthly", // Earthly build system
            ".sqlx", // SQLx query cache
            ".changes_archive",
            ".changes_template",
            ".spellcheck",
            ".tag-decompositions",
            "images", // Docker/diagram images
            "local-environment", // Local dev setup
            "res", // Chain spec resources
            "wasm-proving-demos",
            "build-tools",
            "packages", // midnight-docs test packages

            // From additional repo inspection
            ".node", // midnight-indexer node binaries
            ".changeset", // midnight-wallet changesets
            "infra", // midnight-wallet docker compose
            "mips", // midnight-improvement-proposals (shell files)
            "docs/api", // Generated API docs
          ];
          if (!skipDirs.includes(item.name)) {
            await fetchDir(item.path);
          }
        } else if (item.type === "file") {
          const ext = item.name.substring(item.name.lastIndexOf("."));
          if (EXTENSIONS[ext]) {
            try {
              const { data: fileData } = await withRateLimitRetry(() =>
                octokit.rest.repos.getContent({
                  owner,
                  repo,
                  path: item.path,
                  ref: branch,
                })
              );

              if ("content" in fileData && fileData.content) {
                const content = Buffer.from(
                  fileData.content,
                  "base64"
                ).toString("utf-8");
                files.push({ path: item.path, content });
                fileCount++;
                if (fileCount % 50 === 0) {
                  process.stdout.write(`\r    ${fileCount} files fetched...`);
                }
                // Small delay every 100 files as a safety net
                if (fileCount % 100 === 0) {
                  await sleep(500);
                }
              }
            } catch (e: any) {
              console.warn(
                `\n  ⚠️  Failed to fetch ${item.path}: ${e.message || e}`
              );
            }
          }
        }
      }
    } catch (e: any) {
      console.warn(
        `\n  ⚠️  Failed to fetch directory ${path}: ${e.message || e}`
      );
    }
  }

  await fetchDir();
  if (fileCount > 0) {
    process.stdout.write(`\r    ${fileCount} files fetched ✓\n`);
  }
  return files;
}

function chunkContent(content: string, maxChars: number = 2000): string[] {
  const lines = content.split("\n");
  const chunks: string[] = [];
  let currentChunk = "";

  for (const line of lines) {
    if (
      currentChunk.length + line.length > maxChars &&
      currentChunk.length > 0
    ) {
      chunks.push(currentChunk.trim());
      currentChunk = "";
    }
    currentChunk += line + "\n";
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

async function getEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text.substring(0, 8000), // Limit input size
  });
  return response.data[0].embedding;
}

async function upsertToVectorize(
  vectors: Array<{
    id: string;
    values: number[];
    metadata: Record<string, unknown>;
  }>
) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/vectorize/v2/indexes/${VECTORIZE_INDEX}/upsert`;

  // Vectorize expects NDJSON format
  const ndjson = vectors.map((v) => JSON.stringify(v)).join("\n");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
      "Content-Type": "application/x-ndjson",
    },
    body: ndjson,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Vectorize upsert failed: ${response.status} ${text}`);
  }

  return response.json();
}

async function indexRepository(owner: string, repo: string, branch: string) {
  console.log(`\nIndexing ${owner}/${repo}...`);

  const files = await getRepoFiles(owner, repo, branch);
  console.log(`  Found ${files.length} files`);

  const documents: Document[] = [];
  let docCounter = 0;

  for (const file of files) {
    const ext = file.path.substring(file.path.lastIndexOf("."));
    const language = EXTENSIONS[ext] || "unknown";

    const chunks = chunkContent(file.content);

    for (let i = 0; i < chunks.length; i++) {
      // Use short hash-based ID to stay under 64 bytes
      const shortId = `${repo.substring(0, 10)}-${docCounter++}`;
      documents.push({
        id: shortId,
        content: chunks[i],
        metadata: {
          repository: `${owner}/${repo}`,
          filePath: file.path,
          language,
          startLine: i * 50, // Approximate
          endLine: (i + 1) * 50,
          indexedAt: INDEXED_AT,
        },
      });
    }
  }

  console.log(`  Created ${documents.length} chunks`);

  // Process in batches
  const BATCH_SIZE = 50;
  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const batch = documents.slice(i, i + BATCH_SIZE);
    console.log(
      `  Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(documents.length / BATCH_SIZE)}`
    );

    const vectors = await Promise.all(
      batch.map(async (doc) => {
        const embedding = await getEmbedding(doc.content);
        return {
          id: doc.id,
          values: embedding,
          metadata: {
            ...doc.metadata,
            content: doc.content.substring(0, 1000), // Store truncated content in metadata
          },
        };
      })
    );

    await upsertToVectorize(vectors);

    // Rate limit
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log(`  ✓ Indexed ${documents.length} documents`);
  return { success: true, documents: documents.length };
}

interface IndexResult {
  repo: string;
  success: boolean;
  documents: number;
  error?: string;
}

async function main() {
  console.log("Starting Midnight repository indexing...");
  console.log(`Target: Cloudflare Vectorize index '${VECTORIZE_INDEX}'`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Repos to index: ${REPOSITORIES.length}\n`);

  // Check rate limit before starting
  try {
    const { data: rateLimit } = await octokit.rest.rateLimit.get();
    const remaining = rateLimit.rate.remaining;
    const resetTime = new Date(rateLimit.rate.reset * 1000);
    console.log(
      `GitHub API rate limit: ${remaining}/${rateLimit.rate.limit} remaining`
    );
    console.log(`Resets at: ${resetTime.toISOString()}\n`);

    if (remaining < 500) {
      console.warn(`⚠️  Low rate limit! Waiting until reset...`);
      const waitMs = rateLimit.rate.reset * 1000 - Date.now() + 5000;
      if (waitMs > 0) {
        console.log(`   Waiting ${Math.ceil(waitMs / 60000)} minutes...`);
        await sleep(waitMs);
      }
    }
  } catch (e) {
    console.warn("Could not check rate limit, proceeding anyway...");
  }

  const results: IndexResult[] = [];
  let totalDocs = 0;
  let failedRepos: string[] = [];

  for (const { owner, repo, branch } of REPOSITORIES) {
    const repoName = `${owner}/${repo}`;
    try {
      const result = await indexRepository(owner, repo, branch);
      results.push({
        repo: repoName,
        success: true,
        documents: result.documents,
      });
      totalDocs += result.documents;

      // Small delay between repos (5s) - exponential backoff handles actual rate limits
      await sleep(5000);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`\n❌ Failed to index ${repoName}: ${errorMsg}`);
      results.push({
        repo: repoName,
        success: false,
        documents: 0,
        error: errorMsg,
      });
      failedRepos.push(repoName);
      // Continue with next repo instead of stopping
    }
  }

  // Print summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 INDEXING SUMMARY");
  console.log("=".repeat(50));

  for (const result of results) {
    const status = result.success ? "✅" : "❌";
    const docs = result.success
      ? `${result.documents} docs`
      : result.error?.substring(0, 50);
    console.log(`${status} ${result.repo}: ${docs}`);
  }

  console.log("-".repeat(50));
  console.log(`Total documents indexed: ${totalDocs}`);
  console.log(
    `Successful repos: ${results.filter((r) => r.success).length}/${REPOSITORIES.length}`
  );

  if (failedRepos.length > 0) {
    console.log(`\n⚠️  Failed repos: ${failedRepos.join(", ")}`);
    // Exit with error code if any repos failed (for CI notification)
    process.exit(1);
  }

  console.log("\n✅ Indexing complete!");
}

main().catch((error) => {
  console.error("\n💥 Fatal error:", error);
  process.exit(1);
});
