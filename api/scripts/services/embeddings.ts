/**
 * OpenAI embeddings service
 */

import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Get embeddings for multiple texts (batch API call)
 */
export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: texts.map((t) => t.substring(0, 8000)),
  });
  return response.data.map((d) => d.embedding);
}
