# Midnight MCP API

Backend API for Midnight MCP semantic search.

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Add your OPENAI_API_KEY to .env

# Start ChromaDB
docker run -d -p 8000:8000 chromadb/chroma

# Index repositories
npm run index

# Start server
npm run dev
```

## Environment Variables

| Variable         | Required | Default   | Description                   |
| ---------------- | -------- | --------- | ----------------------------- |
| `OPENAI_API_KEY` | Yes      | -         | OpenAI API key for embeddings |
| `GITHUB_TOKEN`   | No       | -         | GitHub token for indexing     |
| `CHROMA_HOST`    | No       | localhost | ChromaDB host                 |
| `CHROMA_PORT`    | No       | 8000      | ChromaDB port                 |
| `PORT`           | No       | 3000      | Server port                   |

## Endpoints

| Endpoint                | Method | Description            |
| ----------------------- | ------ | ---------------------- |
| `/health`               | GET    | Health check           |
| `/v1/search/compact`    | POST   | Search Compact code    |
| `/v1/search/typescript` | POST   | Search TypeScript code |
| `/v1/search/docs`       | POST   | Search documentation   |

## Example

```bash
curl -X POST http://localhost:3000/v1/search/compact \
  -H "Content-Type: application/json" \
  -d '{"query": "private state", "limit": 5}'
```
