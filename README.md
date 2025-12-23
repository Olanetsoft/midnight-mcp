# Midnight MCP Server

[![npm version](https://badge.fury.io/js/midnight-mcp.svg)](https://www.npmjs.com/package/midnight-mcp)
[![npm downloads](https://img.shields.io/npm/dm/midnight-mcp)](https://www.npmjs.com/package/midnight-mcp)
[![License](https://img.shields.io/npm/l/midnight-mcp)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?logo=typescript)](https://www.typescriptlang.org/)
[![CI](https://github.com/Olanetsoft/midnight-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Olanetsoft/midnight-mcp/actions/workflows/ci.yml)

MCP server that gives AI assistants access to Midnight blockchain—search contracts, analyze code, and explore documentation.

## Quick Start

**Claude Desktop** — Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "midnight": { "command": "npx", "args": ["-y", "midnight-mcp"] }
  }
}
```

**Cursor** — One-click install:

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en-US/install-mcp?name=midnight&config=eyJjb21tYW5kIjoibnB4IC15IG1pZG5pZ2h0LW1jcCJ9)

<details>
<summary><strong>Other Editors (Windsurf, VS Code Copilot, Manual Setup)</strong></summary>

**Windsurf** — Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "midnight": { "command": "npx", "args": ["-y", "midnight-mcp"] }
  }
}
```

**VS Code Copilot** — Add to `.vscode/mcp.json` or use Command Palette: `MCP: Add Server` → "command (stdio)" → `npx -y midnight-mcp`

```json
{
  "mcpServers": {
    "midnight": { "command": "npx", "args": ["-y", "midnight-mcp"] }
  }
}
```

**Cursor Manual** — Settings → MCP → Add Server, or add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "midnight": { "command": "npx", "args": ["-y", "midnight-mcp"] }
  }
}
```

**Config file locations (Claude Desktop):**

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

</details>

Restart your editor after adding the config. **No API keys required.**

> **Quality Metrics**: To ensure the MCP stays accurate as Midnight's codebase evolves rapidly, we collect anonymous usage metrics (query counts, relevance scores) to monitor search quality. No query content or personal data is stored. This helps us identify when re-indexing is needed and improve results over time.

---

## Features

**23 Tools** — Search, analyze, version tracking, AI generation, compound operations

| Category      | Tools                                                                                                                                                                                   |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Search        | `midnight-search-compact`, `midnight-search-typescript`, `midnight-search-docs`                                                                                                         |
| Analysis      | `midnight-analyze-contract`, `midnight-explain-circuit`                                                                                                                                 |
| Repository    | `midnight-get-file`, `midnight-list-examples`, `midnight-get-latest-updates`                                                                                                            |
| Versioning    | `midnight-get-version-info`, `midnight-check-breaking-changes`, `midnight-get-migration-guide`, `midnight-get-file-at-version`, `midnight-compare-syntax`, `midnight-get-latest-syntax` |
| AI Generation | `midnight-generate-contract`, `midnight-review-contract`, `midnight-document-contract` _(requires sampling)_                                                                            |
| Compound      | `midnight-upgrade-check`, `midnight-get-repo-context` _(saves 50-70% tokens)_                                                                                                           |
| Discovery     | `midnight-list-tool-categories`, `midnight-list-category-tools`, `midnight-health-check`, `midnight-get-status`                                                                         |

> **Tip:** Use compound tools (`midnight-upgrade-check`, `midnight-get-repo-context`) for efficient multi-step operations in a single call.

**9 Embedded Resources** — Quick references available offline: Compact syntax, SDK API, OpenZeppelin contracts, tokenomics, wallet integration, common errors

**5 Prompts** — `create-contract`, `review-contract`, `explain-concept`, `compare-approaches`, `debug-contract`

<details>
<summary><strong>Advanced Configuration</strong></summary>

### Local Mode (Optional)

Run everything locally for privacy or offline use:

```json
{
  "mcpServers": {
    "midnight": {
      "command": "npx",
      "args": ["-y", "midnight-mcp"],
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

### GitHub Token (Optional)

Add `"GITHUB_TOKEN": "ghp_..."` for higher GitHub API rate limits (60 → 5000 requests/hour).

</details>

---

## Indexed Repositories

The API indexes **22+ Midnight repositories**:

| Category          | Repositories                                                                                                                                       |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core              | `compact`, `midnight-js`, `midnight-wallet`, `midnight-docs`                                                                                       |
| Examples          | `example-counter`, `example-bboard`, `example-dex`, `create-mn-app`                                                                                |
| Infrastructure    | `midnight-indexer`, `midnight-node-docker`, `midnight-dapp-connector-api`                                                                          |
| Partner Libraries | `OpenZeppelin/compact-contracts`, `OpenZeppelin/midnight-apps`                                                                                     |
| Official Partners | `bricktowers/midnight-seabattle`, `bricktowers/midnight-identity`, `bricktowers/midnight-rwa`, `MeshJS/midnight-starter-template`, `midnames/core` |

---

## Developer Setup

```bash
git clone https://github.com/Olanetsoft/midnight-mcp.git && cd midnight-mcp
npm install && npm run build && npm test
```

<details>
<summary><strong>API Backend & Local Development</strong></summary>

The hosted API runs on Cloudflare Workers + Vectorize. See [api/README.md](./api/README.md).

**Testing with Local API:**

```bash
# Terminal 1: Start local API
cd api && npm install && npm run dev

# Terminal 2: Run MCP with local API
MIDNIGHT_API_URL=http://localhost:8787 npm start
```

</details>

## Links

- [Midnight Docs](https://docs.midnight.network) • [MCP Spec](https://modelcontextprotocol.io) • [Midnight GitHub](https://github.com/midnightntwrk)

## License

MIT
