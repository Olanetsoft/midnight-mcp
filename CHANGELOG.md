# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.30] - 2025-12-25

### Added

- **MCP Logging Capability**: Server now exposes logging to clients
  - Clients can set log level via `logging/setLevel` request
  - Log messages are sent as `notifications/message` to connected clients
  - Supports all MCP log levels: debug, info, notice, warning, error, critical, alert, emergency
  - Great for debugging and monitoring server activity

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
