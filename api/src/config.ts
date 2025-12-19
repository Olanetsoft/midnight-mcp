import "dotenv/config";

export const config = {
  // Server
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",

  // OpenAI
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  embeddingModel: "text-embedding-3-small",
  embeddingDimensions: 1536,

  // GitHub
  githubToken: process.env.GITHUB_TOKEN || "",

  // ChromaDB
  chromaHost: process.env.CHROMA_HOST || "localhost",
  chromaPort: parseInt(process.env.CHROMA_PORT || "8000", 10),
  collectionName: "midnight-code",

  // Rate limiting
  rateLimitPerMinute: parseInt(process.env.RATE_LIMIT_PER_MINUTE || "60", 10),

  // Repositories to index
  repositories: [
    { owner: "midnightntwrk", repo: "compact", branch: "main" },
    { owner: "midnightntwrk", repo: "midnight-js", branch: "main" },
    { owner: "midnightntwrk", repo: "example-counter", branch: "main" },
    { owner: "midnightntwrk", repo: "example-bboard", branch: "main" },
    { owner: "midnightntwrk", repo: "example-token", branch: "main" },
    { owner: "midnightntwrk", repo: "example-voting", branch: "main" },
    { owner: "midnightntwrk", repo: "example-basic-wallet", branch: "main" },
    { owner: "midnightntwrk", repo: "example-nft", branch: "main" },
    { owner: "midnightntwrk", repo: "example-welcome", branch: "main" },
    { owner: "midnightntwrk", repo: "midnight-vscode", branch: "main" },
    { owner: "midnightntwrk", repo: "lace-wallet-midnight", branch: "main" },
    { owner: "OpenZeppelin", repo: "compact-contracts", branch: "main" },
  ],
};

// Validate required config
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.openaiApiKey) {
    errors.push("OPENAI_API_KEY is required");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
