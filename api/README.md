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

## Indexed Repositories (115)

All **non-archived** repositories from midnightntwrk org + community partners.
Requires `MIDNIGHT_GITHUB_TOKEN` secret with org access for private repos.

| Category             | Count | Key Repositories                                                            |
| -------------------- | ----- | --------------------------------------------------------------------------- |
| Compact Language     | 6     | `compact`, `compact-lsp`, `compact-tree-sitter`, `compact-zed`              |
| SDKs & APIs          | 5     | `midnight-js`, `midnight-sdk`, `midnight-wallet`, `midnight-dapp-connector` |
| Core Infrastructure  | 9     | `midnight-node`, `midnight-indexer`, `midnight-ledger`, `midnight-zk`       |
| ZK & Cryptography    | 6     | `midnight-trusted-setup`, `fri`, `galois_recursion`, `pluto_eris`           |
| Documentation        | 5     | `midnight-docs`, `midnight-improvement-proposals`, `midnight-architecture`  |
| Examples & Templates | 18    | `example-counter`, `example-bboard`, `example-kitties`, `example-zkloan`    |
| Identity             | 5     | `midnight-did`, `midnight-did-resolver`, `midnight-verifiable-credentials`  |
| Contracts & Bridges  | 3     | `midnight-contracts`, `midnight-committee-bridge-contracts`                 |
| Token Distribution   | 4     | `night-token-distribution`, `midnight-tcnight-mint`                         |
| Developer Tools      | 5     | `setup-compact-action`, `midnight-dev-utils`, `midnight-local-dev`          |
| Infrastructure       | 6     | `midnight-monitoring`, `midnight-tracing`, `midnight-operations`            |
| Solutions & Apps     | 7     | `midnight-solutions`, `midnight-website-next`, `nightcap`, `ocp`            |
| QA & Testing         | 1     | `midnight-qa-demo`                                                          |
| Community            | 3     | `contributor-hub`, `lfdt-project-proposals`, `UTxO-Scalability`             |
| Glacier Drop         | 15    | `midnight-glacier-drop-tools`, `gd-claim-api`, `gd-claim-portal`            |
| Partners & Community | 20    | OpenZeppelin, BrickTowers, MeshJS, PaimaStudios, hackathon winners, Olanetsoft |

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
