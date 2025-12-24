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
  "tree-sitter": { owner: "midnightntwrk", repo: "compact-tree-sitter" },
  "setup-compact-action": {
    owner: "midnightntwrk",
    repo: "setup-compact-action",
  },
  "setup-compact": { owner: "midnightntwrk", repo: "setup-compact-action" },
  "compact-action": { owner: "midnightntwrk", repo: "setup-compact-action" },

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
  "midnight-apps": { owner: "OpenZeppelin", repo: "midnight-apps" },
  lunarswap: { owner: "OpenZeppelin", repo: "midnight-apps" },

  // Official Partners (from awesome-dapps)
  "midnight-seabattle": { owner: "bricktowers", repo: "midnight-seabattle" },
  seabattle: { owner: "bricktowers", repo: "midnight-seabattle" },
  battleship: { owner: "bricktowers", repo: "midnight-seabattle" },
  "midnight-identity": { owner: "bricktowers", repo: "midnight-identity" },
  identity: { owner: "bricktowers", repo: "midnight-identity" },
  "midnight-rwa": { owner: "bricktowers", repo: "midnight-rwa" },
  rwa: { owner: "bricktowers", repo: "midnight-rwa" },
  "midnight-starter-template": {
    owner: "MeshJS",
    repo: "midnight-starter-template",
  },
  meshjs: { owner: "MeshJS", repo: "midnight-starter-template" },
  starter: { owner: "MeshJS", repo: "midnight-starter-template" },
  midnames: { owner: "midnames", repo: "core" },
  did: { owner: "midnames", repo: "core" },

  // Sea Battle Hackathon Winners (Feb 2025)
  "naval-battle": { owner: "ErickRomeroDev", repo: "naval-battle-game_v2" },
  "edda-labs": { owner: "ErickRomeroDev", repo: "naval-battle-game_v2" },
  "sea-battle-hackathon": {
    owner: "eddex",
    repo: "midnight-sea-battle-hackathon",
  },
  shipyspace: { owner: "eddex", repo: "midnight-sea-battle-hackathon" },
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
  // Sea Battle Hackathon Winners (Feb 2025)
  {
    name: "Sea Battle (Brick Towers)",
    repository: "bricktowers/midnight-seabattle",
    description:
      "1st place hackathon winner. Fully playable battleship game with token staking (100 shielded tBTC). Features ZK-protected ship placements and moves.",
    category: "game",
    complexity: "advanced",
    mainFile: "contract/src/seabattle.compact",
    features: [
      "ZK game mechanics",
      "Shielded token staking",
      "Turn-based gameplay",
      "Private state management",
      "Lace wallet integration",
    ],
  },
  {
    name: "Naval Battle (Edda Labs)",
    repository: "ErickRomeroDev/naval-battle-game_v2",
    description:
      "2nd place hackathon winner. Clean implementation with 4 ZK circuits: join game, commit grid, start game, make move. Modern drag-and-drop UI.",
    category: "game",
    complexity: "intermediate",
    mainFile: "contract/src/naval.compact",
    features: [
      "4 ZK circuits",
      "Drag-and-drop UI",
      "Real-time updates",
      "Clean circuit design",
      "Open-source docs",
    ],
  },
  {
    name: "Sea Battle (ShipySpace)",
    repository: "eddex/midnight-sea-battle-hackathon",
    description:
      "3rd place hackathon winner. Great beginner-friendly example showing core game mechanics without centralized server. Good first ZK project reference.",
    category: "game",
    complexity: "beginner",
    mainFile: "contract/src/game.compact",
    features: [
      "No centralized server",
      "Deploy/join/resume games",
      "Basic ZK patterns",
      "Beginner friendly",
      "Clear player interactions",
    ],
  },
];
