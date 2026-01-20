# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.14] - 2026-01-20

### Added

- **Hosted Compiler Integration** - New `midnight-compile-contract` tool for real contract validation
  - Connects to hosted Compact compiler at `compact-playground.onrender.com`
  - Fast mode (`skipZk=true`): Syntax validation in ~1-2 seconds
  - Full mode (`fullCompile=true`): Complete ZK circuit generation in ~10-30 seconds
  - Returns actual compiler errors with line/column locations
  - Catches semantic errors that static analysis misses (sealed fields, disclose rules, type mismatches)
  - Automatic fallback to static analysis when compiler service is unavailable
  - Response includes `validationType: "compiler"` or `"static-analysis-fallback"` to indicate mode
  - Configurable via `COMPACT_COMPILER_URL` environment variable

### Changed

- **Tool Count** - Now 29 tools (was 28)
- **Analysis Category** - Added `compile-contract` alongside existing static analysis tools

## [0.2.13] - 2026-01-18

### Added

- **Update Instructions Tool** - New `midnight-get-update-instructions` tool for platform-specific update guidance
  - Auto mode returns instructions for ALL supported editors (Claude Desktop, Cursor, VS Code, Windsurf)
  - Platform detection (macOS/Windows/Linux) with editor-specific config paths
  - Step-by-step instructions with troubleshooting section
  - Example config formats for each editor

- **Periodic Version Checks** - Automatic version checking every 10 tool calls
  - Re-checks for updates if >5 minutes since last check
  - Shows update notification in tool responses when outdated
  - Improved update messages with actionable quickFix steps

- **Undocumented Features Section** - New documentation section covering features not in official Midnight docs
  - Tuple destructuring status
  - Constant folding in indices
  - Bytes ↔ Vector casting
  - Division and modulo operators

### Fixed

- **Type Casting Documentation** - Fixed to match official Midnight type cast table
  - Boolean → Field is NOT allowed (must go through Uint)
  - Field ↔ Bytes can fail at runtime (conversion type)
  - Added all three cast kinds: static (always succeeds), conversion (semantic change), checked (can fail)

- **Compiler Package Hallucination** - Prevented LLM from suggesting fake npm packages
  - Added explicit instructions about `compact compile` command
  - Clarified compiler comes with Midnight toolchain, NOT npm
  - Updated all prompts to prevent suggesting `@midnight-ntwrk/compact-cli`

- **Division Operator Handling** - Changed from error to warning
  - Division `/` and modulo `%` simply not mentioned in docs (not explicitly unsupported)
  - Added workaround hint: use witness for off-chain computation

- **Map.lookup() Behavior** - Added caveat about return type
  - Docs show `value_type` not `Maybe<value_type>`
  - Recommendation: check `member()` before `lookup()` for safety

- **Windows Support** - Platform-specific commands in update instructions
  - Unix: `rm -rf ~/.npm/_npx`
  - Windows: PowerShell `Remove-Item` with cmd.exe alternative
  - Platform-aware troubleshooting steps

- **Repository URLs** - Fixed all URLs to point to `Olanetsoft/midnight-mcp` (not mirror)

### Improved

- **Bytes/Opaque Types Documentation** - Added detailed caveats and source annotations
  - Fixed invalid `Opaque<"address">` to `Bytes<32>`
  - Clarified only two tags allowed: `"string"` and `"Uint8Array"`
  - Added notes about on-chain storage (not encrypted)

