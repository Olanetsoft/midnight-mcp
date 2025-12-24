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

  // Third-party libraries (OpenZeppelin)
  { owner: "OpenZeppelin", repo: "compact-contracts", branch: "main" },
  { owner: "OpenZeppelin", repo: "midnight-apps", branch: "main" }, // LunarSwap DEX

  // Official Partners (from awesome-dapps)
  { owner: "bricktowers", repo: "midnight-seabattle", branch: "main" }, // Gaming - 1st place Sea Battle hackathon
  { owner: "bricktowers", repo: "midnight-identity", branch: "main" }, // ZK Identity
  { owner: "bricktowers", repo: "midnight-rwa", branch: "main" }, // Real World Assets
  { owner: "MeshJS", repo: "midnight-starter-template", branch: "main" }, // Starter template
  { owner: "midnames", repo: "core", branch: "main" }, // DID registry

  // Sea Battle Hackathon Winners (Feb 2025)
  { owner: "ErickRomeroDev", repo: "naval-battle-game_v2", branch: "main" }, // 2nd place - Edda Labs
  { owner: "eddex", repo: "midnight-sea-battle-hackathon", branch: "main" }, // 3rd place - ShipySpace

  // Mini DApp Hackathon Winners (Sep 2025)
  {
    owner: "statera-protocol",
    repo: "statera-protocol-midnight",
    branch: "main",
  }, // 1st place - LucentLabs (stablecoin)
  { owner: "nel349", repo: "midnight-bank", branch: "main" }, // 2nd place - Private banking
  { owner: "Imdavyking", repo: "zkbadge", branch: "main" }, // 3rd place - ZK identity badges

  // Core Partner - PaimaStudios (Gaming Infrastructure)
  { owner: "PaimaStudios", repo: "midnight-game-2", branch: "main" }, // Full production game
  { owner: "PaimaStudios", repo: "midnight-wasm-prover", branch: "main" }, // Browser WASM prover
  { owner: "PaimaStudios", repo: "midnight-batcher", branch: "main" }, // Transaction batcher
  {
    owner: "PaimaStudios",
    repo: "midnight-impact-rps-example",
    branch: "main",
  }, // Low-level Impact VM example
];
