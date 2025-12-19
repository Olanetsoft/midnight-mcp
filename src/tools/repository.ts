import { z } from "zod";
import { githubClient, GitHubCommit } from "../pipeline/index.js";
import { releaseTracker } from "../pipeline/releases.js";
import { logger, DEFAULT_REPOSITORIES } from "../utils/index.js";

// Schema definitions
export const GetFileInputSchema = z.object({
  repo: z
    .string()
    .describe(
      "Repository name (e.g., 'compact', 'midnight-js', 'example-counter')"
    ),
  path: z.string().describe("File path within repository"),
  ref: z
    .string()
    .optional()
    .describe("Branch, tag, or commit SHA (default: main)"),
});

export const ListExamplesInputSchema = z.object({
  category: z
    .enum(["counter", "bboard", "token", "voting", "all"])
    .optional()
    .default("all")
    .describe("Filter by example type"),
});

export const GetLatestUpdatesInputSchema = z.object({
  since: z
    .string()
    .optional()
    .describe("ISO date to fetch updates from (default: last 7 days)"),
  repos: z
    .array(z.string())
    .optional()
    .describe("Specific repos to check (default: all configured repos)"),
});

export const GetVersionInfoInputSchema = z.object({
  repo: z.string().describe("Repository name (e.g., 'compact', 'midnight-js')"),
});

export const CheckBreakingChangesInputSchema = z.object({
  repo: z.string().describe("Repository name (e.g., 'compact', 'midnight-js')"),
  currentVersion: z
    .string()
    .describe("Version you're currently using (e.g., 'v1.0.0', '0.5.2')"),
});

export const GetMigrationGuideInputSchema = z.object({
  repo: z.string().describe("Repository name (e.g., 'compact', 'midnight-js')"),
  fromVersion: z.string().describe("Version you're migrating from"),
  toVersion: z
    .string()
    .optional()
    .describe("Target version (default: latest stable)"),
});

export const GetFileAtVersionInputSchema = z.object({
  repo: z.string().describe("Repository name (e.g., 'compact', 'midnight-js')"),
  path: z.string().describe("File path within repository"),
  version: z
    .string()
    .describe("Version tag (e.g., 'v1.0.0') or branch (e.g., 'main')"),
});

export const CompareSyntaxInputSchema = z.object({
  repo: z.string().describe("Repository name (e.g., 'compact')"),
  path: z.string().describe("File path to compare"),
  oldVersion: z.string().describe("Old version tag (e.g., 'v0.9.0')"),
  newVersion: z
    .string()
    .optional()
    .describe("New version tag (default: latest)"),
});

export const GetLatestSyntaxInputSchema = z.object({
  repo: z
    .string()
    .default("compact")
    .describe("Repository name (default: 'compact')"),
});

export type GetFileInput = z.infer<typeof GetFileInputSchema>;
export type ListExamplesInput = z.infer<typeof ListExamplesInputSchema>;
export type GetLatestUpdatesInput = z.infer<typeof GetLatestUpdatesInputSchema>;
export type GetVersionInfoInput = z.infer<typeof GetVersionInfoInputSchema>;
export type CheckBreakingChangesInput = z.infer<
  typeof CheckBreakingChangesInputSchema
>;
export type GetMigrationGuideInput = z.infer<
  typeof GetMigrationGuideInputSchema
>;
export type GetFileAtVersionInput = z.infer<typeof GetFileAtVersionInputSchema>;
export type CompareSyntaxInput = z.infer<typeof CompareSyntaxInputSchema>;
export type GetLatestSyntaxInput = z.infer<typeof GetLatestSyntaxInputSchema>;

