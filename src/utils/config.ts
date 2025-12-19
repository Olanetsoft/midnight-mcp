import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const ConfigSchema = z.object({
  // Mode: 'hosted' (default) or 'local'
  mode: z.enum(["hosted", "local"]).default("hosted"),

  // Hosted API URL (used when mode is 'hosted')
  hostedApiUrl: z.string().default("https://api.midnight-mcp.dev"),

  // GitHub
  githubToken: z.string().optional(),

  // Vector Database (only needed for local mode)
  chromaUrl: z.string().default("http://localhost:8000"),

  // Embeddings (only needed for local mode)
  openaiApiKey: z.string().optional(),
  embeddingModel: z.string().default("text-embedding-3-small"),

  // Server
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  syncInterval: z.number().default(900000), // 15 minutes
  port: z.number().default(3000),

  // Data directories
  dataDir: z.string().default("./data"),
  cacheDir: z.string().default("./cache"),
});

export type Config = z.infer<typeof ConfigSchema>;

function loadConfig(): Config {
  // Determine mode: local if MIDNIGHT_LOCAL=true or if OPENAI_API_KEY is set
  const isLocalMode =
    process.env.MIDNIGHT_LOCAL === "true" ||
    (process.env.OPENAI_API_KEY && process.env.CHROMA_URL);

  const rawConfig = {
    mode: isLocalMode ? "local" : "hosted",
    hostedApiUrl: process.env.MIDNIGHT_API_URL,
    githubToken: process.env.GITHUB_TOKEN,
    chromaUrl: process.env.CHROMA_URL,
    openaiApiKey: process.env.OPENAI_API_KEY,
    embeddingModel: process.env.EMBEDDING_MODEL,
    logLevel: process.env.LOG_LEVEL,
    syncInterval: process.env.SYNC_INTERVAL
      ? parseInt(process.env.SYNC_INTERVAL)
      : undefined,
    port: process.env.PORT ? parseInt(process.env.PORT) : undefined,
    dataDir: process.env.DATA_DIR,
    cacheDir: process.env.CACHE_DIR,
  };

  // Remove undefined values
  const cleanConfig = Object.fromEntries(
    Object.entries(rawConfig).filter(([_, v]) => v !== undefined)
  );

  return ConfigSchema.parse(cleanConfig);
}

export const config = loadConfig();

/**
 * Check if running in hosted mode (default)
 */
export function isHostedMode(): boolean {
  return config.mode === "hosted";
}

/**
 * Check if running in local mode
 */
export function isLocalMode(): boolean {
  return config.mode === "local";
}

// Repository configuration
export interface RepositoryConfig {
  owner: string;
  repo: string;
  branch: string;
  patterns: string[];
  exclude: string[];
}

export const DEFAULT_REPOSITORIES: RepositoryConfig[] = [
  // Core Language & SDK
  {
    owner: "midnightntwrk",
    repo: "compact",
    branch: "main",
    patterns: ["**/*.compact", "**/*.ts", "**/*.md"],
    exclude: ["node_modules/**", "dist/**"],
  },
  {
    owner: "midnightntwrk",
    repo: "midnight-js",
    branch: "main",
    patterns: ["**/*.ts", "**/*.md"],
    exclude: ["node_modules/**", "dist/**"],
  },

  // Documentation
  {
    owner: "midnightntwrk",
    repo: "midnight-docs",
    branch: "main",
    patterns: ["**/*.md", "**/*.mdx"],
    exclude: ["node_modules/**"],
  },

  // Example DApps
  {
    owner: "midnightntwrk",
    repo: "example-counter",
    branch: "main",
    patterns: ["**/*.compact", "**/*.ts", "**/*.md"],
    exclude: ["node_modules/**", "dist/**"],
  },
  {
    owner: "midnightntwrk",
    repo: "example-bboard",
    branch: "main",
    patterns: ["**/*.compact", "**/*.ts", "**/*.tsx", "**/*.md"],
    exclude: ["node_modules/**", "dist/**"],
  },
  {
    owner: "midnightntwrk",
    repo: "example-dex",
    branch: "main",
    patterns: ["**/*.compact", "**/*.ts", "**/*.tsx", "**/*.md"],
    exclude: ["node_modules/**", "dist/**"],
  },

  // Developer Tools
  {
    owner: "midnightntwrk",
    repo: "create-mn-app",
    branch: "main",
    patterns: ["**/*.ts", "**/*.md", "**/*.json"],
    exclude: ["node_modules/**", "dist/**"],
  },
  {
    owner: "midnightntwrk",
    repo: "midnight-wallet",
    branch: "main",
    patterns: ["**/*.ts", "**/*.tsx", "**/*.md"],
    exclude: ["node_modules/**", "dist/**"],
  },

  // Infrastructure
  {
    owner: "midnightntwrk",
    repo: "midnight-indexer",
    branch: "main",
    patterns: ["**/*.ts", "**/*.md", "**/*.rs"],
    exclude: ["node_modules/**", "dist/**", "target/**"],
  },
  {
    owner: "midnightntwrk",
    repo: "midnight-node-docker",
    branch: "main",
    patterns: ["**/*.md", "**/Dockerfile", "**/*.yml", "**/*.yaml"],
    exclude: [],
  },

  // APIs & Connectors
  {
    owner: "midnightntwrk",
    repo: "midnight-dapp-connector-api",
    branch: "main",
    patterns: ["**/*.ts", "**/*.md"],
    exclude: ["node_modules/**", "dist/**"],
  },

  // Tooling
  {
    owner: "midnightntwrk",
    repo: "compact-tree-sitter",
    branch: "main",
    patterns: ["**/*.js", "**/*.md", "**/*.scm"],
    exclude: ["node_modules/**"],
  },

  // Community
  {
    owner: "midnightntwrk",
    repo: "midnight-awesome-dapps",
    branch: "main",
    patterns: ["**/*.md"],
    exclude: [],
  },
  {
    owner: "midnightntwrk",
    repo: "contributor-hub",
    branch: "main",
    patterns: ["**/*.md"],
    exclude: [],
  },

  // Partner Libraries
  {
    owner: "OpenZeppelin",
    repo: "compact-contracts",
    branch: "main",
    patterns: ["**/*.compact", "**/*.ts", "**/*.md"],
    exclude: ["node_modules/**", "dist/**"],
  },
];
