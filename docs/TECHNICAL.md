# Technical Details

## Transport

stdio transport, JSON-RPC 2.0:

```typescript
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
const transport = new StdioServerTransport();
await server.connect(transport);
```

Request format:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "midnight-analyze-contract",
    "arguments": { "code": "..." }
  }
}
```

## Compact Parser

Regex-based extraction from `src/pipeline/parser.ts`:

```typescript
const ledgerRegex = /ledger\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/gs;
const circuitRegex =
  /(?:export\s+)?(circuit)\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*(\w+))?\s*\{/g;
const witnessRegex =
  /(?:export\s+)?(witness)\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*(\w+))?\s*\{/g;
```

Extracts:

- `ledger { }` blocks with fields
- `circuit` and `witness` functions with params/return types
- `export` declarations
- `include` statements

Output structure:

```typescript
interface ParsedFile {
  path: string;
  language: "compact" | "typescript" | "markdown";
  content: string;
  codeUnits: CodeUnit[];
  imports: string[];
  exports: string[];
  metadata: {
    hasLedger: boolean;
    hasCircuits: boolean;
    hasWitnesses: boolean;
    lineCount: number;
  };
}
```

## Embeddings (Local Mode)

Model: `text-embedding-3-small` (1536 dimensions)

Chunking strategy:

1. **Code units** (preferred): each function/circuit/witness = one chunk
2. **File chunks** (fallback): 2000 chars, 5-line overlap

```typescript
const response = await openai.embeddings.create({
  model: "text-embedding-3-small",
  input: text,
});
```

## ChromaDB (Local Mode)

Collection: `midnight-code`

Document schema:

```typescript
{
  ids: string[];
  embeddings: number[][];
  metadatas: Array<{
    repository: string;
    filePath: string;
    language: string;
    startLine: number;
    endLine: number;
    codeType: string;
    codeName: string;
    isPublic: boolean;
  }>;
  documents: string[];
}
```

Query:

```typescript
const results = await collection.query({
  queryEmbeddings: [queryVector],
  nResults: 10,
  where: { language: "compact" },
  include: ["documents", "metadatas", "distances"],
});
```

## GitHub Integration

Rate limits:

- With token: 5000 req/hr
- Without token: 60 req/hr

```typescript
const octokit = new Octokit({ auth: config.githubToken });

const response = await octokit.repos.getContent({ owner, repo, path, ref });
const content = Buffer.from(response.data.content, "base64").toString("utf-8");
```

## Contract Analysis

Pipeline:

```
Code → Parse → Extract structure → Detect patterns → Security checks → Report
```

Pattern detection:
| Pattern | Detection |
| ------------------ | --------------------------------- |
| Access Control | `authorized()`, permission checks |
| State Management | Ledger field analysis |
| Privacy Preserving | Witness vs circuit ratio |
| Token Standards | transfer/mint/burn signatures |

Security checks:
| Check | Detects |
| -------------------- | ---------------------------- |
| Unprotected circuits | Public circuits without auth |
| State leakage | Shielded data in public returns |
| Missing witnesses | Circuits without private computation |

## Logging

Logs to stderr (avoids stdio interference):

```typescript
console.error(
  JSON.stringify({
    level,
    message,
    ...meta,
    timestamp: new Date().toISOString(),
  })
);
```

Levels: `debug`, `info`, `warn`, `error`

Set via `LOG_LEVEL` env var.

## Environment Variables

| Variable         | Required | Default                 | Description         |
| ---------------- | -------- | ----------------------- | ------------------- |
| `GITHUB_TOKEN`   | No       | -                       | GitHub PAT          |
| `OPENAI_API_KEY` | No       | -                       | For local mode      |
| `CHROMA_URL`     | No       | `http://localhost:8000` | ChromaDB endpoint   |
| `MIDNIGHT_LOCAL` | No       | `false`                 | Enable local mode   |
| `HOSTED_API_URL` | No       | (production URL)        | Override hosted API |
| `LOG_LEVEL`      | No       | `info`                  | Logging verbosity   |

## Build

TypeScript config:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "strict": true
  }
}
```

NPM package:

```json
{
  "name": "midnight-mcp",
  "bin": { "midnight-mcp": "./dist/index.js" },
  "type": "module"
}
```

## Testing

Vitest:

```bash
npm test              # Run tests
npm run test:coverage # With coverage
```
