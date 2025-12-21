# Midnight MCP Server

[![npm version](https://badge.fury.io/js/midnight-mcp.svg)](https://www.npmjs.com/package/midnight-mcp)
[![Index Repositories](https://github.com/Olanetsoft/midnight-mcp/actions/workflows/index.yml/badge.svg)](https://github.com/Olanetsoft/midnight-mcp/actions/workflows/index.yml)
[![CI](https://github.com/Olanetsoft/midnight-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Olanetsoft/midnight-mcp/actions/workflows/ci.yml)

MCP server that gives AI assistants access to Midnight blockchain—search contracts, analyze code, and explore documentation.

## Quick Start

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "midnight": {
      "command": "npx",
      "args": ["-y", "midnight-mcp"]
    }
  }
}
```

Restart Claude Desktop. All features work out of the box—no API keys or setup required.

---

## How It Works

By default, the MCP uses a **hosted API** for semantic search:

- ✅ **Zero configuration** — just install and use
- ✅ **Semantic search** works immediately
- ✅ **No API keys** needed

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

Local mode requires ChromaDB (`docker run -d -p 8000:8000 chromadb/chroma`) and an OpenAI API key.

### GitHub Token (Optional)

Add `"GITHUB_TOKEN": "ghp_..."` for higher GitHub API rate limits (60 → 5000 requests/hour).

---

## Features

### Tools (16)

| Tool                              | Description                             |
| --------------------------------- | --------------------------------------- |
| `midnight-search-compact`         | Search Compact contract code            |
| `midnight-search-typescript`      | Search TypeScript SDK                   |
| `midnight-search-docs`            | Search documentation                    |
| `midnight-analyze-contract`       | Analyze contract structure and security |
| `midnight-explain-circuit`        | Explain circuits in plain language      |
| `midnight-get-file`               | Get files from Midnight repos           |
| `midnight-list-examples`          | List example contracts                  |
| `midnight-get-latest-updates`     | Recent repo changes                     |
| `midnight-get-version-info`       | Get version and release info            |
| `midnight-check-breaking-changes` | Check for breaking changes              |
| `midnight-get-migration-guide`    | Migration guides between versions       |
| `midnight-get-file-at-version`    | Get file at specific version            |
| `midnight-compare-syntax`         | Compare files between versions          |
| `midnight-get-latest-syntax`      | Latest syntax reference                 |
| `midnight-health-check`           | Check server health status              |
| `midnight-get-status`             | Get rate limits and cache stats         |

### Resources (20)

- `midnight://docs/*` — Documentation (Compact reference, SDK API, ZK concepts)
- `midnight://code/*` — Examples, patterns, and templates
- `midnight://schema/*` — AST, transaction, and proof schemas

### Prompts (5)

- `midnight:create-contract` — Create new contracts
- `midnight:review-contract` — Security review
- `midnight:explain-concept` — Learn Midnight concepts
- `midnight:compare-approaches` — Compare implementation approaches
- `midnight:debug-contract` — Debug issues

---

## Developer Setup

For contributors:

```bash
git clone https://github.com/Olanetsoft/midnight-mcp.git
cd midnight-mcp
npm install
npm run build
npm test
```

### Testing with Local API

To test against a local API server instead of production:

```bash
# Terminal 1: Start local API
cd api
npm install
npm run dev  # Starts at http://localhost:8787

# Terminal 2: Run MCP with local API
MIDNIGHT_API_URL=http://localhost:8787 npm start
```

### API Backend

The hosted API runs on Cloudflare Workers + Vectorize. See [api/README.md](./api/README.md) for deployment and development instructions.

## License

MIT

## Links

- [Midnight Docs](https://docs.midnight.network)
- [MCP Spec](https://modelcontextprotocol.io)
- [Midnight GitHub](https://github.com/midnightntwrk)
