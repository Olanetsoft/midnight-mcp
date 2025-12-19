# API Reference

## Tools

### Search Tools

#### midnight-search-compact

Search Compact smart contract code.

```typescript
// Input
{
  query: string;      // Search query
  limit?: number;     // Max results (default: 10)
}

// Output
{
  results: Array<{
    content: string;
    score: number;
    metadata: {
      repository: string;
      filePath: string;
      language: string;
      startLine: number;
      endLine: number;
    };
  }>;
}
```

#### midnight-search-typescript

Search TypeScript SDK code.

```typescript
// Input
{
  query: string;
  limit?: number;
}
// Output: same as search-compact
```

#### midnight-search-docs

Search documentation.

```typescript
// Input
{
  query: string;
  category?: "guides" | "api" | "concepts" | "all";
  limit?: number;
}
// Output: same as search-compact
```

---

### Analysis Tools

#### midnight-analyze-contract

Static analysis of Compact contracts.

```typescript
// Input
{
  code: string;           // Contract source
  checkSecurity?: boolean; // Run security checks (default: true)
}

// Output
{
  structure: {
    hasLedger: boolean;
    hasCircuits: boolean;
    hasWitnesses: boolean;
    ledgerFields: Array<{ name: string; type: string; isShielded: boolean }>;
    circuits: Array<{ name: string; parameters: Array<{name: string; type: string}>; returnType: string; isExported: boolean }>;
    witnesses: Array<{ name: string; parameters: Array<{name: string; type: string}>; returnType: string }>;
  };
  patterns: {
    detected: string[];
    suggestions: string[];
  };
  security: {
    issues: Array<{ severity: "high" | "medium" | "low"; message: string; line?: number }>;
    score: number;
  };
  metrics: {
    lineCount: number;
    circuitCount: number;
    witnessCount: number;
    complexity: "low" | "medium" | "high";
  };
}
```

#### midnight-explain-circuit

Explain circuit logic.

```typescript
// Input
{
  circuitCode: string;
  verbosity?: "brief" | "detailed";
}

// Output
{
  summary: string;
  explanation: string;
  zkImplications: {
    publicInputs: string[];
    privateInputs: string[];
    proofGenerated: string;
  };
  stateChanges: Array<{ field: string; change: string }>;
}
```

---

### Repository Tools

#### midnight-get-file

Fetch file from GitHub.

```typescript
// Input
{
  repository: string;  // e.g., "compact"
  path: string;
  ref?: string;        // Branch/tag (default: "main")
}

// Output
{
  content: string;
  path: string;
  repository: string;
  ref: string;
  size: number;
}
```

#### midnight-list-examples

List example contracts.

```typescript
// Input
{
  category?: "contracts" | "dapps" | "patterns" | "all";
  language?: "compact" | "typescript" | "all";
}

// Output
{
  examples: Array<{
    name: string;
    description: string;
    path: string;
    repository: string;
    complexity: "beginner" | "intermediate" | "advanced";
  }>;
}
```

#### midnight-get-latest-updates

Recent commits across repos.

```typescript
// Input
{
  repository?: string;
  limit?: number;       // Default: 20
  since?: string;       // ISO date
}

// Output
{
  updates: Array<{
    repository: string;
    sha: string;
    message: string;
    author: string;
    date: string;
    filesChanged: string[];
  }>;
}
```

#### midnight-get-version-info

Get latest version info.

```typescript
// Input
{
  repo: string;
}

// Output
{
  repository: string;
  latestVersion: string;
  latestStableVersion: string;
  publishedAt: string | null;
  releaseNotes: string | null;
  recentReleases: Array<{ version: string; date: string; isPrerelease: boolean }>;
  recentBreakingChanges: string[];
}
```

#### midnight-check-breaking-changes

Check for breaking changes.

```typescript
// Input
{
  repo: string;
  currentVersion: string;
}

// Output
{
  currentVersion: string;
  latestVersion: string;
  isOutdated: boolean;
  versionsBehind: number;
  hasBreakingChanges: boolean;
  breakingChanges: string[];
  recommendation: string;
}
```

