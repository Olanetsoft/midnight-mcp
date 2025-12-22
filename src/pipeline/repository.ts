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

// Repository name mapping
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
function resolveRepo(
  repoName?: string
): { owner: string; repo: string } | null {
  // Default to compact if not provided
  const name = repoName || "compact";
  const normalized = name.toLowerCase().replace(/^midnightntwrk\//, "");
  const alias = REPO_ALIASES[normalized];
  if (alias) return alias;

  // Try to find in configured repos
  for (const config of DEFAULT_REPOSITORIES) {
    if (config.repo.toLowerCase() === normalized) {
      return { owner: config.owner, repo: config.repo };
    }
  }

  // Assume it's a full org/repo name
  if (name.includes("/")) {
    const [owner, repo] = name.split("/");
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

  // Special handling for "midnight-examples" - redirect to listing examples
  const repoName = input.repo || "compact";
  const normalizedRepo = repoName.toLowerCase();
  if (normalizedRepo === "midnight-examples" || normalizedRepo === "examples") {
    const exampleRepos = ["example-counter", "example-bboard", "example-dex"];
    const versions = await Promise.all(
      exampleRepos.map(async (repoName) => {
        const resolved = resolveRepo(repoName);
        if (!resolved) return null;
        try {
          const versionInfo = await releaseTracker.getVersionInfo(
            resolved.owner,
            resolved.repo
          );
          return {
            name: repoName,
            repository: `${resolved.owner}/${resolved.repo}`,
            latestVersion: versionInfo.latestRelease?.tag || "No releases",
            publishedAt: versionInfo.latestRelease?.publishedAt || null,
          };
        } catch {
          return {
            name: repoName,
            repository: `${resolved.owner}/${resolved.repo}`,
            latestVersion: "Unable to fetch",
            publishedAt: null,
          };
        }
      })
    );

    return {
      note: "There is no single 'midnight-examples' repository. Examples are split across multiple repos:",
      examples: versions.filter(Boolean),
      availableExamples: EXAMPLES.map((e) => ({
        name: e.name,
        repository: e.repository,
        description: e.description,
        complexity: e.complexity,
      })),
      hint: "Use 'counter', 'bboard', or 'dex' as repo aliases to get specific example info.",
    };
  }

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

// Tool definitions for MCP
export const repositoryTools = [
  {
    name: "midnight:get-file",
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
    name: "midnight:list-examples",
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
    name: "midnight:get-latest-updates",
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
    name: "midnight:get-version-info",
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
    name: "midnight:check-breaking-changes",
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
    name: "midnight:get-migration-guide",
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
];
