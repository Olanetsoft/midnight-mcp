# Midnight MCP API (Cloudflare Workers)

Cloudflare Workers + Vectorize backend for midnight-mcp semantic search.

## Quick Start (Local Development)

```bash
cd api
npm install
npm run dev  # Starts local server at http://localhost:8787
```

Then in another terminal, test it:

```bash
curl -X POST http://localhost:8787/v1/search/compact \
  -H "Content-Type: application/json" \
  -d '{"query": "token transfer", "limit": 5}'
```

> **Note:** Local dev uses Vectorize emulation. For full functionality, deploy to Cloudflare.

## Full Setup (for deployment)

### 1. Create Vectorize Index

```bash
npm run create-index
```

### 2. Add OpenAI API Key

```bash
npx wrangler secret put OPENAI_API_KEY
# Enter your OpenAI API key when prompted
```

### 3. Index Repositories

The indexing script loads from `../.env` automatically:

```bash
# Add to ../.env (project root):
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token
OPENAI_API_KEY=your_openai_key
GITHUB_TOKEN=your_github_token  # Optional, increases rate limit 60 → 5000 req/hr

# Run indexing
npm run index
```

### 4. Deploy

```bash
npm run deploy
```

## Endpoints

| Endpoint                | Method | Description          |
| ----------------------- | ------ | -------------------- |
| `/health`               | GET    | Health check         |
| `/v1/search`            | POST   | Generic search       |
| `/v1/search/compact`    | POST   | Search Compact code  |
| `/v1/search/typescript` | POST   | Search TypeScript    |
| `/v1/search/docs`       | POST   | Search documentation |

### Request Format

```json
{
  "query": "your search query",
  "limit": 10
}
```

### Response Format

```json
{
  "results": [
    {
      "content": "code or documentation content",
      "relevanceScore": 0.85,
      "source": {
        "repository": "owner/repo",
        "filePath": "path/to/file.ts",
        "lines": "10-50"
      },
      "codeType": "compact|typescript|markdown"
    }
  ],
  "query": "your search query",
  "totalResults": 10
}
```

## Indexing

The indexing process downloads **25 Midnight repositories** and indexes them into Cloudflare Vectorize:

- Core: `compact`, `midnight-js`, `midnight-wallet`, `midnight-node`, `midnight-ledger`, `midnight-zk`
- ZK/Crypto: `halo2`, `midnight-trusted-setup`, `rs-merkle`
- Examples: `example-counter`, `example-bboard`, `example-dex`
- Tools: `compact-tree-sitter`, `create-mn-app`, `setup-compact-action`
- Docs: `midnight-docs`, `midnight-improvement-proposals`
- And more...

### Features

- **Tarball download** — Downloads repo archives instead of cloning (10x faster)
- **Batch embeddings** — Processes embeddings in parallel batches
- **Incremental indexing** — Only re-indexes changed files (uses KV cache)
- **Hybrid search** — Combines vector similarity with keyword boosting

### Configuration

| Setting       | Value      | Description                              |
| ------------- | ---------- | ---------------------------------------- |
| Chunk size    | 1000 chars | Smaller chunks for precise results       |
| Chunk overlap | 200 chars  | Context continuity between chunks        |
| Keyword boost | Up to 20%  | Boosts exact matches in content/filepath |

### Manual Re-indexing

To force a full re-index (ignoring cache):

1. Go to **Actions** → **Index Repositories**
2. Click **Run workflow**
3. Check **"Force full reindex (ignore cache)"**
4. Click **Run workflow**

This is useful when chunk settings change or you want fresh embeddings.

### Automated Triggers

- **Daily**: Runs at 6am UTC
- **On release**: Webhook trigger via `repository_dispatch`
- **Manual**: Via GitHub Actions UI

## Dashboard

View search quality metrics at:

```
https://midnight-mcp-api.midnightmcp.workers.dev/dashboard
```

Shows:

- Query volume (24h / 7d / 30d)
- Average relevance scores
- Quality distribution (High/Medium/Low)
- Top queries and search trends