#### midnight-get-migration-guide

Migration guide between versions.

```typescript
// Input
{
  repo: string;
  fromVersion: string;
  toVersion?: string;    // Default: latest
}

// Output
{
  from: string;
  to: string;
  breakingChanges: string[];
  deprecations: string[];
  newFeatures: string[];
  migrationSteps: string[];
  migrationDifficulty: string;
}
```

#### midnight-get-file-at-version

File at specific version.

```typescript
// Input
{
  repo: string;
  path: string;
  version: string;
}

// Output
{
  content: string;
  version: string;
}
```

#### midnight-compare-syntax

Diff file between versions.

```typescript
// Input
{
  repo: string;
  path: string;
  oldVersion: string;
  newVersion?: string;   // Default: latest
}

// Output
{
  hasDifferences: boolean;
  oldContent: string | null;
  newContent: string | null;
}
```

#### midnight-get-latest-syntax

Get syntax reference.

```typescript
// Input
{
  repo?: string;         // Default: "compact"
}

// Output
{
  version: string;
  syntaxFiles: Array<{ path: string; content: string }>;
}
```

#### midnight-health-check

Server health status.

```typescript
// Input: none

// Output
{
  status: "healthy" | "degraded" | "unhealthy";
  mode: "hosted" | "local";
  services: {
    github: boolean;
    vectorStore: boolean;
    hostedApi: boolean;
  }
}
```

#### midnight-get-status

Rate limits and stats.

```typescript
// Input: none

// Output
{
  githubRateLimit: {
    remaining: number;
    limit: number;
    reset: string;
  }
  cacheStats: {
    hits: number;
    misses: number;
  }
  mode: "hosted" | "local";
}
```

---

## Resources

Access via `resources/read` with URI.

| URI                                           | Content                    |
| --------------------------------------------- | -------------------------- |
| `midnight://docs/compact-reference`           | Compact language reference |
| `midnight://docs/sdk-api`                     | TypeScript SDK API         |
| `midnight://docs/concepts/zero-knowledge`     | ZK proofs in Midnight      |
| `midnight://docs/concepts/shielded-state`     | Shielded vs unshielded     |
| `midnight://docs/concepts/witnesses`          | Witness functions          |
| `midnight://docs/concepts/kachina`            | Kachina protocol           |
| `midnight://code/examples/counter`            | Counter contract           |
| `midnight://code/examples/bboard`             | Bulletin board DApp        |
| `midnight://code/patterns/state-management`   | State patterns             |
| `midnight://code/patterns/access-control`     | Access control patterns    |
| `midnight://code/patterns/privacy-preserving` | Privacy patterns           |
| `midnight://code/templates/token`             | Token template             |
| `midnight://code/templates/voting`            | Voting template            |
| `midnight://schema/compact-ast`               | Compact AST schema         |
| `midnight://schema/transaction`               | Transaction schema         |
| `midnight://schema/proof`                     | Proof schema               |

---

## Prompts

### midnight-create-contract

```typescript
{
  name: string;
  purpose: string;
  features?: string[];
  hasPrivateState?: boolean;
}
```

### midnight-review-contract

```typescript
{
  code: string;
  focusAreas?: string[];
}
```

### midnight-explain-concept

```typescript
{
  concept: string;
  audienceLevel?: "beginner" | "intermediate" | "advanced";
}
```

### midnight-compare-approaches

```typescript
{
  goal: string;
  approaches?: string[];
}
```

### midnight-debug-contract

```typescript
{
  code: string;
  error?: string;
  expectedBehavior?: string;
  actualBehavior?: string;
}
```

---

## Errors

```typescript
{
  content: [{ type: "text", text: "Error: <message>" }],
  isError: true
}
```

| Error                          | Cause                |
| ------------------------------ | -------------------- |
| `Unknown tool: <name>`         | Invalid tool name    |
| `Invalid input: <details>`     | Validation failed    |
| `Vector store not initialized` | ChromaDB unavailable |
| `GitHub API error`             | Rate limit or auth   |
