# Midnight MCP Server

[![npm version](https://badge.fury.io/js/midnight-mcp.svg)](https://www.npmjs.com/package/midnight-mcp)
[![npm downloads](https://img.shields.io/npm/dm/midnight-mcp)](https://www.npmjs.com/package/midnight-mcp)
[![License](https://img.shields.io/npm/l/midnight-mcp)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?logo=typescript)](https://www.typescriptlang.org/)
[![CI](https://github.com/Olanetsoft/midnight-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Olanetsoft/midnight-mcp/actions/workflows/ci.yml)

MCP server that gives AI assistants access to Midnight blockchain—search contracts, analyze code, and explore documentation.

## Quick Start

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "midnight": {
      "command": "npx",
      "args": ["-y", "midnight-mcp@latest"]
    }
  }
}
```

**Config file locations:**

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

### Cursor

One-click install:

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en-US/install-mcp?name=midnight&config=eyJjb21tYW5kIjoibnB4IC15IG1pZG5pZ2h0LW1jcEBsYXRlc3QifQ==)

Or manually add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "midnight": {
      "command": "npx",
      "args": ["-y", "midnight-mcp@latest"]
    }
  }
}
```

### VS Code Copilot

Add to `.vscode/mcp.json` or use Command Palette: `MCP: Add Server` → "command (stdio)" → `npx -y midnight-mcp@latest`

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "midnight": {
      "command": "npx",
      "args": ["-y", "midnight-mcp@latest"]
    }
  }
}
```

**No API keys required.** Restart your editor after adding the config.

### Automatic Updates

Using `midnight-mcp@latest` ensures you always get the newest version. If you have an older config without `@latest`, update it:

```diff
- "args": ["-y", "midnight-mcp"]
+ "args": ["-y", "midnight-mcp@latest"]
```

Or clear the npx cache to force an update:

```bash
npx clear-npx-cache
```

---

## What's Included

### 25 Tools

| Category          | Tools                                                                                                                             | Description                                      |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| **Search**        | `search-compact`, `search-typescript`, `search-docs`                                                                              | Semantic search across Midnight codebase         |
| **Analysis**      | `analyze-contract`, `explain-circuit`, `extract-contract-structure`                                                               | Static analysis and pattern detection            |
| **Repository**    | `get-file`, `list-examples`, `get-latest-updates`                                                                                 | Access files and examples                        |
| **Versioning**    | `get-version-info`, `check-breaking-changes`, `get-migration-guide`, `get-file-at-version`, `compare-syntax`, `get-latest-syntax` | Version tracking and migration                   |
| **AI Generation** | `generate-contract`, `review-contract`, `document-contract`                                                                       | AI-powered code generation _(requires sampling)_ |
| **Compound**      | `upgrade-check`, `get-repo-context`                                                                                               | Multi-step operations _(saves 50-70% tokens)_    |
| **Health**        | `health-check`, `get-status`, `check-version`                                                                                     | Server status and version checking               |
| **Discovery**     | `list-tool-categories`, `list-category-tools`                                                                                     | Explore available tools                          |

All tools are prefixed with `midnight-` (e.g., `midnight-search-compact`).

### MCP Capabilities

| Capability | Feature |
|------------|---------|
| **Tools** | 25 tools with `listChanged` notifications |
| **Resources** | 9 embedded resources with subscription support |
| **Prompts** | 5 workflow prompts |
| **Logging** | Client-controllable log level |
| **Sampling** | AI-powered generation (when client supports it) |

### 9 Embedded Resources

Quick references available offline:

- Compact syntax guide
- SDK API reference
- OpenZeppelin contracts
- Tokenomics overview
- Wallet integration
- Common errors & solutions

### 5 Prompts

- `create-contract` — Generate new contracts
- `review-contract` — Security and code review
- `explain-concept` — Learn Midnight concepts
- `compare-approaches` — Compare implementation patterns
- `debug-contract` — Troubleshoot issues

---

## Indexed Repositories

The API indexes **39 Midnight repositories**:

| Category              | Repositories                                                                                                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Core**              | `compact`, `midnight-js`, `midnight-wallet`, `midnight-docs`, `midnight-node`, `midnight-indexer`, `midnight-ledger`, `midnight-zk`                                    |
| **Examples**          | `example-counter`, `example-bboard`, `example-dex`, `create-mn-app`                                                                                                    |
| **Infrastructure**    | `midnight-node-docker`, `midnight-dapp-connector-api`, `compact-tree-sitter`, `setup-compact-action`                                                                   |
| **Partner Libraries** | `OpenZeppelin/compact-contracts`, `OpenZeppelin/midnight-apps` (LunarSwap)                                                                                             |
| **Official Partners** | `bricktowers/midnight-seabattle`, `bricktowers/midnight-identity`, `bricktowers/midnight-rwa`, `MeshJS/midnight-starter-template`, `midnames/core`                     |
| **Core Partner**      | `PaimaStudios/midnight-game-2`, `PaimaStudios/midnight-wasm-prover`, `PaimaStudios/midnight-batcher`, `PaimaStudios/midnight-impact-rps-example`                       |
| **Hackathon Winners** | Sea Battle: `ErickRomeroDev/naval-battle-game_v2`, `eddex/midnight-sea-battle-hackathon` • Mini DApp: `statera-protocol`, `nel349/midnight-bank`, `Imdavyking/zkbadge` |

---

## Advanced Configuration

### Local Mode

Run everything locally for privacy or offline use:

```json
{
  "mcpServers": {
    "midnight": {
      "command": "npx",
      "args": ["-y", "midnight-mcp@latest"],
      "env": {
        "MIDNIGHT_LOCAL": "true",
        "OPENAI_API_KEY": "sk-...",
        "CHROMA_URL": "http://localhost:8000"
      }
    }
  }
}
```

Requires ChromaDB (`docker run -d -p 8000:8000 chromadb/chroma`) and OpenAI API key.

### GitHub Token

Add `"GITHUB_TOKEN": "ghp_..."` for higher GitHub API rate limits (60 → 5000 requests/hour).

---

## Developer Setup

```bash
git clone https://github.com/Olanetsoft/midnight-mcp.git && cd midnight-mcp
npm install && npm run build && npm test
```

The hosted API runs on Cloudflare Workers + Vectorize. See [api/README.md](./api/README.md) for backend details.

---

## Links

- [Midnight Docs](https://docs.midnight.network)
- [MCP Spec](https://modelcontextprotocol.io)
- [Midnight GitHub](https://github.com/midnightntwrk)

## License

MIT
