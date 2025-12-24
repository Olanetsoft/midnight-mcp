# Midnight MCP API

Cloudflare Workers + Vectorize backend for semantic search.

## Quick Start

```bash
npm install && npm run dev  # http://localhost:8787
```

Test it:

```bash
curl -X POST http://localhost:8787/v1/search/compact \
  -H "Content-Type: application/json" \
  -d '{"query": "token transfer", "limit": 5}'
```

## Deployment

```bash
# 1. Create Vectorize index
npm run create-index

# 2. Add secrets
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put DASHBOARD_PASSWORD

# 3. Index repositories (requires ../.env with CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, OPENAI_API_KEY)
npm run index

# 4. Deploy
npm run deploy
```

## Endpoints

| Endpoint                | Method | Description          |
| ----------------------- | ------ | -------------------- |
| `/health`               | GET    | Health check         |
| `/v1/search/compact`    | POST   | Search Compact code  |
| `/v1/search/typescript` | POST   | Search TypeScript    |
| `/v1/search/docs`       | POST   | Search documentation |
| `/dashboard?p=PASSWORD` | GET    | Analytics dashboard  |

<details>
<summary><strong>Request/Response Format</strong></summary>

**Request:**

```json
{ "query": "your search query", "limit": 10 }
```

**Response:**

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

</details>

## Indexed Repositories (28)

| Category  | Repositories                                                                                                                                                                                                       |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Core      | `compact`, `midnight-js`, `midnight-wallet`, `midnight-node`, `midnight-ledger`, `midnight-zk`                                                                                                                     |
| Examples  | `example-counter`, `example-bboard`, `example-dex`, `create-mn-app`                                                                                                                                                |
| Docs      | `midnight-docs`, `midnight-improvement-proposals`, `midnight-awesome-dapps`                                                                                                                                        |
| Tools     | `compact-tree-sitter`, `setup-compact-action`, `midnight-node-docker`                                                                                                                                              |
| ZK/Crypto | `halo2`, `midnight-trusted-setup`                                                                                                                                                                                  |
| Partners  | `OpenZeppelin/compact-contracts`, `OpenZeppelin/midnight-apps`, `bricktowers/midnight-seabattle`, `bricktowers/midnight-identity`, `bricktowers/midnight-rwa`, `MeshJS/midnight-starter-template`, `midnames/core` |
| Hackathon | `ErickRomeroDev/naval-battle-game_v2` (Edda Labs), `eddex/midnight-sea-battle-hackathon` (ShipySpace)                                                                                                              |

<details>
<summary><strong>Indexing Configuration</strong></summary>

| Setting       | Value      | Description                        |
| ------------- | ---------- | ---------------------------------- |
| Chunk size    | 1000 chars | Smaller chunks for precise results |
| Chunk overlap | 200 chars  | Context continuity                 |
| Keyword boost | Up to 20%  | Boosts exact matches               |

**Features:**

- Tarball download (10x faster than cloning)
- Batch embeddings (parallel processing)
- Incremental indexing (KV cache for changed files only)
- Hybrid search (vector + keyword boosting)

**Manual Re-index:** Actions → Index Repositories → Run workflow → Check "Force full reindex"

**Automated:** Daily at 6am UTC, on release, or manual trigger

</details>

## Dashboard

```
https://midnight-mcp-api.midnightmcp.workers.dev/dashboard?p=YOUR_PASSWORD
```

Shows query volume, relevance scores, quality distribution, and search trends.
