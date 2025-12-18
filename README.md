# Midnight MCP Server

A Model Context Protocol (MCP) Server for Midnight Blockchain Development. This server enables AI assistants like Claude to understand, query, and assist with Midnight development by providing real-time access to the Midnight ecosystem.

## Features

- 🔍 **Semantic Search** - Search across Compact smart contracts, TypeScript SDK, and documentation
- 📊 **Contract Analysis** - Analyze Compact contracts for structure, patterns, and security issues
- 📚 **Rich Resources** - Access documentation, code examples, patterns, and templates
- 💡 **Guided Prompts** - Pre-built prompts for common development tasks
- 🔄 **Real-time Sync** - Stay updated with the latest changes from Midnight repositories

## Installation

### NPM Global Install

```bash
npm install -g @olanetsoft/midnight-mcp
```

### From Source

```bash
git clone https://github.com/Olanetsoft/midnight-mcp.git
cd midnight-mcp
npm install
npm run build
```

## Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Required
GITHUB_TOKEN=ghp_xxxxxxxxxxxx          # GitHub PAT with repo access
OPENAI_API_KEY=sk-xxxxxxxxxxxx         # For embeddings (or use local)

# Vector Database (choose one)
CHROMA_URL=http://localhost:8000       # ChromaDB endpoint

# Optional
LOG_LEVEL=info                         # debug|info|warn|error
SYNC_INTERVAL=900000                   # Sync interval in ms (15min)
EMBEDDING_MODEL=text-embedding-3-small # Embedding model
```

### Client Configuration

#### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "midnight": {
      "command": "npx",
      "args": ["-y", "@olanetsoft/midnight-mcp"],
      "env": {
        "GITHUB_TOKEN": "your-token",
        "OPENAI_API_KEY": "your-key"
      }
    }
  }
}
```

#### Cursor IDE

Add to `.cursor/mcp.json` in your project:

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

## Usage

### Starting the Server

```bash
# Start with stdio transport (for MCP clients)
npm start

# Development mode with hot reload
npm run dev
```

### Initial Indexing

Before using search features, index the Midnight repositories:

```bash
# Start ChromaDB (requires Docker)
docker run -p 8000:8000 chromadb/chroma

# Run indexing
npm run index
```

## Available Tools

### Search Tools

| Tool                         | Description                                                     |
| ---------------------------- | --------------------------------------------------------------- |
| `midnight:search-compact`    | Semantic search across Compact smart contract code and patterns |
| `midnight:search-typescript` | Search TypeScript SDK code, types, and API implementations      |
| `midnight:search-docs`       | Full-text search across official Midnight documentation         |

### Analysis Tools

| Tool                        | Description                                                             |
| --------------------------- | ----------------------------------------------------------------------- |
| `midnight:analyze-contract` | Analyze a Compact contract for structure, patterns, and security issues |
| `midnight:explain-circuit`  | Explain what a circuit does in plain language with ZK implications      |

### Repository Tools

| Tool                          | Description                                          |
| ----------------------------- | ---------------------------------------------------- |
| `midnight:get-file`           | Retrieve a specific file from Midnight repositories  |
| `midnight:list-examples`      | List available example contracts and DApps           |
| `midnight:get-latest-updates` | Retrieve recent changes across Midnight repositories |

## Available Resources

### Documentation

- `midnight://docs/compact-reference` - Complete Compact language reference
- `midnight://docs/sdk-api` - TypeScript SDK API documentation
- `midnight://docs/concepts/zero-knowledge` - Zero-knowledge proofs in Midnight
- `midnight://docs/concepts/shielded-state` - Understanding shielded vs unshielded state
- `midnight://docs/concepts/witnesses` - How witness functions work
- `midnight://docs/concepts/kachina` - The Kachina protocol

### Code Examples

- `midnight://code/examples/counter` - Simple counter contract
- `midnight://code/examples/bboard` - Bulletin board DApp
- `midnight://code/patterns/state-management` - State management patterns
- `midnight://code/patterns/access-control` - Access control patterns
- `midnight://code/patterns/privacy-preserving` - Privacy-preserving patterns
- `midnight://code/templates/token` - Token contract template
- `midnight://code/templates/voting` - Voting contract template

### Schemas

- `midnight://schema/compact-ast` - Compact AST JSON schema
- `midnight://schema/transaction` - Transaction format schema
- `midnight://schema/proof` - ZK proof format schema

## Available Prompts

| Prompt                        | Description                                               |
| ----------------------------- | --------------------------------------------------------- |
| `midnight:create-contract`    | Guided prompt for creating new Compact contracts          |
| `midnight:review-contract`    | Security and best practices review for existing contracts |
| `midnight:explain-concept`    | Educational prompt for explaining Midnight concepts       |
| `midnight:compare-approaches` | Compare different implementation approaches               |
| `midnight:debug-contract`     | Help debug issues with a Compact contract                 |

## Development

### Project Structure

```
midnight-mcp/
├── src/
│   ├── index.ts              # Entry point
│   ├── server.ts             # MCP server setup
│   ├── tools/                # Tool implementations
│   ├── resources/            # Resource providers
│   ├── prompts/              # Prompt templates
│   ├── pipeline/             # GitHub sync & parsing
│   ├── db/                   # Vector database
│   └── utils/                # Configuration & logging
├── config/
│   └── repos.json            # Repository configuration
├── tests/
├── package.json
└── tsconfig.json
```

### Running Tests

```bash
npm test
```

### Building

```bash
npm run build
```

## Troubleshooting

### Vector Store Connection Failed

Make sure ChromaDB is running:

```bash
docker run -p 8000:8000 chromadb/chroma
```

### GitHub Rate Limiting

If you're hitting GitHub API rate limits, ensure you have a valid `GITHUB_TOKEN` configured.

### Embeddings Not Working

Without an `OPENAI_API_KEY`, the server uses dummy embeddings for testing. For production use, configure a valid API key.

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests.

## License

MIT

## Resources

- [Midnight Documentation](https://docs.midnight.network)
- [Compact Language Reference](https://docs.midnight.network/compact)
- [MCP Specification](https://modelcontextprotocol.io)
- [Midnight GitHub](https://github.com/midnightntwrk)
