# How It Works

## The Problem

AI models have training cutoff dates. When asked to write Midnight code, they use outdated syntax from their training data. The generated code doesn't compile.

## The Solution

MCP gives the AI access to **current** code from GitHub. The AI calls MCP tools, gets real examples, and writes code that actually works.

```
Without MCP:
  AI uses 2023 training data → outdated syntax → compile error

With MCP:
  AI calls midnight-get-latest-syntax → gets v0.15.0 syntax → code compiles
```

## Division of Labor

| Component   | Reasoning? | Does what                                     |
| ----------- | ---------- | --------------------------------------------- |
| AI (Claude) | Yes        | Understands request, picks tools, writes code |
| MCP Server  | No         | Fetches data, returns JSON                    |
| Hosted API  | No         | Vector search                                 |
| GitHub      | No         | Stores source code                            |

The AI does all the thinking. MCP just provides accurate data.

## Example Flow

**User**: "Write a token contract"

**AI decides**:

1. Check latest Compact version
2. Look for breaking changes
3. Find token examples
4. Get syntax reference

**AI calls tools**:

```
midnight-get-version-info { repo: "compact" }
  → { latestVersion: "v0.15.0", recentBreakingChanges: ["export keyword"] }

midnight-search-compact { query: "token transfer balance" }
  → [{ content: "export circuit transfer(...)", score: 0.92 }]

midnight-get-latest-syntax { repo: "compact" }
  → { syntaxFiles: [{ path: "reference.md", content: "..." }] }
```

**AI writes code** using the returned data:

```compact
ledger {
  balances: Map<PubKey, Uint<64>>
}

export circuit transfer(to: PubKey, amount: Uint<64>) {
  // Uses 'export' not 'public' (changed in v0.13.0)
  ...
}
```

## Tool Categories

**Version tools** - prevent outdated syntax:

- `midnight-get-version-info` - latest release
- `midnight-check-breaking-changes` - what changed
- `midnight-get-migration-guide` - how to upgrade
- `midnight-get-file-at-version` - code at specific version
- `midnight-compare-syntax` - diff between versions
- `midnight-get-latest-syntax` - canonical reference

**Search tools** - find examples:

- `midnight-search-compact` - Compact code
- `midnight-search-typescript` - SDK code
- `midnight-search-docs` - documentation

**Analysis tools** - understand code:

- `midnight-analyze-contract` - structure, patterns, security
- `midnight-explain-circuit` - what a circuit does

**Repository tools** - fetch files:

- `midnight-get-file` - any file
- `midnight-list-examples` - example contracts
- `midnight-get-latest-updates` - recent commits
