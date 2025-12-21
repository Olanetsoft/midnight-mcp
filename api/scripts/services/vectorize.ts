/**
 * Cloudflare Vectorize service
 */

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN!;
const VECTORIZE_INDEX = "midnight-code";

interface VectorData {
  id: string;
  values: number[];
  metadata: Record<string, unknown>;
}

/**
 * Delete vectors by IDs from Vectorize
 */
export async function deleteVectors(ids: string[]): Promise<void> {
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

/**
 * Upsert vectors to Vectorize (batched)
 */
export async function upsertToVectorize(
  vectors: VectorData[]
): Promise<unknown> {
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
