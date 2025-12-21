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

// Load .env from parent directory (project root)
config({ path: resolve(__dirname, "../../.env") });

import type { Document, IndexResult, FileCache } from "./interfaces";
import { REPOSITORIES } from "./constants";
import { chunkContent, getLanguageFromPath, sleep } from "./utils";
import {
  getFileCache,
  setFileCache,
  deleteVectors,
  upsertToVectorize,
  getEmbeddings,
  getRepoFilesFast,
} from "./services";

// Validate required environment variables
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const FORCE_REINDEX = process.env.FORCE_REINDEX === "true";

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

// Timestamp for when this indexing run started
const INDEXED_AT = new Date().toISOString();

/**
 * Index a single repository
 */
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
    const language = getLanguageFromPath(file.path);
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

/**
 * Main entry point
 */
async function main() {
  console.log("🚀 Starting Midnight repository indexing (FAST MODE)");
  console.log("=".repeat(50));
  console.log(`Target: Cloudflare Vectorize index 'midnight-code'`);
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