// Repository name mapping
const REPO_ALIASES: Record<string, { owner: string; repo: string }> = {
  // Core Language & SDK
  compact: { owner: "midnightntwrk", repo: "compact" },
  "midnight-js": { owner: "midnightntwrk", repo: "midnight-js" },
  js: { owner: "midnightntwrk", repo: "midnight-js" },
  sdk: { owner: "midnightntwrk", repo: "midnight-js" },

  // Documentation
  docs: { owner: "midnightntwrk", repo: "midnight-docs" },
  "midnight-docs": { owner: "midnightntwrk", repo: "midnight-docs" },

  // Example DApps
  "example-counter": { owner: "midnightntwrk", repo: "example-counter" },
  counter: { owner: "midnightntwrk", repo: "example-counter" },
  "example-bboard": { owner: "midnightntwrk", repo: "example-bboard" },
  bboard: { owner: "midnightntwrk", repo: "example-bboard" },
  "example-dex": { owner: "midnightntwrk", repo: "example-dex" },
  dex: { owner: "midnightntwrk", repo: "example-dex" },

  // Developer Tools
  "create-mn-app": { owner: "midnightntwrk", repo: "create-mn-app" },
  "midnight-wallet": { owner: "midnightntwrk", repo: "midnight-wallet" },
  wallet: { owner: "midnightntwrk", repo: "midnight-wallet" },

  // Infrastructure
  "midnight-indexer": { owner: "midnightntwrk", repo: "midnight-indexer" },
  indexer: { owner: "midnightntwrk", repo: "midnight-indexer" },
  "midnight-node-docker": {
    owner: "midnightntwrk",
    repo: "midnight-node-docker",
  },
  node: { owner: "midnightntwrk", repo: "midnight-node-docker" },

  // APIs & Connectors
  "midnight-dapp-connector-api": {
    owner: "midnightntwrk",
    repo: "midnight-dapp-connector-api",
  },
  connector: { owner: "midnightntwrk", repo: "midnight-dapp-connector-api" },

  // Tooling
  "compact-tree-sitter": {
    owner: "midnightntwrk",
    repo: "compact-tree-sitter",
  },

  // Community
  "midnight-awesome-dapps": {
    owner: "midnightntwrk",
    repo: "midnight-awesome-dapps",
  },
  awesome: { owner: "midnightntwrk", repo: "midnight-awesome-dapps" },
  "contributor-hub": { owner: "midnightntwrk", repo: "contributor-hub" },

  // Partner Libraries (OpenZeppelin)
  "compact-contracts": { owner: "OpenZeppelin", repo: "compact-contracts" },
  openzeppelin: { owner: "OpenZeppelin", repo: "compact-contracts" },
  oz: { owner: "OpenZeppelin", repo: "compact-contracts" },
};

// Example definitions
interface ExampleDefinition {
  name: string;
  repository: string;
  description: string;
  category: string;
  complexity: "beginner" | "intermediate" | "advanced";
  mainFile: string;
  features: string[];
}

const EXAMPLES: ExampleDefinition[] = [
  {
    name: "Counter",
    repository: "midnightntwrk/example-counter",
    description:
      "Simple counter contract demonstrating basic Compact concepts. Perfect for learning ledger state, circuits, and witnesses.",
    category: "counter",
    complexity: "beginner",
    mainFile: "contract/src/counter.compact",
    features: [
      "Ledger state management",
      "Basic circuit definition",
      "Counter increment/decrement",
      "TypeScript integration",
    ],
  },
  {
    name: "Bulletin Board",
    repository: "midnightntwrk/example-bboard",
    description:
      "Full DApp example with CLI and React UI. Demonstrates posting messages with privacy features.",
    category: "bboard",
    complexity: "intermediate",
    mainFile: "contract/src/bboard.compact",
    features: [
      "Private messaging",
      "React frontend",
      "CLI interface",
      "Wallet integration",
      "Disclose operations",
    ],
  },
  {
    name: "DEX (Decentralized Exchange)",
    repository: "midnightntwrk/example-dex",
    description:
      "Advanced DApp example showing token swaps and liquidity pools with privacy-preserving transactions.",
    category: "dex",
    complexity: "advanced",
    mainFile: "contract/src/dex.compact",
    features: [
      "Token swaps",
      "Liquidity pools",
      "Privacy-preserving trades",
      "Price calculations",
      "Advanced state management",
    ],
  },
];

/**
 * Resolve repository name alias to owner/repo
 */
