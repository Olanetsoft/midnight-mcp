/**
 * OpenAI embeddings service
 */

import type { EmbeddingResponse } from "../interfaces";

/**
 * Generate embedding using OpenAI API
 */
export async function getEmbedding(
  text: string,
  apiKey: string
): Promise<number[]> {
  // Truncate input to prevent abuse (max ~8k tokens)
  const truncatedText = text.slice(0, 8000);

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: truncatedText,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = (await response.json()) as EmbeddingResponse;
  return data.data[0].embedding;
}
