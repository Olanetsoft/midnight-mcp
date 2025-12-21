/**
 * Repository constants
 * Aliases, example definitions, and configuration data
 */

// Repository name mapping
export const REPO_ALIASES: Record<string, { owner: string; repo: string }> = {
  // Core Language & SDK
  compact: { owner: "midnightntwrk", repo: "compact" },
  "midnight-js": { owner: "midnightntwrk", repo: "midnight-js" },
  js: { owner: "midnightntwrk", repo: "midnight-js" },
  sdk: { owner: "midnightntwrk", repo: "midnight-js" },

  // Documentation
  docs: { owner: "midnightntwrk", repo: "midnight-docs" },
  "midnight-docs": { owner: "midnightntwrk", repo: "midnight-docs" },

  // Example DApps
  "example-counter": { owner: "midnightntwrk", repo: "example-counter" },
  counter: { owner: "midnightntwrk", repo: "example-counter" },
  "example-bboard": { owner: "midnightntwrk", repo: "example-bboard" },
  bboard: { owner: "midnightntwrk", repo: "example-bboard" },
  "example-dex": { owner: "midnightntwrk", repo: "example-dex" },
  dex: { owner: "midnightntwrk", repo: "example-dex" },

  // Developer Tools
  "create-mn-app": { owner: "midnightntwrk", repo: "create-mn-app" },
  "midnight-wallet": { owner: "midnightntwrk", repo: "midnight-wallet" },
  wallet: { owner: "midnightntwrk", repo: "midnight-wallet" },

  // Infrastructure
  "midnight-indexer": { owner: "midnightntwrk", repo: "midnight-indexer" },
  indexer: { owner: "midnightntwrk", repo: "midnight-indexer" },
  "midnight-node-docker": {
    owner: "midnightntwrk",
    repo: "midnight-node-docker",
  },
  node: { owner: "midnightntwrk", repo: "midnight-node-docker" },

  // APIs & Connectors
  "midnight-dapp-connector-api": {
    owner: "midnightntwrk",
    repo: "midnight-dapp-connector-api",
  },
  connector: { owner: "midnightntwrk", repo: "midnight-dapp-connector-api" },

  // Tooling
  "compact-tree-sitter": {
    owner: "midnightntwrk",
    repo: "compact-tree-sitter",
  },

  // Community
  "midnight-awesome-dapps": {
    owner: "midnightntwrk",
    repo: "midnight-awesome-dapps",
  },
  awesome: { owner: "midnightntwrk", repo: "midnight-awesome-dapps" },
  "contributor-hub": { owner: "midnightntwrk", repo: "contributor-hub" },

  // Partner Libraries (OpenZeppelin)
  "compact-contracts": { owner: "OpenZeppelin", repo: "compact-contracts" },
  openzeppelin: { owner: "OpenZeppelin", repo: "compact-contracts" },
  oz: { owner: "OpenZeppelin", repo: "compact-contracts" },
};

// Example definitions
export interface ExampleDefinition {
  name: string;
  repository: string;
  description: string;
  category: string;
  complexity: "beginner" | "intermediate" | "advanced";
  mainFile: string;
  features: string[];
}

export const EXAMPLES: ExampleDefinition[] = [
  {
    name: "Counter",
    repository: "midnightntwrk/example-counter",
    description:
      "Simple counter contract demonstrating basic Compact concepts. Perfect for learning ledger state, circuits, and witnesses.",
    category: "counter",
    complexity: "beginner",
    mainFile: "contract/src/counter.compact",
    features: [
      "Ledger state management",
      "Basic circuit definition",
      "Counter increment/decrement",
      "TypeScript integration",
    ],
  },
  {
    name: "Bulletin Board",
    repository: "midnightntwrk/example-bboard",
    description:
      "Full DApp example with CLI and React UI. Demonstrates posting messages with privacy features.",
    category: "bboard",
    complexity: "intermediate",
    mainFile: "contract/src/bboard.compact",
    features: [
      "Private messaging",
      "React frontend",
      "CLI interface",
      "Wallet integration",
      "Disclose operations",
    ],
  },
  {
    name: "DEX (Decentralized Exchange)",
    repository: "midnightntwrk/example-dex",
    description:
      "Advanced DApp example showing token swaps and liquidity pools with privacy-preserving transactions.",
    category: "dex",
    complexity: "advanced",
    mainFile: "contract/src/dex.compact",
    features: [
      "Token swaps",
      "Liquidity pools",
      "Privacy-preserving trades",
      "Price calculations",
      "Advanced state management",
    ],
  },
];