function resolveRepo(repoName: string): { owner: string; repo: string } | null {
  const normalized = repoName.toLowerCase().replace(/^midnightntwrk\//, "");
  const alias = REPO_ALIASES[normalized];
  if (alias) return alias;

  // Try to find in configured repos
  for (const config of DEFAULT_REPOSITORIES) {
    if (config.repo.toLowerCase() === normalized) {
      return { owner: config.owner, repo: config.repo };
    }
  }

  // Assume it's a full org/repo name
  if (repoName.includes("/")) {
    const [owner, repo] = repoName.split("/");
    return { owner, repo };
  }

  return null;
}

/**
 * Retrieve a specific file from Midnight repositories
 */
export async function getFile(input: GetFileInput) {
  logger.debug("Getting file", { repo: input.repo, path: input.path });

  const repoInfo = resolveRepo(input.repo);
  if (!repoInfo) {
    return {
      error: `Unknown repository: ${input.repo}`,
      suggestion: `Valid repositories: ${Object.keys(REPO_ALIASES).join(", ")}`,
    };
  }

  const file = await githubClient.getFileContent(
    repoInfo.owner,
    repoInfo.repo,
    input.path,
    input.ref
  );

  if (!file) {
    return {
      error: `File not found: ${input.path}`,
      repository: `${repoInfo.owner}/${repoInfo.repo}`,
      suggestion:
        "Check the file path and try again. Use midnight:list-examples to see available example files.",
    };
  }

  return {
    content: file.content,
    path: file.path,
    repository: `${repoInfo.owner}/${repoInfo.repo}`,
    sha: file.sha,
    size: file.size,
    url: `https://github.com/${repoInfo.owner}/${repoInfo.repo}/blob/${input.ref || "main"}/${file.path}`,
  };
}

/**
 * List available example contracts and DApps
 */
export async function listExamples(input: ListExamplesInput) {
  logger.debug("Listing examples", { category: input.category });

  let filteredExamples = EXAMPLES;
  if (input.category !== "all") {
    filteredExamples = EXAMPLES.filter((e) => e.category === input.category);
  }

  return {
    examples: filteredExamples.map((e) => ({
      name: e.name,
      repository: e.repository,
      description: e.description,
      complexity: e.complexity,
      mainFile: e.mainFile,
      features: e.features,
      githubUrl: `https://github.com/${e.repository}`,
    })),
    totalCount: filteredExamples.length,
    categories: [...new Set(EXAMPLES.map((e) => e.category))],
  };
}

/**
 * Retrieve recent changes across Midnight repositories
 */
export async function getLatestUpdates(input: GetLatestUpdatesInput) {
  logger.debug("Getting latest updates", input);

  // Default to last 7 days
  const since =
    input.since || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const repos =
    input.repos?.map(resolveRepo).filter(Boolean) ||
    DEFAULT_REPOSITORIES.map((r) => ({ owner: r.owner, repo: r.repo }));

  const updates: Array<{
    repository: string;
    commits: GitHubCommit[];
  }> = [];

  for (const repo of repos) {
    if (!repo) continue;
    const commits = await githubClient.getRecentCommits(
      repo.owner,
      repo.repo,
      since,
      10
    );

    if (commits.length > 0) {
      updates.push({
        repository: `${repo.owner}/${repo.repo}`,
        commits,
      });
    }
  }

  // Sort by most recent commit
  updates.sort((a, b) => {
    const aDate = a.commits[0]?.date || "";
    const bDate = b.commits[0]?.date || "";
    return bDate.localeCompare(aDate);
  });

  // Generate summary
  const totalCommits = updates.reduce((sum, u) => sum + u.commits.length, 0);
  const activeRepos = updates.filter((u) => u.commits.length > 0).length;

  return {
    summary: {
      since,
      totalCommits,
      activeRepositories: activeRepos,
      checkedRepositories: repos.length,
    },
    updates: updates.map((u) => ({
      repository: u.repository,
      commitCount: u.commits.length,
      latestCommit: u.commits[0]
        ? {
            message: u.commits[0].message.split("\n")[0], // First line only
            date: u.commits[0].date,
            author: u.commits[0].author,
            url: u.commits[0].url,
          }
        : null,
      recentCommits: u.commits.slice(0, 5).map((c) => ({
        message: c.message.split("\n")[0],
        date: c.date,
        sha: c.sha.substring(0, 7),
      })),
    })),
  };
}

/**
 * Get version and release info for a repository
 */
export async function getVersionInfo(input: GetVersionInfoInput) {
  logger.debug("Getting version info", input);

  const resolved = resolveRepo(input.repo);
  if (!resolved) {
    throw new Error(
      `Unknown repository: ${input.repo}. Available: ${Object.keys(REPO_ALIASES).join(", ")}`
    );
  }

  const versionInfo = await releaseTracker.getVersionInfo(
    resolved.owner,
    resolved.repo
  );

  return {
    repository: `${resolved.owner}/${resolved.repo}`,
    latestVersion: versionInfo.latestRelease?.tag || "No releases found",
    latestStableVersion:
      versionInfo.latestStableRelease?.tag || "No stable releases",
    publishedAt: versionInfo.latestRelease?.publishedAt || null,
    releaseNotes: versionInfo.latestRelease?.body || null,
    recentReleases: versionInfo.recentReleases.slice(0, 5).map((r) => ({
      version: r.tag,
      date: r.publishedAt.split("T")[0],
      isPrerelease: r.isPrerelease,
      url: r.url,
    })),
    recentBreakingChanges: versionInfo.changelog
      .slice(0, 3)
      .flatMap((c) => c.changes.breaking)
      .slice(0, 10),
    versionContext: releaseTracker.getVersionContext(versionInfo),
  };
}

/**
 * Check for breaking changes since a specific version
 */
export async function checkBreakingChanges(input: CheckBreakingChangesInput) {
  logger.debug("Checking breaking changes", input);

  const resolved = resolveRepo(input.repo);
  if (!resolved) {
    throw new Error(
      `Unknown repository: ${input.repo}. Available: ${Object.keys(REPO_ALIASES).join(", ")}`
    );
  }

  const outdatedInfo = await releaseTracker.isOutdated(
    resolved.owner,
    resolved.repo,
    input.currentVersion
  );

  const breakingChanges = await releaseTracker.getBreakingChangesSince(
    resolved.owner,
    resolved.repo,
    input.currentVersion
  );

  return {
    repository: `${resolved.owner}/${resolved.repo}`,
    currentVersion: input.currentVersion,
    latestVersion: outdatedInfo.latestVersion,
    isOutdated: outdatedInfo.isOutdated,
    versionsBehind: outdatedInfo.versionsBehind,
    hasBreakingChanges: outdatedInfo.hasBreakingChanges,
    breakingChanges: breakingChanges,
    recommendation: outdatedInfo.hasBreakingChanges
      ? `⚠️ Breaking changes detected! Review the ${breakingChanges.length} breaking change(s) before upgrading.`
      : outdatedInfo.isOutdated
        ? `✅ Safe to upgrade. No breaking changes detected since ${input.currentVersion}.`
        : `✅ You're on the latest version.`,
  };
}

/**
 * Get migration guide between versions
 */
export async function getMigrationGuide(input: GetMigrationGuideInput) {
  logger.debug("Getting migration guide", input);

  const resolved = resolveRepo(input.repo);
  if (!resolved) {
    throw new Error(
      `Unknown repository: ${input.repo}. Available: ${Object.keys(REPO_ALIASES).join(", ")}`
    );
  }

  const guide = await releaseTracker.getMigrationGuide(
    resolved.owner,
    resolved.repo,
    input.fromVersion,
    input.toVersion
  );

  return {
    repository: `${resolved.owner}/${resolved.repo}`,
    from: guide.from,
    to: guide.to,
    summary: {
      breakingChangesCount: guide.breakingChanges.length,
      deprecationsCount: guide.deprecations.length,
      newFeaturesCount: guide.newFeatures.length,
    },
    breakingChanges: guide.breakingChanges,
    deprecations: guide.deprecations,
    newFeatures: guide.newFeatures,
    migrationSteps: guide.migrationSteps,
    migrationDifficulty:
      guide.breakingChanges.length === 0
        ? "Easy - No breaking changes"
        : guide.breakingChanges.length <= 3
          ? "Moderate - Few breaking changes"
          : "Complex - Multiple breaking changes, plan carefully",
  };
}

/**
 * Get a file at a specific version - critical for version-accurate recommendations
 */
export async function getFileAtVersion(input: GetFileAtVersionInput) {
  logger.debug("Getting file at version", input);

  const resolved = resolveRepo(input.repo);
  if (!resolved) {
    throw new Error(
      `Unknown repository: ${input.repo}. Available: ${Object.keys(REPO_ALIASES).join(", ")}`
    );
  }

  const result = await releaseTracker.getFileAtVersion(
    resolved.owner,
    resolved.repo,
    input.path,
    input.version
  );

  if (!result) {
    throw new Error(
      `File not found: ${input.path} at version ${input.version} in ${input.repo}`
    );
  }

  return {
    repository: `${resolved.owner}/${resolved.repo}`,
    path: input.path,
    version: result.version,
    content: result.content,
    note: `This is the exact content at version ${result.version}. Use this as the source of truth for syntax and API at this version.`,
  };
}

/**
 * Compare syntax between two versions - shows what changed
 */
export async function compareSyntax(input: CompareSyntaxInput) {
  logger.debug("Comparing syntax between versions", input);

  const resolved = resolveRepo(input.repo);
  if (!resolved) {
    throw new Error(
      `Unknown repository: ${input.repo}. Available: ${Object.keys(REPO_ALIASES).join(", ")}`
    );
  }

  // If no newVersion specified, get latest
  let newVersion = input.newVersion;
  if (!newVersion) {
    const versionInfo = await releaseTracker.getVersionInfo(
      resolved.owner,
      resolved.repo
    );
    newVersion =
      versionInfo.latestStableRelease?.tag ||
      versionInfo.latestRelease?.tag ||
      "main";
  }

  const comparison = await releaseTracker.compareSyntax(
    resolved.owner,
    resolved.repo,
    input.path,
    input.oldVersion,
    newVersion
  );

  return {
    repository: `${resolved.owner}/${resolved.repo}`,
    path: input.path,
    oldVersion: comparison.oldVersion,
    newVersion: comparison.newVersion,
    hasDifferences: comparison.hasDifferences,
    oldContent: comparison.oldContent,
    newContent: comparison.newContent,
    recommendation: comparison.hasDifferences
      ? `⚠️ This file has changed between ${comparison.oldVersion} and ${comparison.newVersion}. Review the differences before using code patterns from the old version.`
      : `✅ No changes in this file between versions.`,
  };
}

/**
 * Get the latest syntax reference for Compact language
 * This is the source of truth for writing valid, compilable contracts
 */
export async function getLatestSyntax(input: GetLatestSyntaxInput) {
  logger.debug("Getting latest syntax reference", input);

  const resolved = resolveRepo(input.repo);
  if (!resolved) {
    throw new Error(
      `Unknown repository: ${input.repo}. Available: ${Object.keys(REPO_ALIASES).join(", ")}`
    );
  }

  const reference = await releaseTracker.getLatestSyntaxReference(
    resolved.owner,
    resolved.repo
  );

  if (!reference || reference.syntaxFiles.length === 0) {
    // Fallback: get example contracts as syntax reference
    const versionInfo = await releaseTracker.getVersionInfo(
      resolved.owner,
      resolved.repo
    );
    const version = versionInfo.latestStableRelease?.tag || "main";

    return {
      repository: `${resolved.owner}/${resolved.repo}`,
      version,
      warning:
        "No grammar documentation found. Use example contracts as reference.",
      syntaxFiles: [],
      examplePaths: ["examples/", "test/", "contracts/"],
    };
  }

  return {
    repository: `${resolved.owner}/${resolved.repo}`,
    version: reference.version,
    syntaxFiles: reference.syntaxFiles.map((f) => ({
      path: f.path,
      content: f.content,
    })),
    note: `This is the authoritative syntax reference at version ${reference.version}. Use this to ensure contracts are compilable.`,
  };
}

// Tool definitions for MCP
export const repositoryTools = [
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
    handler: getLatestSyntax,
  },
];
