/**
 * Repository tool definitions
 * MCP tool registration for repository-related operations
 */

import type { ExtendedToolDefinition } from "../../types/index.js";
import {
  getFile,
  listExamples,
  getLatestUpdates,
  getVersionInfo,
  checkBreakingChanges,
  getMigrationGuide,
  getFileAtVersion,
  compareSyntax,
  getLatestSyntax,
  upgradeCheck,
  getFullRepoContext,
  validateContract,
  extractContractStructure,
} from "./handlers.js";

// Tool definitions for MCP
export const repositoryTools: ExtendedToolDefinition[] = [
  {
    name: "midnight-get-file",
    description:
      "Retrieve a specific file from Midnight repositories. Use repository aliases like 'compact', 'midnight-js', 'counter', or 'bboard' for convenience.",
    inputSchema: {
      type: "object" as const,
      properties: {
        repo: {
          type: "string",
          description:
            "Repository name (e.g., 'compact', 'midnight-js', 'example-counter')",
        },
        path: {
          type: "string",
          description: "File path within repository",
        },
        ref: {
          type: "string",
          description: "Branch, tag, or commit SHA (default: main)",
        },
      },
      required: ["repo", "path"],
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: true,
      title: "Get Repository File",
      category: "repository",
    },
    handler: getFile,
  },
  {
    name: "midnight-list-examples",
    description:
      "List available Midnight example contracts and DApps with descriptions, complexity ratings, and key features.",
    inputSchema: {
      type: "object" as const,
      properties: {
        category: {
          type: "string",
          enum: ["counter", "bboard", "token", "voting", "all"],
          description: "Filter by example type (default: all)",
        },
      },
      required: [],
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      title: "List Example Contracts",
      category: "repository",
    },
    handler: listExamples,
  },
  {
    name: "midnight-get-latest-updates",
    description:
      "Retrieve recent changes and commits across Midnight repositories. Useful for staying up-to-date with the latest developments.",
    inputSchema: {
      type: "object" as const,
      properties: {
        since: {
          type: "string",
          description: "ISO date to fetch updates from (default: last 7 days)",
        },
        repos: {
          type: "array",
          items: { type: "string" },
          description:
            "Specific repos to check (default: all configured repos)",
        },
      },
      required: [],
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: true,
      title: "Get Latest Updates",
      category: "repository",
    },
    handler: getLatestUpdates,
  },
  {
    name: "midnight-get-version-info",
    description:
      "Get the latest version, release notes, and recent breaking changes for a Midnight repository. Use this to ensure you're working with the latest implementation.",
    inputSchema: {
      type: "object" as const,
      properties: {
        repo: {
          type: "string",
          description:
            "Repository name (e.g., 'compact', 'midnight-js', 'sdk')",
        },
      },
      required: ["repo"],
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: true,
      title: "Get Version Info",
      category: "versioning",
    },
    handler: getVersionInfo,
  },
  {
    name: "midnight-check-breaking-changes",
    description:
      "Check if there are breaking changes between your current version and the latest release. Essential before upgrading dependencies.",
    inputSchema: {
      type: "object" as const,
      properties: {
        repo: {
          type: "string",
          description: "Repository name (e.g., 'compact', 'midnight-js')",
        },
        currentVersion: {
          type: "string",
          description:
            "Version you're currently using (e.g., 'v1.0.0', '0.5.2')",
        },
      },
      required: ["repo", "currentVersion"],
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: true,
      title: "Check Breaking Changes",
      category: "versioning",
    },
    handler: checkBreakingChanges,
  },
  {
    name: "midnight-get-migration-guide",
    description:
      "Get a detailed migration guide for upgrading between versions, including all breaking changes, deprecations, and recommended steps.",
    inputSchema: {
      type: "object" as const,
      properties: {
        repo: {
          type: "string",
          description: "Repository name (e.g., 'compact', 'midnight-js')",
        },
        fromVersion: {
          type: "string",
          description: "Version you're migrating from",
        },
        toVersion: {
          type: "string",
          description: "Target version (default: latest stable)",
        },
      },
      required: ["repo", "fromVersion"],
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: true,
      title: "Get Migration Guide",
      category: "versioning",
    },
    handler: getMigrationGuide,
  },
  {
    name: "midnight-get-file-at-version",
    description:
      "Get the exact content of a file at a specific version. CRITICAL: Use this to ensure code recommendations match the user's version. Always prefer this over get-file when version accuracy matters.",
    inputSchema: {
      type: "object" as const,
      properties: {
        repo: {
          type: "string",
          description: "Repository name (e.g., 'compact', 'midnight-js')",
        },
        path: {
          type: "string",
          description: "File path within repository",
        },
        version: {
          type: "string",
          description: "Version tag (e.g., 'v1.0.0') or branch (e.g., 'main')",
        },
      },
      required: ["repo", "path", "version"],
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      title: "Get File at Version",
      category: "versioning",
    },
    handler: getFileAtVersion,
  },
  {
    name: "midnight-compare-syntax",
    description:
      "Compare a file between two versions to see what changed. Use this before recommending code patterns to ensure they work with the user's version.",
    inputSchema: {
      type: "object" as const,
      properties: {
        repo: {
          type: "string",
          description: "Repository name (e.g., 'compact')",
        },
        path: {
          type: "string",
          description: "File path to compare",
        },
        oldVersion: {
          type: "string",
          description: "Old version tag (e.g., 'v0.9.0')",
        },
        newVersion: {
          type: "string",
          description: "New version tag (default: latest stable)",
        },
      },
      required: ["repo", "path", "oldVersion"],
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      title: "Compare Syntax Between Versions",
      category: "versioning",
    },
    handler: compareSyntax,
  },
  {
    name: "midnight-get-latest-syntax",
    description:
      "Get the authoritative syntax reference for Compact language at the latest version. Use this as the source of truth when writing or reviewing contracts to ensure they compile.",
    inputSchema: {
      type: "object" as const,
      properties: {
        repo: {
          type: "string",
          description: "Repository name (default: 'compact')",
        },
      },
      required: [],
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: true,
      title: "Get Latest Syntax Reference",
      category: "versioning",
    },
    handler: getLatestSyntax,
  },

  // ============================================================================
  // COMPOUND TOOLS - Multi-step operations in a single call
  // These reduce token usage by 50-70% compared to calling individual tools
  // ============================================================================
  {
    name: "midnight-upgrade-check",
    description:
      "🚀 COMPOUND TOOL: Complete upgrade analysis in ONE call. Combines version check + breaking changes + migration guide. Use this instead of calling midnight-get-version-info, midnight-check-breaking-changes, and midnight-get-migration-guide separately. Saves ~60% tokens.",
    inputSchema: {
      type: "object" as const,
      properties: {
        repo: {
          type: "string",
          description: "Repository name (default: 'compact')",
        },
        currentVersion: {
          type: "string",
          description: "Your current version (e.g., 'v0.14.0', '0.13.5')",
        },
      },
      required: ["currentVersion"],
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        repository: { type: "string", description: "Full repository path" },
        currentVersion: {
          type: "string",
          description: "Version being checked",
        },
        version: {
          type: "object",
          description: "Version summary",
          properties: {
            latest: { type: "string" },
            latestStable: { type: "string" },
            isOutdated: { type: "boolean" },
            versionsBehind: { type: "number" },
          },
        },
        breakingChanges: {
          type: "object",
          description: "Breaking changes summary",
          properties: {
            count: { type: "number" },
            hasBreakingChanges: { type: "boolean" },
            items: { type: "array" },
          },
        },
        migration: { type: "object", description: "Migration guide if needed" },
        urgency: {
          type: "string",
          description: "none|low|medium|high|critical",
        },
        recommendation: {
          type: "string",
          description: "Actionable recommendation",
        },
      },
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: true,
      longRunningHint: true,
      title: "⚡ Upgrade Check (Compound)",
      category: "compound",
    },
    handler: upgradeCheck,
  },
  {
    name: "midnight-get-repo-context",
    description:
      "🚀 COMPOUND TOOL: Get everything needed to start working with a repository in ONE call. Combines version info + syntax reference + relevant examples. Use this at the start of a coding session instead of multiple individual calls. Saves ~50% tokens.",
    inputSchema: {
      type: "object" as const,
      properties: {
        repo: {
          type: "string",
          description: "Repository name (e.g., 'compact', 'midnight-js')",
        },
        includeExamples: {
          type: "boolean",
          description: "Include example code snippets (default: true)",
        },
        includeSyntax: {
          type: "boolean",
          description: "Include syntax reference (default: true)",
        },
      },
      required: ["repo"],
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        repository: { type: "string", description: "Full repository path" },
        quickStart: {
          type: "object",
          description: "Version and install command",
        },
        version: { type: "object", description: "Version details" },
        syntax: { type: "object", description: "Syntax reference summary" },
        examples: { type: "array", description: "Relevant examples" },
      },
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: true,
      longRunningHint: true,
      title: "⚡ Get Repo Context (Compound)",
      category: "compound",
    },
    handler: getFullRepoContext,
  },

  // ============================================================================
  // VALIDATION TOOLS - Pre-compilation contract validation
  // ============================================================================
  {
    name: "midnight-validate-contract",
    description:
      "🔍 VALIDATION TOOL: Compile and validate a Compact contract BEFORE deployment. This runs the actual Compact compiler to check for syntax errors, type errors, and other issues. Use this after writing or modifying contract code to catch errors early. Requires the Compact CLI to be installed locally. Accepts either source code directly OR a file path to a .compact file.",
    inputSchema: {
      type: "object" as const,
      properties: {
        code: {
          type: "string",
          description:
            "The Compact contract source code to validate (provide this OR filePath)",
        },
        filePath: {
          type: "string",
          description:
            "Path to a .compact file to validate (alternative to providing code directly)",
        },
        filename: {
          type: "string",
          description:
            "Optional filename for the contract when using code (default: contract.compact)",
        },
      },
      required: [],
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        success: {
          type: "boolean",
          description: "Whether the contract compiled successfully",
        },
        errorType: {
          type: "string",
          description:
            "Category of error: user_error, environment_error, system_error, compilation_error",
        },
        compilerInstalled: {
          type: "boolean",
          description: "Whether the Compact compiler is available",
        },
        compilerVersion: {
          type: "string",
          description: "Version of the Compact compiler",
        },
        message: { type: "string", description: "Summary message" },
        errors: {
          type: "array",
          description: "List of compilation errors with line numbers",
          items: {
            type: "object",
            properties: {
              line: { type: "number" },
              column: { type: "number" },
              message: { type: "string" },
              severity: { type: "string" },
              context: { type: "string" },
            },
          },
        },
        userAction: {
          type: "object",
          description: "What the user needs to do to fix the problem",
          properties: {
            problem: { type: "string" },
            solution: { type: "string" },
            isUserFault: { type: "boolean" },
          },
        },
        suggestions: {
          type: "array",
          description: "Suggestions for fixing errors",
          items: { type: "string" },
        },
        commonFixes: {
          type: "array",
          description: "Common fix patterns",
          items: {
            type: "object",
            properties: {
              pattern: { type: "string" },
              fix: { type: "string" },
            },
          },
        },
        installation: {
          type: "object",
          description: "Installation instructions if compiler not found",
        },
      },
    },
    annotations: {
      readOnlyHint: false, // Creates temp files
      idempotentHint: true, // Same input = same output
      openWorldHint: true,
      longRunningHint: true, // Compilation can take time
      title: "🔍 Validate Contract",
      category: "validation",
    },
    handler: validateContract,
  },
  {
    name: "midnight-extract-contract-structure",
    description:
      "📋 ANALYSIS TOOL: Extract the structure of a Compact contract - circuits, witnesses, ledger items, types, structs, and enums. Use this to understand what a contract does without reading all the code. Returns exported and internal definitions with line numbers. Accepts either source code directly OR a file path.",
    inputSchema: {
      type: "object" as const,
      properties: {
        code: {
          type: "string",
          description:
            "The Compact contract source code to analyze (provide this OR filePath)",
        },
        filePath: {
          type: "string",
          description:
            "Path to a .compact file to analyze (alternative to providing code directly)",
        },
      },
      required: [],
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        success: { type: "boolean" },
        filename: { type: "string" },
        languageVersion: { type: "string" },
        imports: { type: "array", items: { type: "string" } },
        structure: {
          type: "object",
          properties: {
            circuits: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  params: { type: "array", items: { type: "string" } },
                  returnType: { type: "string" },
                  isExport: { type: "boolean" },
                  line: { type: "number" },
                },
              },
            },
            witnesses: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  type: { type: "string" },
                  isExport: { type: "boolean" },
                  line: { type: "number" },
                },
              },
            },
            ledgerItems: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  type: { type: "string" },
                  isExport: { type: "boolean" },
                  line: { type: "number" },
                },
              },
            },
            types: { type: "array" },
            structs: { type: "array" },
            enums: { type: "array" },
          },
        },
        exports: {
          type: "object",
          description: "Names of all exported items",
        },
        stats: {
          type: "object",
          description: "Counts of each type of definition",
        },
        summary: { type: "string" },
        message: { type: "string" },
      },
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
      title: "📋 Extract Contract Structure",
      category: "validation",
    },
    handler: extractContractStructure,
  },
];
