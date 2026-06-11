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

// Repositories to index - ALL non-archived midnightntwrk repos + community
// Requires MIDNIGHT_GITHUB_TOKEN with org access for private repos
export const REPOSITORIES: RepoConfig[] = [
  // ============================================
  // MIDNIGHTNTWRK ORG - ALL NON-ARCHIVED (95 repos)
  // ============================================

  // Core Language & Compiler
  { owner: "midnightntwrk", repo: "compact", branch: "main" },
  { owner: "midnightntwrk", repo: "compact-lsp", branch: "main" },
  { owner: "midnightntwrk", repo: "compact-tree-sitter", branch: "main" },
  { owner: "midnightntwrk", repo: "compact-zed", branch: "main" },
  { owner: "midnightntwrk", repo: "compact-export", branch: "main" },
  { owner: "midnightntwrk", repo: "compact-integration-suite", branch: "main" },

  // SDKs & APIs
  { owner: "midnightntwrk", repo: "midnight-js", branch: "main" },
  { owner: "midnightntwrk", repo: "midnight-sdk", branch: "main" },
  { owner: "midnightntwrk", repo: "midnight-wallet", branch: "main" },
  { owner: "midnightntwrk", repo: "midnight-wallet-legacy", branch: "main" },
  {
    owner: "midnightntwrk",
    repo: "midnight-dapp-connector-api",
    branch: "main",
  },

  // Core Infrastructure
  { owner: "midnightntwrk", repo: "midnight-node", branch: "main" },
  { owner: "midnightntwrk", repo: "midnight-node-cli", branch: "main" },
  { owner: "midnightntwrk", repo: "midnight-node-docker", branch: "main" },
  { owner: "midnightntwrk", repo: "midnight-indexer", branch: "main" },
  { owner: "midnightntwrk", repo: "midnight-ledger", branch: "main" },
  {
    owner: "midnightntwrk",
    repo: "midnight-formal-ledger-prototype",
    branch: "main",
  },
  { owner: "midnightntwrk", repo: "midnight-zk", branch: "main" },

  // ZK & Cryptography
  { owner: "midnightntwrk", repo: "midnight-trusted-setup", branch: "main" },
  { owner: "midnightntwrk", repo: "fri", branch: "main" },
  { owner: "midnightntwrk", repo: "galois_recursion", branch: "dev" },
  { owner: "midnightntwrk", repo: "pluto_eris", branch: "dev" },
  { owner: "midnightntwrk", repo: "plonk-legacy", branch: "master" },
  { owner: "midnightntwrk", repo: "rs-merkle", branch: "master" },

  // Documentation
  { owner: "midnightntwrk", repo: "midnight-docs", branch: "main" },
  {
    owner: "midnightntwrk",
    repo: "midnight-improvement-proposals",
    branch: "main",
  },
  { owner: "midnightntwrk", repo: "midnight-architecture", branch: "main" },
  { owner: "midnightntwrk", repo: "docteam", branch: "main" },

  // Examples & Templates
  { owner: "midnightntwrk", repo: "example-counter", branch: "main" },
  { owner: "midnightntwrk", repo: "example-bboard", branch: "main" },
  { owner: "midnightntwrk", repo: "example-dex", branch: "main" },
  { owner: "midnightntwrk", repo: "example-DAO", branch: "main" },
  { owner: "midnightntwrk", repo: "example-proofshare", branch: "main" },
  { owner: "midnightntwrk", repo: "example-hello-world", branch: "main" },
  { owner: "midnightntwrk", repo: "example-kitties", branch: "main" },
  { owner: "midnightntwrk", repo: "example-nft-contracts", branch: "main" },
  { owner: "midnightntwrk", repo: "example-locker", branch: "main" },
  { owner: "midnightntwrk", repo: "example-zkloan", branch: "main" },
  { owner: "midnightntwrk", repo: "example-battleship", branch: "main" },
  { owner: "midnightntwrk", repo: "example-private-party", branch: "main" },
  { owner: "midnightntwrk", repo: "midnight-dust-generator", branch: "main" },
  { owner: "midnightntwrk", repo: "midnight-tip-jar", branch: "main" },
  { owner: "midnightntwrk", repo: "midnight-leaderboard", branch: "main" },
  { owner: "midnightntwrk", repo: "midnight-awesome-dapps", branch: "main" },
  { owner: "midnightntwrk", repo: "create-mn-app", branch: "main" },
  { owner: "midnightntwrk", repo: "midnight-template-repo", branch: "main" },

  // Identity & Credentials
  { owner: "midnightntwrk", repo: "midnight-did", branch: "main" },
  { owner: "midnightntwrk", repo: "midnight-did-resolver", branch: "main" },
  {
    owner: "midnightntwrk",
    repo: "midnight-verifiable-credentials",
    branch: "main",
  },
  {
    owner: "midnightntwrk",
    repo: "midnight-identity-oracle-ssi",
    branch: "main",
  },
  {
    owner: "midnightntwrk",
    repo: "midnight-identity-solution-examples",
    branch: "main",
  },

  // Contracts & Bridges
  { owner: "midnightntwrk", repo: "midnight-contracts", branch: "main" },
  {
    owner: "midnightntwrk",
    repo: "midnight-committee-bridge-contracts",
    branch: "main",
  },
  {
    owner: "midnightntwrk",
    repo: "midnight-reserve-contracts",
    branch: "main",
  },

  // Token & Distribution
  { owner: "midnightntwrk", repo: "night-token-distribution", branch: "main" },
  { owner: "midnightntwrk", repo: "midnight-tcnight-mint", branch: "main" },
  {
    owner: "midnightntwrk",
    repo: "midnight-cnight-generates-dust",
    branch: "main",
  },
  {
    owner: "midnightntwrk",
    repo: "midnight-cnight-to-dust-dapp",
    branch: "main",
  },

  // Developer Tools & Actions
  { owner: "midnightntwrk", repo: "setup-compact-action", branch: "main" },
  {
    owner: "midnightntwrk",
    repo: "upload-sarif-github-action",
    branch: "main",
  },
  { owner: "midnightntwrk", repo: "season-action", branch: "main" },
  { owner: "midnightntwrk", repo: "midnight-dev-utils", branch: "main" },
  { owner: "midnightntwrk", repo: "midnight-local-dev", branch: "main" },

  // Infrastructure & Operations
  { owner: "midnightntwrk", repo: "midnight-monitoring", branch: "main" },
  { owner: "midnightntwrk", repo: "midnight-tracing", branch: "main" },
  { owner: "midnightntwrk", repo: "midnight-operations", branch: "main" },
  { owner: "midnightntwrk", repo: "midnight-delivery", branch: "main" },
  { owner: "midnightntwrk", repo: "midnight-faucet", branch: "develop" },
  { owner: "midnightntwrk", repo: "midnight-core-metrics", branch: "main" },

  // Solutions & Applications
  { owner: "midnightntwrk", repo: "midnight-solutions", branch: "main" },
  { owner: "midnightntwrk", repo: "midnight-website-next", branch: "main" },
  { owner: "midnightntwrk", repo: "nightcap", branch: "main" },
  { owner: "midnightntwrk", repo: "aliit-hub", branch: "main" },
  { owner: "midnightntwrk", repo: "ocp", branch: "PoUW" },
  { owner: "midnightntwrk", repo: "season", branch: "main" },
  { owner: "midnightntwrk", repo: "jolteon-initiative-client", branch: "main" },

  // QA & Testing
  { owner: "midnightntwrk", repo: "midnight-qa-demo", branch: "main" },

  // Community & Governance
  { owner: "midnightntwrk", repo: "contributor-hub", branch: "main" },
  {
    owner: "midnightntwrk",
    repo: "lfdt-project-proposals",
    branch: "gh-pages",
  },
  { owner: "midnightntwrk", repo: "UTxO-Scalability", branch: "main" },

  // Glacier Drop (Genesis Distribution)
  {
    owner: "midnightntwrk",
    repo: "midnight-glacier-drop-tools",
    branch: "main",
  },
  { owner: "midnightntwrk", repo: "midnight-gd-ui", branch: "master" },
  { owner: "midnightntwrk", repo: "midnight-gd-operational", branch: "main" },
  { owner: "midnightntwrk", repo: "mgdoc-claim-enablement", branch: "main" },
  { owner: "midnightntwrk", repo: "gd-address-checker", branch: "main" },
  { owner: "midnightntwrk", repo: "gd-claim-api", branch: "main" },
  { owner: "midnightntwrk", repo: "gd-claim-portal", branch: "main" },
  { owner: "midnightntwrk", repo: "gd-hydra-operators", branch: "main" },
  { owner: "midnightntwrk", repo: "gd-infrastructure", branch: "main" },
  { owner: "midnightntwrk", repo: "gd-scavenge", branch: "main" },
  { owner: "midnightntwrk", repo: "gd-scavenger-backend", branch: "main" },
  { owner: "midnightntwrk", repo: "gd-scavenger-frontend", branch: "main" },
  {
    owner: "midnightntwrk",
    repo: "gd-scavenger-ed25519-seed-generator",
    branch: "main",
  },
  { owner: "midnightntwrk", repo: "gd-security", branch: "main" },
  { owner: "midnightntwrk", repo: "gd-testing", branch: "main" },

  // ============================================
  // THIRD-PARTY & COMMUNITY REPOS (20 repos)
  // ============================================

  // OpenZeppelin (Official Partner)
  { owner: "OpenZeppelin", repo: "compact-contracts", branch: "main" },
  { owner: "OpenZeppelin", repo: "midnight-apps", branch: "main" },

  // Official Partners (from awesome-dapps)
  { owner: "bricktowers", repo: "midnight-seabattle", branch: "main" },
  { owner: "bricktowers", repo: "midnight-identity", branch: "main" },
  { owner: "bricktowers", repo: "midnight-rwa", branch: "main" },
  { owner: "MeshJS", repo: "midnight-starter-template", branch: "main" },
  { owner: "midnames", repo: "core", branch: "main" },

  // Sea Battle Hackathon Winners (Feb 2025)
  { owner: "ErickRomeroDev", repo: "naval-battle-game_v2", branch: "main" },
  { owner: "eddex", repo: "midnight-sea-battle-hackathon", branch: "main" },

  // Mini DApp Hackathon Winners (Sep 2025)
  {
    owner: "statera-protocol",
    repo: "statera-protocol-midnight",
    branch: "main",
  },
  { owner: "nel349", repo: "midnight-bank", branch: "main" },

  // Core Partner - PaimaStudios (Gaming Infrastructure)
  { owner: "PaimaStudios", repo: "midnight-game-2", branch: "main" },
  { owner: "PaimaStudios", repo: "midnight-wasm-prover", branch: "main" },
  { owner: "PaimaStudios", repo: "midnight-batcher", branch: "main" },
  {
    owner: "PaimaStudios",
    repo: "midnight-impact-rps-example",
    branch: "main",
  },

  // Community Examples & Learning Resources (Olanetsoft)
  { owner: "Olanetsoft", repo: "midnight-mcp", branch: "main" },
  { owner: "Olanetsoft", repo: "compact-playground", branch: "main" },
  { owner: "Olanetsoft", repo: "compact-by-example", branch: "main" },
  { owner: "Olanetsoft", repo: "learn-compact", branch: "main" },
  { owner: "Olanetsoft", repo: "example-dust-sponsorship", branch: "main" },
];
