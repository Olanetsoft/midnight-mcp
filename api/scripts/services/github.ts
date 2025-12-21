/**
 * GitHub tarball download and extraction service
 */

import * as tarStream from "tar-stream";
import { createGunzip } from "zlib";
import { Readable } from "stream";
import type { FileCache, ExtractionResult } from "../interfaces";
import { shouldSkipPath, hasValidExtension, hashContent } from "../utils";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

/**
 * Download and extract repository files from GitHub tarball
 * Much faster than individual file API calls
 */
export async function getRepoFilesFast(
  owner: string,
  repo: string,
  branch: string,
  existingCache: FileCache
): Promise<ExtractionResult> {
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

    // Ensure errors from all streams propagate
    readable.on("error", reject);
    gunzip.on("error", reject);

    readable.pipe(gunzip).pipe(extract);
  });
}
