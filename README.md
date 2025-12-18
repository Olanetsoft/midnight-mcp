# Midnight MCP Server

MCP server that gives AI assistants access to Midnight's blockchain ecosystem—Compact contracts, TypeScript SDK, and documentation.

## Quick Start

```bash
npm install -g midnight-mcp
```

Or run directly:

```bash
npx midnight-mcp
```

## Setup

Create a `.env` file:

```bash
GITHUB_TOKEN=ghp_xxxxxxxxxxxx
OPENAI_API_KEY=sk-xxxxxxxxxxxx
CHROMA_URL=http://localhost:8000
```

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "midnight": {
      "command": "npx",
      "args": ["-y", "midnight-mcp"],
      "env": {
        "GITHUB_TOKEN": "your-token",
        "OPENAI_API_KEY": "your-key"
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "midnight": {
      "command": "node",
      "args": ["path/to/midnight-mcp/dist/index.js"]
    }
  }
}
```

## Tools

**Search**
- `midnight:search-compact` — Search Compact contract code
- `midnight:search-typescript` — Search TypeScript SDK
- `midnight:search-docs` — Search documentation

**Analysis**
- `midnight:analyze-contract` — Analyze contract structure and security
- `midnight:explain-circuit` — Explain circuits in plain language

**Repository**
- `midnight:get-file` — Get files from Midnight repos
- `midnight:list-examples` — List example contracts
- `midnight:get-latest-updates` — Recent repo changes

## Resources

The server exposes these MCP resources:

- `midnight://docs/*` — Documentation (Compact reference, SDK API, concepts)
- `midnight://code/*` — Examples, patterns, and templates
- `midnight://schema/*` — AST, transaction, and proof schemas

## Prompts

- `midnight:create-contract` — Create new contracts
- `midnight:review-contract` — Security review
- `midnight:explain-concept` — Learn Midnight concepts
- `midnight:debug-contract` — Debug contract issues

## Development

```bash
git clone https://github.com/Olanetsoft/midnight-mcp.git
cd midnight-mcp
npm install
npm run build
npm test
```

Before searching, start ChromaDB and index:

```bash
docker run -p 8000:8000 chromadb/chroma
npm run index
```

## License

MIT

## Links

- [Midnight Docs](https://docs.midnight.network)
- [MCP Spec](https://modelcontextprotocol.io)
- [Midnight GitHub](https://github.com/midnightntwrk)
