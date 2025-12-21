/**
 * Configuration constants for the indexing script
 */

import type { RepoConfig } from "../interfaces";

// Cloudflare resource IDs
export const VECTORIZE_INDEX = "midnight-code";
export const KV_NAMESPACE_ID = "adc06e61998c417684ee353791077992";

// File extensions to index with their language mappings
export const EXTENSIONS: Record<string, string> = {
  ".compact": "compact",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".rs": "rust",
  ".md": "markdown",
  ".mdx": "markdown",
};

// Directories to skip during indexing
export const SKIP_DIRS = new Set([
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

// Repositories to index - all high-value Midnight repos
export const REPOSITORIES: RepoConfig[] = [
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
