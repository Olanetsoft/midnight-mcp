import { ChromaClient, Collection } from "chromadb";
import OpenAI from "openai";
import { config } from "./config.js";

let client: ChromaClient | null = null;
let collection: Collection | null = null;
let openai: OpenAI | null = null;

/**
 * Initialize ChromaDB connection
 */
export async function initChroma(): Promise<Collection> {
  if (collection) return collection;

  client = new ChromaClient({
    path: `http://${config.chromaHost}:${config.chromaPort}`,
  });

  collection = await client.getOrCreateCollection({
    name: config.collectionName,
    metadata: {
      description: "Midnight blockchain code and documentation",
    },
  });

  console.log(`ChromaDB collection "${config.collectionName}" ready`);
  return collection;
}

/**
 * Initialize OpenAI client
 */
export function initOpenAI(): OpenAI {
  if (openai) return openai;

  openai = new OpenAI({
    apiKey: config.openaiApiKey,
  });

  return openai;
}

/**
 * Generate embeddings for text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const ai = initOpenAI();

  const response = await ai.embeddings.create({
    model: config.embeddingModel,
    input: text,
    dimensions: config.embeddingDimensions,
  });

  return response.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts (batched)
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const ai = initOpenAI();

  // OpenAI supports batch embedding
  const response = await ai.embeddings.create({
    model: config.embeddingModel,
    input: texts,
    dimensions: config.embeddingDimensions,
  });

  return response.data.map((d) => d.embedding);
}

export interface CodeDocument {
  id: string;
  content: string;
  metadata: {
    repository: string;
    filePath: string;
    language: string;
    codeType: string;
    codeName: string;
    startLine: number;
    endLine: number;
    isPublic: boolean;
  };
}

/**
 * Add documents to the vector store
 */
export async function addDocuments(documents: CodeDocument[]): Promise<void> {
  const coll = await initChroma();

  // Generate embeddings in batches
  const batchSize = 100;
  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);
    const texts = batch.map((d) => d.content);
    const embeddings = await generateEmbeddings(texts);

    await coll.add({
      ids: batch.map((d) => d.id),
      embeddings,
      documents: texts,
      metadatas: batch.map(
        (d) => d.metadata as Record<string, string | number | boolean>
      ),
    });

    console.log(`Indexed ${i + batch.length}/${documents.length} documents`);
  }
}

export interface SearchResult {
  content: string;
  score: number;
  metadata: CodeDocument["metadata"];
}

export interface SearchFilter {
  language?: string;
  repository?: string;
  codeType?: string;
}

/**
 * Search the vector store
 */
export async function search(
  query: string,
  limit: number = 10,
  filter?: SearchFilter
): Promise<SearchResult[]> {
  const coll = await initChroma();
  const queryEmbedding = await generateEmbedding(query);

  // Build ChromaDB where filter
  const where: Record<string, unknown> = {};
  if (filter?.language) {
    where["language"] = filter.language;
  }
  if (filter?.repository) {
    where["repository"] = filter.repository;
  }
  if (filter?.codeType) {
    where["codeType"] = filter.codeType;
  }

  const results = await coll.query({
    queryEmbeddings: [queryEmbedding],
    nResults: limit,
    where: Object.keys(where).length > 0 ? where : undefined,
  });

  if (!results.documents?.[0]) {
    return [];
  }

  return results.documents[0].map((doc, i) => ({
    content: doc || "",
    score: results.distances?.[0]?.[i] ? 1 - results.distances[0][i] : 0,
    metadata: results.metadatas?.[0]?.[
      i
    ] as unknown as CodeDocument["metadata"],
  }));
}

/**
 * Get collection stats
 */
export async function getStats(): Promise<{ count: number }> {
  const coll = await initChroma();
  const count = await coll.count();
  return { count };
}

/**
 * Clear all documents
 */
export async function clearCollection(): Promise<void> {
  if (!client) {
    client = new ChromaClient({
      path: `http://${config.chromaHost}:${config.chromaPort}`,
    });
  }

  await client.deleteCollection({ name: config.collectionName });
  collection = null;
  console.log(`Collection "${config.collectionName}" cleared`);
}
