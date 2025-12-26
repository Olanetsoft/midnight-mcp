/**
 * Compact Language Version Configuration
 *
 * MAINTAINER: Update these values when Compact language syntax changes!
 * See docs/SYNTAX_MAINTENANCE.md for the full update checklist.
 */

/**
 * Supported Compact language version range
 * Update when new compiler versions are released
 */
export const COMPACT_VERSION = {
  /** Minimum supported version */
  min: "0.16",
  /** Maximum supported version */
  max: "0.18",
  /** When this config was last updated */
  lastUpdated: "2025-01-26",
  /** Source of truth for syntax patterns */
  referenceSource: "https://github.com/piotr-iohk/template-contract",
};

/**
 * Current pragma format that should be used in contracts
 */
export const RECOMMENDED_PRAGMA = `pragma language_version >= ${COMPACT_VERSION.min} && <= ${COMPACT_VERSION.max};`;

/**
 * Known deprecated patterns (add new ones here when Compact evolves)
 */
export const DEPRECATED_PATTERNS = {
  /** Deprecated in: 0.16 */
  ledgerBlock: {
    pattern: /ledger\s*\{/,
    since: "0.16",
    replacement: "export ledger fieldName: Type;",
    description: "Block-style ledger declarations",
  },
  /** Deprecated in: 0.15 */
  cellWrapper: {
    pattern: /Cell\s*<\s*\w+\s*>/,
    since: "0.15",
    replacement: "Type (without Cell wrapper)",
    description: "Cell<T> type wrapper",
  },
  /** Never existed */
  voidType: {
    pattern: /:\s*Void\b/,
    since: "always",
    replacement: "[] (empty tuple)",
    description: "Void return type",
  },
};

/**
 * Reference contracts known to compile successfully
 * Use these to verify syntax is still correct
 */
export const REFERENCE_CONTRACTS = [
  {
    name: "template-contract",
    repo: "piotr-iohk/template-contract",
    description: "Official Midnight template contract",
  },
  {
    name: "tokenomics-project",
    repo: "piotr-iohk/tokenomics-project",
    description: "Token implementation example",
  },
  {
    name: "zswap-example",
    repo: "piotr-iohk/zswap-example",
    description: "Privacy-preserving swap example",
  },
  {
    name: "reentrancy-example",
    repo: "piotr-iohk/reentrancy-example",
    description: "Cross-contract call patterns",
  },
];

/**
 * Get the version info as a string for display
 */
export function getVersionInfo(): string {
  return `Compact ${COMPACT_VERSION.min}-${COMPACT_VERSION.max} (updated ${COMPACT_VERSION.lastUpdated})`;
}

/**
 * Check if a version is within supported range
 */
export function isVersionSupported(version: string): boolean {
  const [major, minor] = version.split(".").map(Number);
  const [minMajor, minMinor] = COMPACT_VERSION.min.split(".").map(Number);
  const [maxMajor, maxMinor] = COMPACT_VERSION.max.split(".").map(Number);

  const versionNum = major * 100 + minor;
  const minNum = minMajor * 100 + minMinor;
  const maxNum = maxMajor * 100 + maxMinor;

  return versionNum >= minNum && versionNum <= maxNum;
}
