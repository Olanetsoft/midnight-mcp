# Midnight MCP Server

MCP server that gives AI assistants access to Midnight blockchain—search contracts, analyze code, and explore documentation.

## User Setup

For users who want to use this MCP with Claude Desktop or Cursor.

### Prerequisites

- [Docker](https://docker.com) installed
- [OpenAI API key](https://platform.openai.com/api-keys)
- GitHub token (optional, but recommended for higher rate limits)

### 1. Start ChromaDB

ChromaDB runs locally on your machine—no account needed:

```bash
docker run -d -p 8000:8000 chromadb/chroma
```

### 2. Configure your MCP client

**Claude Desktop** — Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "midnight": {
      "command": "npx",
      "args": ["-y", "midnight-mcp"],
      "env": {
        "OPENAI_API_KEY": "sk-...",
        "GITHUB_TOKEN": "ghp_...",
        "CHROMA_URL": "http://localhost:8000"
      }
    }
  }
}
```

**Cursor** — Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "midnight": {
      "command": "npx",
      "args": ["-y", "midnight-mcp"],
      "env": {
        "OPENAI_API_KEY": "sk-...",
        "CHROMA_URL": "http://localhost:8000"
      }
    }
  }
}
```

### Environment Variables

| Variable         | Required | Description                                            |
| ---------------- | -------- | ------------------------------------------------------ |
| `OPENAI_API_KEY` | Yes      | For generating embeddings                              |
| `CHROMA_URL`     | Yes      | ChromaDB endpoint (default: `http://localhost:8000`)   |
| `GITHUB_TOKEN`   | No       | Increases GitHub API rate limit from 60 to 5000 req/hr |

### 3. Start using it

Restart Claude Desktop or Cursor. Ask Claude something like:

- "Search for counter contract examples in Midnight"
- "Analyze this Compact contract for security issues"
- "Explain how witnesses work in Midnight"

---

## What's Included

### Tools

| Tool                          | Description                             |
| ----------------------------- | --------------------------------------- |
| `midnight:search-compact`     | Search Compact contract code            |
| `midnight:search-typescript`  | Search TypeScript SDK                   |
| `midnight:search-docs`        | Search documentation                    |
| `midnight:analyze-contract`   | Analyze contract structure and security |
| `midnight:explain-circuit`    | Explain circuits in plain language      |
| `midnight:get-file`           | Get files from Midnight repos           |
| `midnight:list-examples`      | List example contracts                  |
| `midnight:get-latest-updates` | Recent repo changes                     |

### Resources

- `midnight://docs/*` — Documentation (Compact reference, SDK API, ZK concepts)
- `midnight://code/*` — Examples, patterns, and templates
- `midnight://schema/*` — AST, transaction, and proof schemas

### Prompts

- `midnight:create-contract` — Create new contracts
- `midnight:review-contract` — Security review
- `midnight:explain-concept` — Learn Midnight concepts
- `midnight:debug-contract` — Debug issues

---

## Developer Setup

For contributors who want to modify or extend the MCP server.

```bash
git clone https://github.com/Olanetsoft/midnight-mcp.git
cd midnight-mcp
npm install
npm run build
npm test
```

### Index Midnight repos (for search)

```bash
docker run -d -p 8000:8000 chromadb/chroma
npm run index
```

### Project Structure

```
src/
├── index.ts          # Entry point
├── server.ts         # MCP server handlers
├── tools/            # Search, analysis, repository tools
├── resources/        # Docs, code, schema providers
├── prompts/          # Prompt templates
├── pipeline/         # GitHub sync & parsing
├── db/               # ChromaDB integration
└── utils/            # Config & logging
```

## License

MIT

## Links

- [Midnight Docs](https://docs.midnight.network)
- [MCP Spec](https://modelcontextprotocol.io)
- [Midnight GitHub](https://github.com/midnightntwrk)
