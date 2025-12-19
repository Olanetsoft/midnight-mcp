# Midnight MCP API

Hosted backend for Midnight MCP semantic search. Provides vector search over Midnight blockchain code and documentation.

## Architecture

```
User's MCP Client → midnight-mcp (npm) → This API → ChromaDB + OpenAI
```

## Endpoints

| Endpoint                | Method | Description             |
| ----------------------- | ------ | ----------------------- |
| `/`                     | GET    | Health check            |
| `/health`               | GET    | Detailed health status  |
| `/v1/search`            | POST   | Generic semantic search |
| `/v1/search/compact`    | POST   | Search Compact code     |
| `/v1/search/typescript` | POST   | Search TypeScript code  |
| `/v1/search/docs`       | POST   | Search documentation    |
| `/v1/stats`             | GET    | Index statistics        |

## Setup

### Prerequisites

- Node.js 20+
- ChromaDB running (locally or cloud)
- OpenAI API key

### Local Development

```bash
# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env with your API keys

# Start ChromaDB (in another terminal)
docker run -p 8000:8000 chromadb/chroma

# Index repositories (one-time)
npm run index

# Start development server
npm run dev
```

### Production Deployment

#### Option 1: Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

#### Option 2: Fly.io

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login and deploy
fly auth login
fly launch
fly deploy
```

#### Option 3: Docker

```bash
npm run build
docker build -t midnight-mcp-api .
docker run -p 3000:3000 --env-file .env midnight-mcp-api
```

## Environment Variables

| Variable                | Required | Default   | Description                   |
| ----------------------- | -------- | --------- | ----------------------------- |
| `OPENAI_API_KEY`        | Yes      | -         | OpenAI API key for embeddings |
| `GITHUB_TOKEN`          | No       | -         | GitHub token for indexing     |
| `CHROMA_HOST`           | No       | localhost | ChromaDB host                 |
| `CHROMA_PORT`           | No       | 8000      | ChromaDB port                 |
| `PORT`                  | No       | 3000      | Server port                   |
| `RATE_LIMIT_PER_MINUTE` | No       | 60        | Rate limit per IP             |

## API Usage

### Search Compact Code

```bash
curl -X POST http://localhost:3000/v1/search/compact \
  -H "Content-Type: application/json" \
  -d '{"query": "private ledger state", "limit": 5}'
```

### Search TypeScript

```bash
curl -X POST http://localhost:3000/v1/search/typescript \
  -H "Content-Type: application/json" \
  -d '{"query": "deploy contract", "limit": 5}'
```

### Generic Search

```bash
curl -X POST http://localhost:3000/v1/search \
  -H "Content-Type: application/json" \
  -d '{"query": "zero knowledge proof", "limit": 10, "filter": {"language": "compact"}}'
```

## Rate Limiting

- Default: 60 requests per minute per IP
- Headers returned: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- Returns 429 when exceeded

## Costs

- **Hosting**: $5-20/month (Railway, Fly.io, etc.)
- **OpenAI**: ~$0.02 per 1M tokens (~$0.0001 per query)
- **ChromaDB**: Free (self-hosted) or Chroma Cloud pricing
