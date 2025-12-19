# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
