/**
 * Script to index Midnight repositories into Cloudflare Vectorize
 * Run locally with: npm run index
 *
 * Optimizations:
 * - Downloads repo as tarball (1 request vs hundreds)
 * - Batches Vectorize inserts (100 vectors per call)
 * - Incremental indexing (skips unchanged files via SHA tracking)
 *
 * Requires:
 * - OPENAI_API_KEY env var
 * - CLOUDFLARE_API_TOKEN env var
 * - CLOUDFLARE_ACCOUNT_ID env var
 * - GITHUB_TOKEN env var (recommended - increases rate limit from 60 to 5000 req/hr)
 */

import { config } from "dotenv";
import { resolve } from "path";
import * as tarStream from "tar-stream";
import { createGunzip } from "zlib";
import { Readable } from "stream";
import { createHash } from "crypto";

// Load .env from parent directory (project root)
config({ path: resolve(__dirname, "../../.env") });

import OpenAI from "openai";

const VECTORIZE_INDEX = "midnight-code";
const KV_NAMESPACE_ID = "adc06e61998c417684ee353791077992"; // METRICS namespace, reuse for SHA cache

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

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Check if force reindex is requested
const FORCE_REINDEX = process.env.FORCE_REINDEX === "true";

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

  // ZK & cryptography
  { owner: "midnightntwrk", repo: "halo2", branch: "main" },
  { owner: "midnightntwrk", repo: "midnight-trusted-setup", branch: "main" },

  // Developer tools
  { owner: "midnightntwrk", repo: "compact-tree-sitter", branch: "main" },
  { owner: "midnightntwrk", repo: "compact-zed", branch: "main" },
  { owner: "midnightntwrk", repo: "setup-compact-action", branch: "main" },
  { owner: "midnightntwrk", repo: "midnight-node-docker", branch: "main" },

  // Community & governance
  { owner: "midnightntwrk", repo: "contributor-hub", branch: "main" },
  { owner: "midnightntwrk", repo: "night-token-distribution", branch: "main" },

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

// Directories to skip
const SKIP_DIRS = new Set([
  // Build outputs
  "node_modules",
  "dist",
  "build",
  "target",
  ".next",
  "out",

  // Version control & editor config
  ".git",
  ".github",
  ".husky",
  ".vscode",
  ".idea",
  ".cargo",
  ".config",

  // Caches
  ".cache",
  ".turbo",
  "__pycache__",
  ".parcel-cache",
  ".yarn",

  // Test artifacts
  "coverage",
  "__snapshots__",
  "__mocks__",

  // Dependencies
  "vendor",

  // Docs redundancy (keep versioned docs out, but include blog)
  "versioned_docs",
  "versioned_sidebars",
  "i18n",
  "static",
  "static-html",
  "plugins",

  // Rust specific
  "benches",

  // Midnight-specific
  ".earthly",
  ".sqlx",
  ".changes_archive",
  ".changes_template",
  ".spellcheck",
  ".tag-decompositions",
  "images",
  "local-environment",
  "res",
  "wasm-proving-demos",
  "build-tools",
  "packages",
  ".node",
  ".changeset",
  "infra",
  "mips",
]);

// ============== KV CACHE FOR INCREMENTAL INDEXING ==============

interface FileCacheEntry {
  hash: string;
  vectorIds: string[]; // Track vector IDs for cleanup
}

interface FileCache {
  [filePath: string]: FileCacheEntry;
}

async function getFileCache(repoKey: string): Promise<FileCache> {
  // Skip cache if force reindex is requested
  if (FORCE_REINDEX) {
    return {};
  }

  try {
    const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/index-cache:${repoKey}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}` },
    });
    if (response.ok) {
      return await response.json();
    }
  } catch (e) {
    // Cache miss or error - return empty
  }
  return {};
}

async function setFileCache(repoKey: string, cache: FileCache): Promise<void> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/index-cache:${repoKey}`;
  await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cache),
  });
}

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex").substring(0, 16);
}

