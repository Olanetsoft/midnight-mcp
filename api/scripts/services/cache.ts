/**
 * Cloudflare KV cache service for incremental indexing
 */

import type { FileCache } from "../interfaces";

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN!;
const KV_NAMESPACE_ID = "adc06e61998c417684ee353791077992";
const FORCE_REINDEX = process.env.FORCE_REINDEX === "true";

/**
 * Get file cache from KV for incremental indexing
 */
export async function getFileCache(repoKey: string): Promise<FileCache> {
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

/**
 * Save file cache to KV
 */
export async function setFileCache(
  repoKey: string,
  cache: FileCache
): Promise<void> {
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