- **Maybe/Either Examples** - Added comprehensive usage examples
  - `some()`, `none()`, `left()`, `right()` constructor examples
  - Common patterns: `find_user`, `burnAddress()`
  - Clarified descriptions (has/hasn't, one or other)

- **Style vs Requirements** - Separated syntax requirements from style conventions
  - Requirements: Must follow or code won't compile
  - Conventions: Style guides that don't affect compilation
  - Updated LLM prompts to distinguish between the two

- **Uint/Division Documentation** - Added source annotations clarifying what's documented vs inferred

## [0.2.12] - 2026-01-16

### Fixed

- **Critical: Package Startup** - Fixed `Cannot find module '../../package.json'` error
  - v0.2.11 broke startup by using `createRequire` to load package.json at runtime
  - Now uses build-time version injection via tsup `define` (which was already configured)
  - Version is properly embedded during build, no runtime file loading needed

## [0.2.11] - 2026-01-16

### Fixed

- **Health Check Version** - Fixed version reporting in health check endpoint
  - Was showing hardcoded fallback `0.0.3` instead of actual package version
  - Now reads version directly from package.json for accurate reporting

## [0.2.10] - 2026-01-16

### Added

- **Hybrid Syntax Validation** - Every `midnight-get-latest-syntax` call now validates static content against indexed documentation
  - New `syntax-validator.ts` service with functions: `searchADTInfo()`, `validateADTOperations()`, `searchCompactSyntax()`, `enrichSyntaxReference()`, `verifyClaimAgainstDocs()`
  - Validates all ADT types (Counter, Map, Set, MerkleTree) against indexed docs on each request
  - Reports discrepancies between static references and indexed documentation
  - Returns `hybridValidation` field with validation status, warnings, and enrichments
  - Indexed docs are now the source of truth; static data is fallback

### Fixed

- **Counter ADT Method** - Fixed incorrect `.value()` references to correct `.read()` method
  - Counter ADT uses `.read()` to get current value, NOT `.value()` (which never existed)
  - Updated across all documentation, error messages, and static references

- **Import Syntax** - Replaced undocumented `include` directive with official `import` syntax
  - Changed `include "std"` to `import CompactStandardLibrary;`
  - Updated all OpenZeppelin examples to use `import "path" prefix Name_;` syntax
  - Parser now supports both `import` (new) and `include` (legacy) for backwards compatibility

- **Code Examples** - Fixed multiple issues in embedded code templates
  - Token template: Changed `totalSupply` from `Counter` to `Uint<64>` for accurate tracking
  - Token `mint()`: Now uses `totalSupply += amount` instead of `totalSupply.increment(1)`
  - Voting template: Fixed `proposalId` type mismatch (`Uint<64>` vs `Uint<32>`)
  - Map keys now use `Uint<64>` to match `Counter.read()` return type

- **Documentation Accuracy**
  - Added Uint type equivalence explanation (`Uint<N>` = `Uint<0..(2^N-1)>`)
  - Resolved Map/Set circuit availability contradiction (both work in circuits)
  - Added complete Map/Set ADT operations from official docs (insertDefault, isEmpty, size, etc.)
  - Fixed bigint literals in examples (`1n` → `1` for Compact compatibility)

- **Syntax Validator** - Fixed type extraction regex for generic types
  - Old `split(/[=<>+*]/)` broke on `Uint<64>` angle brackets
  - New regex properly captures full types like `Uint<64> == Uint<64>`

### Changed

- **Architecture Improvement** - Static syntax data is now always validated against indexed docs
  - Previously, `midnight-get-latest-syntax` returned hardcoded static content without verification
  - Now performs hybrid validation: static (fast) + indexed (correct) = best of both
  - `LedgerADTOperations` interface added for type safety in compact-version.ts
  - Added missing operations to `LEDGER_TYPE_LIMITS` to match documentation

## [0.2.9] - 2026-01-14

### Added

- **Expanded Repository Indexing** - Now indexing 102 repositories (88 midnightntwrk + 14 community)
  - All 88 non-archived repos from `midnightntwrk` organization (public + private)
  - 14 community/partner repos (OpenZeppelin, BrickTowers, PaimaStudios, hackathon winners)
  - Correct default branches for all repos (main, master, dev, develop, gh-pages, PoUW)
  - Requires `MIDNIGHT_GITHUB_TOKEN` secret with org access for private repos

### Fixed

- **Security & Type Safety Improvements**
  - Added regex injection prevention with `escapeRegex()` helper in contract validation
  - Fixed cache mapping to properly preserve `HostedSearchResult` metadata (codeType, name, isExported, section)
  - Added validation for `parseInt()` results in line number parsing to prevent NaN assignment
  - Added typed cache interfaces (`SearchCacheResult`, `MetadataCacheEntry`)
  - Fixed NDJSON sanitization for Vectorize API to handle control characters

### Changed

- **Code Quality Improvements**
  - Added language constants (`LANGUAGES`, `EXTENSION_LANGUAGE_MAP`) to parser
  - Improved handler type documentation with explanation of Zod validation
  - Replaced `any` types with proper typed interfaces throughout handlers

## [0.2.8] - 2026-01-13

### Fixed

- **Cursor Compatibility** - Improved error handling for non-Claude Desktop clients
  - `midnight-explain-circuit`: Returns schema-compliant response even when no circuit found (previously returned `{error, suggestion}` which violated output schema)
  - Resource URI errors: Helpful suggestions when using invalid prefixes like `midnight://resources/` instead of valid ones (`midnight://docs/`, `midnight://code/`, `midnight://schema/`)
  - Sampling tools: Gracefully detect `-32601 Method not found` errors and disable sampling for session instead of failing repeatedly

### Changed

- **Internal Refactoring** - Removed dead code
  - Removed unused `samplingVerified` variable from sampling service
  - Removed unused exports (`markSamplingFailed`, `requestCompletion`) from services barrel export

## [0.2.7] - 2026-01-09

### Fixed

- **Response Truncation** - Prevent "Tool result could not be submitted" errors
  - `midnight-get-file`: Now truncates files >50KB to prevent MCP response overflow
  - `midnight-get-file-at-version`: Same truncation applied
  - `midnight-compare-syntax`: Truncates both old/new content if >50KB
  - `midnight-get-latest-syntax`: Truncates syntax files for non-Compact repos
  - All truncated responses include `truncated: true` flag for transparency

### Added

- **Line-Range Parameters** - Request specific sections of large files
  - `midnight-get-file` now accepts `startLine` and `endLine` parameters
  - Allows precise extraction without full file retrieval
  - Useful for navigating truncated files

- **Smart Truncation with Agent Guidance** - Language-aware content preservation
  - **Compact files**: keeps 80% from top (40KB) + 20% from bottom (10KB)
    - Pragma and imports are critical for compilation, prioritized
  - **TypeScript/JS files**: balanced 50/50 split (25KB each)
    - Preserves imports at top AND exports at bottom
  - Clear marker in truncated content shows exact line numbers omitted
  - `agentGuidance` field provides:
    - `whatYouHave`: Description of content the agent received (with percentage breakdown)
    - `whatIsMissing`: Exact line range and byte count of omitted content
    - `howToGetMore`: Instructions for retrieving missing content
    - `suggestedNextCalls`: Pre-computed `startLine`/`endLine` params to request omitted sections
  - Enables agents to autonomously continue reading if needed

- **Truncation Logging** - Monitor truncation events
  - `logger.info` emitted when content is truncated
  - Includes repository, path, original size, and omitted line range
  - Helps tune the 50KB limit based on real usage

## [0.2.6] - 2026-01-06

### Fixed

- **Pattern Collision in suggest-tool** - Improved intent routing accuracy
  - Added `matchScore` tie-breaker: longer/more specific patterns rank higher
  - "fetch the latest docs" now correctly routes to `fetch-docs` instead of `search-docs`
  - Added more specific patterns to `fetch-docs` (e.g., "fetch the latest", "real-time docs")

- **Path Validation** - Enhanced security for `fetch-docs`
  - Block path traversal attempts (`../`)
  - Block protocol injection (`http://`, `https://`, `//`)

- **Missing Annotation** - Added `idempotentHint` to `fetch-docs`

### Tests

- Added routing tests for `fetch-docs` vs `search-docs` disambiguation
- Synced test file's `suggestTool` implementation with handler changes

## [0.2.5] - 2026-01-06

### Fixed

- **Automatic Retry for Hosted API** - Improved reliability and DX
  - Requests now automatically retry up to 3 times on transient failures
  - Exponential backoff: 1s, 2s delays between retries
  - Only retries recoverable errors (timeouts, 502/503/504, network issues)
  - Client errors (4xx) fail immediately with actionable messages
  - Increased timeout from 10s to 15s for complex queries

## [0.2.4] - 2026-01-06

### Added

- **Live Documentation Fetching** - New `midnight-fetch-docs` tool for real-time docs
  - Fetches live content from docs.midnight.network (SSG-powered)
  - Parses Docusaurus HTML to extract title, content, headings
  - Optional `extractSection` param to get specific sections by heading
  - 15KB content truncation for token efficiency
  - Graceful handling of 404s, timeouts, and network errors

- **Freshness Hint** - `midnight-search-docs` now suggests using `fetch-docs` for guaranteed latest content

### Documentation

- Updated tool count to 28 across README and ARCHITECTURE docs
- Added 8 previously undocumented tools to ARCHITECTURE.md tools table

## [0.2.3] - 2026-01-02

### Added

- **Intent-based Tool Discovery** - New `midnight-suggest-tool` for natural language tool recommendations
  - Describe what you want to accomplish, get tool suggestions with confidence levels
  - 35 intent patterns covering all 27 tools (100% coverage)
  - Fallback to `midnight-list-tool-categories` when no match found

- **Usage Guidance in Tool Descriptions** - Helps prevent excessive tool calls
  - Search tools: "Call at most 2 times per question"
  - Analyze tools: "Call once per contract - results are deterministic"
  - Repository tools: "Use midnight-list-examples first if unsure"

- **Comprehensive Meta Tests** - 28 new tests for suggestTool functionality

### Improved

- **Actionable Error Messages** - Better guidance when hosted API returns errors
  - Status-specific messages (rate limits, timeouts, server errors)
  - Suggests `MIDNIGHT_LOCAL=true` for local mode when appropriate
  - Includes server error details when available

## [0.2.0] - 2025-12-28

### Added

- **HTTP Transport Support** - Run as HTTP server with SSE + Streamable HTTP
  - `npx midnight-mcp --http --port 3000`
  - Health check endpoint at `/health`
  - Streamable HTTP at `/mcp`
  - SSE endpoint at `/sse`

- **CLI with yargs** - Rich command-line interface
  - `--stdio` - Use stdio transport (default, for Claude Desktop)
  - `--http` - Use HTTP transport
  - `--port <number>` - HTTP port (default: 3000)
  - `--json` - Output in JSON format (default: YAML)
  - `--github-token <token>` - Override GITHUB_TOKEN env var
  - `--help` / `-h` - Show help
  - `--version` / `-v` - Show version

- **YAML Output by Default** - Tool responses now use YAML format
  - ~20-30% more token-efficient for LLM consumption
  - Use `--json` flag to revert to JSON output

- **Changesets** - Automated changelog and versioning
- **server.json** - MCP registry metadata for IDE discovery

### Changed

- **Build system migrated from tsc to tsup**
  - 10-100x faster builds (55ms → 40ms)
  - Single bundled output (314KB vs 50+ files)
  - Build-time version injection (no more runtime `createRequire`)

- **Project structure improved**
  - `bin.ts` - Dedicated CLI entry point
  - `index.ts` - Library exports only
  - Separate `typecheck` script (`tsc --noEmit`)

- **Tool pattern standardized** - All tool categories now follow consistent folder structure
  - `search/`, `health/`, `analyze/`, `generation/`, `meta/` folders
  - Each with `schemas.ts`, `handlers.ts`, `tools.ts`, `index.ts`
  - Matches `repository/` pattern already in use
  - Easier to maintain and test

### Scripts

```bash
npm run build        # tsup (fast bundling)
npm run typecheck    # Type checking only
npm run dev          # tsup --watch (auto-reload)
npm start            # stdio mode (default)
npm run start:http   # HTTP mode on port 3000
```

## [0.1.41] - 2025-12-27

### Fixed

- **Version sync**: `CURRENT_VERSION` now reads from `package.json` automatically
  - No more manual updates needed when bumping version
  - Fixes stale version reporting in health checks and update notifications

## [0.1.40] - 2025-12-27

### Fixed

- **CRITICAL: Map/Set operations documentation was WRONG**
  - `Map.lookup()` IS available in circuits (previously documented as unavailable)
  - `Map.member()` IS available in circuits (previously documented as unavailable)
  - `Set.member()` IS available in circuits (previously documented as unavailable)
  - Verified against OpenZeppelin contracts and real compiler behavior

### Added

- **New compiler error patterns** with fixes:
  - `cannot cast from type Uint<64> to type Bytes<32>` → Use `(amount as Field) as Bytes<32>`
  - `expected type Uint<64> but received Uint<0..N>` → Cast arithmetic: `(a + b) as Uint<64>`
  - `potential witness-value disclosure must be declared` → Disclose params: `const d = disclose(param)`

- **Type casting rules** in `TYPE_COMPATIBILITY`:
  - `Uint<64> → Bytes<32>`: Must go through Field first
  - `Uint<N> → Field`: Direct cast allowed
  - Arithmetic results need explicit cast back to target type

- **Arithmetic result type documentation**:
  - `Uint<64> + Uint<64>` produces `Uint<0..36893488147419103230>`
  - Must cast back: `(a + b) as Uint<64>`

### Changed

- **Tool description updated** - `midnight-get-latest-syntax` now shows:
  - "🚨 CALL THIS BEFORE GENERATING ANY COMPACT CODE!"
  - Lists Map.lookup/Set.member as available in circuits
  - Emphasizes disclose() requirement for circuit params

- **Prompts enhanced** with new compiler error patterns:
  - `create-contract` prompt includes type casting rules
  - `debug-contract` prompt includes new error→fix mappings

### Removed

- Duplicate anti-hallucination tools (getSampleContract, verifyCompactSyntax)
  - Functionality already exists in `midnight-get-latest-syntax`

## [0.1.39] - 2025-12-27

### Added

- **Tool call tracking** - Dashboard now tracks ALL MCP tool calls
  - New API endpoint: `POST /v1/track/tool`
  - Dashboard shows: Tool Calls metric, Tool Usage chart, Recent Tool Calls table
  - Fire-and-forget tracking (doesn't slow down tool responses)

## [0.1.38] - 2025-12-26

### Changed

- **Deprecated auto-update tool** - Clarified that AI cannot auto-update config
  - AI runs in sandbox without filesystem access
  - Updated all prompts to give manual update instructions
  - Tool still exists but returns manual instructions

## [0.1.37] - 2025-12-26

### Fixed

- **Witness syntax** - Witnesses are declarations only, no body allowed
  - Wrong: `witness fn(): T { return ...; }`
  - Correct: `witness fn(): T;`

- **Pure circuit syntax** - Use "pure circuit" not "pure function"
  - Wrong: `pure function helper(): T`
  - Correct: `pure circuit helper(): T`

## [0.1.36] - 2025-12-26

### Fixed

- **Enum dot notation** - Compact uses dot notation, not Rust-style ::
  - Wrong: `Choice::rock`, `GameState::waiting`
  - Correct: `Choice.rock`, `GameState.waiting`

## [0.1.35] - 2025-12-26

### Added

- **Built-in Functions Reference** - Clear distinction between stdlib functions vs patterns
  - `persistentHash`, `persistentCommit`, `pad`, `disclose`, `assert` are BUILT-IN
  - `public_key()` is NOT built-in - must use persistentHash pattern
  - `verify_signature`, `random` are NOT built-in - must use witnesses

- **Type Compatibility Matrix** - What types can be compared/operated together
  - Field vs Uint comparisons require casting
  - Uint<0..N> for bounded parameters
  - Safe vs unsafe casts documented

- **Ledger Type Limits in Circuits** - What operations work where
  - Counter: `increment/decrement` ✓, `value()` ✗
  - Map: `insert/remove` ✓, `lookup/member` ✗
  - Set: `insert/remove` ✓, `member` ✗
  - Includes workaround patterns using witnesses

- **Common Compilation Errors** - Actual error messages with fixes
  - "unbound identifier public_key" → use persistentHash pattern
  - "incompatible combination of types Field and Uint" → cast or use bounded params
  - "operation value undefined for Counter" → use witness or TypeScript SDK

### Fixed

- **Incorrect Counter/Map/Set documentation** - Removed claims that `.value()`, `.lookup()`, `.member()` work in circuits (they don't)
- **Incomplete commit-reveal pattern** - Now includes complete, validated example with pragma

## [0.1.34] - 2025-12-26

### Fixed

- **Connection timing bug** - Fixed crash in Claude Desktop with "Not connected" error
  - Added `isConnected` flag to track when server transport is ready
  - Modified `sendLogToClient` to check connection state before sending notifications
  - Prevents log notifications from being sent before MCP handshake completes

## [0.1.33] - 2025-12-26

### Fixed

- **Complete syntax reference rewrite** - Fixed critical errors in embedded documentation
  - Fixed `ledger { }` block syntax → now shows correct `export ledger field: Type;`
  - Fixed `Void` return type → now shows correct `[]` (empty tuple)
  - Fixed pragma format → now shows correct `>= 0.16 && <= 0.18`
  - Added Quick Start Template that always compiles
  - Added `commonMistakes` array to tool response
  - Added `referenceContracts` pointing to known-good repos

### Added

- **5 new P0 static analysis checks** in `midnight-extract-contract-structure`:
  - `deprecated_ledger_block` - catches `ledger { }` syntax
  - `invalid_void_type` - catches `Void` return type
  - `invalid_pragma_format` - catches old pragma with patch version
  - `unexported_enum` - warns about enums not accessible from TypeScript
  - `deprecated_cell_wrapper` - catches `Cell<T>` (deprecated since 0.15)

- **Smarter agent workflow** - Prompts now enforce syntax checking before/after generation
  - `create-contract` prompt: Must call `midnight-get-latest-syntax` BEFORE generating
  - `review-contract` prompt: Must call `midnight-extract-contract-structure` FIRST to validate
  - `debug-contract` prompt: Must run static analysis to catch P0 errors first
  - All prompts instruct agents to fix P0 errors before returning code to user

- **CI syntax drift detection tests** - New test suite to catch future doc drift
  - Tests that Quick Start Template passes static analysis with zero P0 errors
  - Tests that all 5 common mistakes are detected by static analysis
  - Tests that correct patterns don't trigger false positives
  - Tests that documentation includes WRONG/CORRECT examples
  - Tests full contract templates (counter, token) compile correctly

### Changed

- Updated `midnight-get-latest-syntax` response to include:
  - `quickStartTemplate` - minimal compiling contract
  - `commonMistakes` - array of wrong/correct patterns with error messages
  - `referenceContracts` - links to known-good example repos
- Updated embedded docs version from 0.16 to 0.18

## [0.1.32] - 2025-12-26

### Fixed

- Removed stale references to `midnight-validate-contract` (tool was removed in v0.1.29)
  - Updated `midnight-analyze-contract` description
  - Updated `midnight-check-version` description and feature list

## [0.1.31] - 2025-12-26

### Added

- **Auto-Update Config Tool**: AI agents can now update user configs automatically
  - New `midnight-auto-update-config` tool provides config file paths
  - Agent can edit config to add `@latest` without user manual steps
  - Supports Claude Desktop, Cursor, VS Code, and Windsurf configs
  - User only needs to restart their editor after agent updates config

### Changed

- Update notifications now instruct AI agents to auto-update configs
- Removed manual CLI steps from update flow

## [0.1.30] - 2025-12-25

### Added

- **MCP Logging Capability**: Server now exposes logging to clients
  - Clients can set log level via `logging/setLevel` request
  - Log messages are sent as `notifications/message` to connected clients
  - Supports all MCP log levels: debug, info, notice, warning, error, critical, alert, emergency
  - Great for debugging and monitoring server activity

- **MCP Completions Capability**: Autocomplete for prompt arguments
  - Suggests contract types: token, voting, credential, auction, escrow
  - Suggests privacy levels: full, partial, public
  - Suggests complexity levels: beginner, intermediate, advanced
  - Works with all 5 prompts

- **Progress Notifications**: Real-time progress for compound tools
  - `midnight-upgrade-check` shows: "Fetching version info..." → "Checking breaking changes..." → "Analysis complete"
  - `midnight-get-repo-context` shows: "Fetching version info..." → "Loading syntax reference..." → "Context ready"

- **Structured Content**: Tool responses now include `structuredContent` field
  - Machine-readable JSON alongside text content
  - Clients can use structured data directly without JSON.parse()

## [0.1.29] - 2025-12-25

### Changed

- **Removed `midnight-validate-contract` tool**: Compiler-based validation required local installation which most users don't have
- **Rebranded `midnight-extract-contract-structure`**: Now positioned as static pattern analysis tool under "analyze" category
- Simplified tool descriptions - removed excessive warnings and emojis
- Total tools: 25 (down from 26)
- Total categories: 7 (removed "validation" category)

### Fixed

- Tool count now correctly reports 25 tools
- README cleaned up and reorganized for better readability

## [0.1.28] - 2025-12-25

### Fixed

- Tool count now correctly includes meta tools (was reporting 24, actually 26)

## [0.1.27] - 2025-12-25

### Added

- **2 New Pre-compilation Checks** based on real-world testing:
  - `invalid_if_expression`: Detects `if` statements used in assignment context (should use ternary `? :`)
  - `invalid_void_type`: Detects `Void` return type (doesn't exist - should use `[]` empty tuple)
- Total pre-compilation checks: 12 issue types

## [0.1.26] - 2025-12-25

### Added

- **Prominent Update Prompts**: When outdated, ALL tool responses now include actionable update instructions for the AI agent
- Agent is explicitly instructed to help users update immediately
- Lists missing features so agent understands importance of updating

## [0.1.25] - 2025-12-25

### Added

- **Auto-Update Detection**: Server checks npm registry at startup (non-blocking, 5s timeout)
- Update warnings included in key tool responses when outdated
- Logs warning when outdated version detected

## [0.1.24] - 2025-12-25

### Added

- **`midnight-check-version` tool**: Check if you're running the latest version with detailed update instructions
- README updated to recommend `@latest` tag for auto-updates
- Clear instructions for clearing npx cache

## [0.1.23] - 2025-12-24

### Changed

- **Explicit Tool Descriptions**: Updated all validation tool descriptions to be extremely clear about their purpose
- `midnight-validate-contract`: Now marked as "🔴 REQUIRED - ALWAYS CALL FIRST"
- `midnight-analyze-contract`: Now marked as "⚠️ STATIC ANALYSIS ONLY - NOT A COMPILER"
- `midnight-extract-contract-structure`: Now explicitly warns against using for verification

## [0.1.22] - 2025-12-24

### Added

- **Constructor Parameter Disclosure Detection** (`undisclosed_constructor_param`): Detects constructor params assigned to ledger without `disclose()`
- Total pre-compilation checks: 10 issue types

## [0.1.21] - 2025-12-24

### Added

- **4 New Pre-compilation Checks**:
  - `unsupported_division`: Detects `/` operator (not supported in Compact)
  - `invalid_counter_access`: Detects `.value` access on Counter type
  - `potential_overflow`: Detects Uint multiplication that may overflow
  - `undisclosed_witness_conditional`: Detects witness values in conditionals without `disclose()`

## [0.1.20] - 2025-12-24

### Changed

- Improved tool descriptions to guide AI to use `validate_contract` first
- `validate_contract` marked as PRIMARY verification tool
- `extract_contract_structure` clarified as static analysis only

## [0.1.19] - 2025-12-24

### Added

- **Pre-compilation Issue Detection** in `extract_contract_structure`:
  - `module_level_const`: Detects const declarations outside circuit blocks
  - `stdlib_name_collision`: Detects redefinition of stdlib functions
  - `sealed_export_conflict`: Detects exported circuits modifying sealed fields
  - `missing_constructor`: Warns when sealed fields exist without constructor
  - `stdlib_type_mismatch`: Detects incorrect usage of stdlib return types

## [0.1.18] - 2025-12-24

### Added

- **`midnight-validate-contract` tool**: Compile contracts using the REAL Compact compiler
  - Returns detailed errors with line numbers
  - Provides installation instructions if compiler not found
  - Suggests fixes based on common error patterns
- **`midnight-extract-contract-structure` tool**: Static analysis fallback
  - Extracts circuits, witnesses, ledger items, types, structs, enums
  - Detects potential issues without requiring compiler

## [0.2.0] - 2025-12-23

### Added

- **Compound Tools** - Multi-step operations in a single call (reduces token usage by 50-70%):
  - `midnight-upgrade-check`: Combines version check + breaking changes + migration guide
  - `midnight-get-repo-context`: Combines version info + syntax reference + relevant examples
- **Tool Categories** for progressive disclosure:
  - `search`, `analyze`, `repository`, `versioning`, `generation`, `health`, `compound`
  - Enables clients to group/filter tools by domain
- **Discovery Meta-Tools** for progressive exploration:
  - `midnight-list-tool-categories`: List all 7 categories with descriptions
  - `midnight-list-category-tools`: Drill into a category to see its tools
- **Enhanced Tool Annotations**:
  - `destructiveHint`: Marks tools that perform irreversible actions
  - `requiresConfirmation`: Marks tools requiring human confirmation
  - `category`: Tool category for UI grouping
- **LLM Self-Correction Hints** in error responses:
  - Structured errors with `correction` field for AI retry logic
  - Specific hints for unknown repos, invalid versions, missing params
  - Alternative suggestions when sampling not available

### Changed

- All 23 tools now include category annotations (19 original + 2 compound + 2 meta)
- Compound tools marked with ⚡ emoji for visibility
- Discovery tools marked with 📋 emoji
- Improved upgrade recommendations with urgency levels (none/low/medium/high/critical)

## [0.1.9] - 2025-12-23

### Fixed

- **Permanent fix for undefined repo parameter**: All repository handlers now safely default to "compact" when repo param is undefined/empty
- Fixed toLowerCase error in `midnight-get-latest-syntax`, `midnight-get-version-info`, `midnight-check-breaking-changes`, `midnight-get-migration-guide`, `midnight-get-file-at-version`, and `midnight-compare-syntax` tools
- Handlers now use defensive coding pattern with `input?.repo || "compact"`

## [0.1.1] - 2025-12-21

### Fixed

- Throw error on invalid subscription URIs (was silent success)
- Add validation for sampling response structure
- Safe JSON parsing with error handling in AI review tool
- Align output schemas with actual function return types
- Add `clearSubscriptions()` for server reset/testing

## [0.1.0] - 2025-12-21

### Added

- **3 AI-Powered Tools** (require MCP Sampling support):
  - `midnight-generate-contract` - Generate contracts from natural language
  - `midnight-review-contract` - AI security review with suggestions
  - `midnight-document-contract` - Generate markdown/jsdoc documentation

- **Tool Annotations** on all 19 tools:
  - `readOnlyHint`, `idempotentHint`, `openWorldHint`, `longRunningHint`
  - Human-readable `title` for UI display

- **Structured Output Schemas**: JSON schemas for tool outputs

- **Resource Templates** (RFC 6570 URI Templates):
  - `midnight://code/{owner}/{repo}/{path}`
  - `midnight://docs/{section}/{topic}`
  - `midnight://examples/{category}/{name}`
  - `midnight://schema/{type}`

- **Sampling Capability**: Server can request LLM completions from client

- **Resource Subscriptions**: Subscribe/unsubscribe to resource changes

- **Expanded Indexing**:
  - Now indexing `/blog` posts from midnight-docs
  - Now indexing `/docs/api` reference documentation
  - 26,142 documents indexed (up from ~22,000)
  - 24 repositories (removed broken rs-merkle)

## [0.0.9] - 2025-12-20

### Added

- Expanded repository coverage to 25 repos
- Added ZK libraries: halo2, midnight-trusted-setup, rs-merkle
- Added developer tools: compact-tree-sitter, compact-zed, setup-compact-action
- Added community repos: contributor-hub, night-token-distribution

## [0.0.2] - 2025-12-19

### Changed

- Optimized npm package size (426 kB → 272 kB)
- Excluded source maps from published package

### Fixed

- Tool names now use hyphens instead of colons (MCP pattern compliance)
- Claude Desktop config JSON formatting

## [0.0.1] - 2025-12-19

### Added

- Initial release
- **16 MCP Tools**:
  - `midnight-search-compact` - Semantic search for Compact code
  - `midnight-search-typescript` - Search TypeScript SDK code
  - `midnight-search-docs` - Full-text documentation search
  - `midnight-analyze-contract` - Contract analysis and security checks
  - `midnight-explain-circuit` - Circuit explanation in plain language
  - `midnight-get-file` - Retrieve files from repositories
  - `midnight-list-examples` - List example contracts
  - `midnight-get-latest-updates` - Recent repository changes
  - `midnight-get-version-info` - Version and release info
  - `midnight-check-breaking-changes` - Breaking change detection
  - `midnight-get-migration-guide` - Migration guides between versions
  - `midnight-get-file-at-version` - Get file at specific version
  - `midnight-compare-syntax` - Compare files between versions
  - `midnight-get-latest-syntax` - Get latest syntax reference
  - `midnight-health-check` - Server health status
  - `midnight-get-status` - Rate limits and cache stats

- **20 Documentation Resources**:
  - Compact language reference
  - TypeScript SDK docs
  - OpenZeppelin token patterns
  - Security best practices

- **16 Indexed Repositories**:
  - Midnight core repos (compact, midnight-js, docs)
  - Example DApps (counter, bboard, dex)
  - Developer tools (create-mn-app, wallet)
  - OpenZeppelin compact-contracts

- **Features**:
  - Zero-config mode (works without env vars)
  - In-memory caching for GitHub API
  - Graceful degradation without ChromaDB
  - Version-aware code recommendations