// ============== VECTOR CLEANUP ==============

async function deleteVectors(ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/vectorize/v2/indexes/${VECTORIZE_INDEX}/delete_by_ids`;

  // Delete in batches of 100
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids: batch }),
    });

    if (!response.ok) {
      console.warn(`  ⚠️ Failed to delete vectors: ${response.status}`);
    }
  }
}

// ============== TARBALL DOWNLOAD (FAST!) ==============

async function getRepoFilesFast(
  owner: string,
  repo: string,
  branch: string,
  existingCache: FileCache
): Promise<{
  files: Array<{ path: string; content: string }>;
  newCache: FileCache;
  skipped: number;
}> {
  const files: Array<{ path: string; content: string }> = [];
  const newCache: FileCache = {};
  let skipped = 0;

  console.log(`  📦 Downloading tarball...`);

  // Download tarball (single HTTP request!)
  const tarballUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.tar.gz`;
  const response = await fetch(tarballUrl, {
    headers: GITHUB_TOKEN ? { Authorization: `token ${GITHUB_TOKEN}` } : {},
  });

  if (!response.ok) {
    throw new Error(`Failed to download tarball: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  console.log(
    `  📦 Downloaded ${(buffer.length / 1024 / 1024).toFixed(2)} MB, extracting...`
  );

  // Parse tarball in memory using tar-stream
  return new Promise((resolve, reject) => {
    const entries: Array<{ path: string; content: string }> = [];

    const extract = tarStream.extract();

    extract.on("entry", (header, stream, next) => {
      const chunks: Buffer[] = [];

      // Remove the repo-branch prefix from path (e.g., "compact-main/src/..." -> "src/...")
      const fullPath = header.name || "";
      const pathParts = fullPath.split("/");
      pathParts.shift(); // Remove first segment (repo-branch)
      const relativePath = pathParts.join("/");

      // Check if this file should be processed
      const shouldProcess =
        header.type === "file" &&
        relativePath &&
        !shouldSkipPath(relativePath) &&
        hasValidExtension(relativePath);

      if (shouldProcess) {
        stream.on("data", (chunk) => chunks.push(chunk));
        stream.on("end", () => {
          const content = Buffer.concat(chunks).toString("utf-8");
          const contentHash = hashContent(content);

          // Check if file changed (incremental indexing)
          const existing = existingCache[relativePath];
          if (existing && existing.hash === contentHash) {
            skipped++;
            newCache[relativePath] = existing; // Keep existing entry with vector IDs
          } else {
            entries.push({ path: relativePath, content });
            // Will be filled in after vectorization
            newCache[relativePath] = { hash: contentHash, vectorIds: [] };
          }
          next();
        });
        stream.on("error", next);
      } else {
        // Drain the stream and move to next entry
        stream.on("end", next);
        stream.resume();
      }
    });

    extract.on("finish", () => {
      console.log(
        `  ✓ Extracted ${entries.length} files (${skipped} unchanged, skipped)`
      );
      resolve({ files: entries, newCache, skipped });
    });

    extract.on("error", reject);

    // Pipe buffer through gunzip then tar extract
    const gunzip = createGunzip();

    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);

    readable.pipe(gunzip).pipe(extract);
  });
}

function shouldSkipPath(path: string): boolean {
  const parts = path.split("/");
  return parts.some((part) => SKIP_DIRS.has(part));
}

function hasValidExtension(path: string): boolean {
  const ext = path.substring(path.lastIndexOf("."));
  return ext in EXTENSIONS;
}

// ============== CHUNKING ==============

/**
 * Chunk content with overlap for better context continuity
 * @param content - The content to chunk
 * @param maxChars - Maximum characters per chunk (default 1000)
 * @param overlapChars - Characters to overlap between chunks (default 200)
 */
function chunkContent(
  content: string,
  maxChars: number = 1000,
  overlapChars: number = 200
): string[] {
  const lines = content.split("\n");
  const chunks: string[] = [];
  let currentChunk = "";
  let overlapBuffer = ""; // Store last N chars for overlap

  for (const line of lines) {
    if (
      currentChunk.length + line.length > maxChars &&
      currentChunk.length > 0
    ) {
      chunks.push(currentChunk.trim());

      // Keep overlap from end of current chunk
      overlapBuffer = currentChunk.slice(-overlapChars);
      currentChunk = overlapBuffer;
    }
    currentChunk += line + "\n";
  }

  if (currentChunk.trim() && currentChunk.trim() !== overlapBuffer.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// ============== EMBEDDINGS ==============

async function getEmbeddings(texts: string[]): Promise<number[][]> {
  // OpenAI supports batch embeddings
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: texts.map((t) => t.substring(0, 8000)),
  });
  return response.data.map((d) => d.embedding);
}

// ============== VECTORIZE (BATCHED!) ==============

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

// ============== MAIN INDEXING ==============

async function indexRepository(owner: string, repo: string, branch: string) {
  console.log(`\n📂 Indexing ${owner}/${repo}...`);

  const repoKey = `${owner}/${repo}`;

  // Get existing cache for incremental indexing
  const existingCache = await getFileCache(repoKey);
  const cacheSize = Object.keys(existingCache).length;
  if (cacheSize > 0) {
    console.log(`  📋 Found cache with ${cacheSize} file hashes`);
  }

  // Download and extract repo (FAST!)
  const { files, newCache, skipped } = await getRepoFilesFast(
    owner,
    repo,
    branch,
    existingCache
  );

  // Find deleted files and their vector IDs to clean up
  const currentFilePaths = new Set(Object.keys(newCache));
  const deletedVectorIds: string[] = [];
  for (const [filePath, entry] of Object.entries(existingCache)) {
    if (!currentFilePaths.has(filePath) && entry.vectorIds) {
      deletedVectorIds.push(...entry.vectorIds);
    }
  }

  // Also collect vector IDs from changed files (will be replaced)
  for (const file of files) {
    const existing = existingCache[file.path];
    if (existing && existing.vectorIds) {
      deletedVectorIds.push(...existing.vectorIds);
    }
  }

  if (deletedVectorIds.length > 0) {
    console.log(
      `  🗑️  Cleaning up ${deletedVectorIds.length} stale vectors...`
    );
    await deleteVectors(deletedVectorIds);
  }

  if (files.length === 0) {
    // Still need to save cache to reflect deleted files
    await setFileCache(repoKey, newCache);
    console.log(`  ⏭️  No changed files, skipping`);
    return {
      success: true,
      documents: 0,
      skipped,
      deleted: deletedVectorIds.length,
    };
  }

  // Create document chunks and track vector IDs per file
  const documents: Document[] = [];
  const fileVectorIds: Map<string, string[]> = new Map();
  let docCounter = 0;

  for (const file of files) {
    const ext = file.path.substring(file.path.lastIndexOf("."));
    const language = EXTENSIONS[ext] || "unknown";

    const chunks = chunkContent(file.content);
    const vectorIds: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const shortId = `${repo.substring(0, 10)}-${docCounter++}`;
      vectorIds.push(shortId);
      documents.push({
        id: shortId,
        content: chunks[i],
        metadata: {
          repository: repoKey,
          filePath: file.path,
          language,
          startLine: i * 50,
          endLine: (i + 1) * 50,
          indexedAt: INDEXED_AT,
        },
      });
    }

    fileVectorIds.set(file.path, vectorIds);
  }

  console.log(
    `  📄 Created ${documents.length} chunks from ${files.length} files`
  );

  // Process in larger batches (100 embeddings at a time, 100 vectors per upsert)
  const BATCH_SIZE = 100;
  let totalProcessed = 0;

  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const batch = documents.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(documents.length / BATCH_SIZE);

    process.stdout.write(
      `\r  ⚡ Processing batch ${batchNum}/${totalBatches}...`
    );

    // Batch embedding call (much faster!)
    const embeddings = await getEmbeddings(batch.map((d) => d.content));

    const vectors = batch.map((doc, idx) => ({
      id: doc.id,
      values: embeddings[idx],
      metadata: {
        ...doc.metadata,
        content: doc.content.substring(0, 1000),
      },
    }));

    // Batch upsert to Vectorize
    await upsertToVectorize(vectors);
    totalProcessed += batch.length;

    // Small delay to avoid OpenAI rate limits
    if (i + BATCH_SIZE < documents.length) {
      await sleep(500);
    }
  }

  console.log(`\r  ✅ Indexed ${totalProcessed} documents                    `);

  // Update cache with vector IDs for cleanup on next run
  fileVectorIds.forEach((vectorIds, filePath) => {
    if (newCache[filePath]) {
      newCache[filePath].vectorIds = vectorIds;
    }
  });
  await setFileCache(repoKey, newCache);

  return {
    success: true,
    documents: documents.length,
    skipped,
    deleted: deletedVectorIds.length,
  };
}

interface IndexResult {
  repo: string;
  success: boolean;
  documents: number;
  skipped: number;
  deleted: number;
  error?: string;
}

async function main() {
  console.log("🚀 Starting Midnight repository indexing (FAST MODE)");
  console.log("=".repeat(50));
  console.log(`Target: Cloudflare Vectorize index '${VECTORIZE_INDEX}'`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Repos to index: ${REPOSITORIES.length}`);
  if (FORCE_REINDEX) {
    console.log(
      `⚠️  FORCE REINDEX enabled - ignoring cache, reprocessing all files`
    );
  }
  console.log(
    `Optimizations: Tarball download, Batch embeddings${FORCE_REINDEX ? "" : ", Incremental"}\n`
  );

  const results: IndexResult[] = [];
  let totalDocs = 0;
  let totalSkipped = 0;
  let totalDeleted = 0;
  let failedRepos: string[] = [];

  for (const { owner, repo, branch } of REPOSITORIES) {
    const repoName = `${owner}/${repo}`;
    try {
      const result = await indexRepository(owner, repo, branch);
      results.push({
        repo: repoName,
        success: true,
        documents: result.documents,
        skipped: result.skipped,
        deleted: result.deleted,
      });
      totalDocs += result.documents;
      totalSkipped += result.skipped;
      totalDeleted += result.deleted;

      // Small delay between repos
      await sleep(2000);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`\n❌ Failed to index ${repoName}: ${errorMsg}`);
      results.push({
        repo: repoName,
        success: false,
        documents: 0,
        skipped: 0,
        deleted: 0,
        error: errorMsg,
      });
      failedRepos.push(repoName);
    }
  }

  // Print summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 INDEXING SUMMARY");
  console.log("=".repeat(50));

  for (const result of results) {
    const status = result.success ? "✅" : "❌";
    if (result.success) {
      const skipInfo =
        result.skipped > 0 ? `, ${result.skipped} unchanged` : "";
      const deleteInfo =
        result.deleted > 0 ? `, ${result.deleted} cleaned` : "";
      console.log(
        `${status} ${result.repo}: ${result.documents} docs${skipInfo}${deleteInfo}`
      );
    } else {
      console.log(
        `${status} ${result.repo}: ${result.error?.substring(0, 50)}`
      );
    }
  }

  console.log("-".repeat(50));
  console.log(`📄 Total documents indexed: ${totalDocs}`);
  console.log(`⏭️  Total files skipped (unchanged): ${totalSkipped}`);
  console.log(`🗑️  Total stale vectors deleted: ${totalDeleted}`);
  console.log(
    `✅ Successful repos: ${results.filter((r) => r.success).length}/${REPOSITORIES.length}`
  );

  if (failedRepos.length > 0) {
    console.log(`\n⚠️  Failed repos: ${failedRepos.join(", ")}`);
    process.exit(1);
  }

  console.log("\n🎉 Indexing complete!");
}

main().catch((error) => {
  console.error("\n💥 Fatal error:", error);
  process.exit(1);
});
