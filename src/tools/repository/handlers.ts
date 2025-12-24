/**
 * Repository handler functions
 * Business logic for repository-related MCP tools
 */

import { githubClient, GitHubCommit } from "../../pipeline/index.js";
import { releaseTracker } from "../../pipeline/releases.js";
import {
  logger,
  DEFAULT_REPOSITORIES,
  SelfCorrectionHints,
} from "../../utils/index.js";
import { REPO_ALIASES, EXAMPLES } from "./constants.js";
import { EMBEDDED_DOCS } from "../../resources/content/docs-content.js";
import type {
  GetFileInput,
  ListExamplesInput,
  GetLatestUpdatesInput,
  GetVersionInfoInput,
  CheckBreakingChangesInput,
  GetMigrationGuideInput,
  GetFileAtVersionInput,
  CompareSyntaxInput,
  GetLatestSyntaxInput,
  UpgradeCheckInput,
  FullRepoContextInput,
} from "./schemas.js";

// Re-export validation handlers from validation.ts
export { validateContract, extractContractStructure } from "./validation.js";

/**
 * Resolve repository name alias to owner/repo
 */
export function resolveRepo(
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
    return SelfCorrectionHints.UNKNOWN_REPO(
      input.repo,
      Object.keys(REPO_ALIASES)
    );
  }

  const file = await githubClient.getFileContent(
    repoInfo.owner,
    repoInfo.repo,
    input.path,
    input.ref
  );

  if (!file) {
    return SelfCorrectionHints.FILE_NOT_FOUND(
      input.path,
      `${repoInfo.owner}/${repoInfo.repo}`
    );
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
  if (input.category && input.category !== "all") {
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
  // Ensure repo defaults to compact if undefined/empty
  const repoName = input?.repo || "compact";
  logger.debug("Getting version info", { repo: repoName });

  const resolved = resolveRepo(repoName);
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
  // Ensure repo defaults to compact if undefined/empty
  const repoName = input?.repo || "compact";
  logger.debug("Checking breaking changes", {
    repo: repoName,
    currentVersion: input.currentVersion,
  });

  const resolved = resolveRepo(repoName);
  if (!resolved) {
    throw new Error(
      `Unknown repository: ${repoName}. Available: ${Object.keys(REPO_ALIASES).join(", ")}`
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
  // Ensure repo defaults to compact if undefined/empty
  const repoName = input?.repo || "compact";
  logger.debug("Getting migration guide", {
    repo: repoName,
    fromVersion: input.fromVersion,
    toVersion: input.toVersion,
  });

  const resolved = resolveRepo(repoName);
  if (!resolved) {
    throw new Error(
      `Unknown repository: ${repoName}. Available: ${Object.keys(REPO_ALIASES).join(", ")}`
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
  // Ensure repo defaults to compact if undefined/empty
  const repoName = input?.repo || "compact";
  logger.debug("Getting file at version", {
    repo: repoName,
    path: input.path,
    version: input.version,
  });

  const resolved = resolveRepo(repoName);
  if (!resolved) {
    throw new Error(
      `Unknown repository: ${repoName}. Available: ${Object.keys(REPO_ALIASES).join(", ")}`
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
      `File not found: ${input.path} at version ${input.version} in ${repoName}`
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
  // Ensure repo defaults to compact if undefined/empty
  const repoName = input?.repo || "compact";
  logger.debug("Comparing syntax between versions", {
    repo: repoName,
    oldVersion: input.oldVersion,
    newVersion: input.newVersion,
  });

  const resolved = resolveRepo(repoName);
  if (!resolved) {
    throw new Error(
      `Unknown repository: ${repoName}. Available: ${Object.keys(REPO_ALIASES).join(", ")}`
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
  // Ensure repo defaults to compact if undefined/empty
  const repoName = input?.repo || "compact";
  logger.debug("Getting latest syntax reference", { repo: repoName });

  // For Compact language, always return our curated reference first
  // This is more reliable than fetching from GitHub and includes pitfalls/patterns
  if (repoName === "compact" || repoName === "midnight-compact") {
    const compactReference = EMBEDDED_DOCS["midnight://docs/compact-reference"];

    // Check if there's a newer release we might not have documented
    const EMBEDDED_DOCS_VERSION = "0.16"; // Version our docs are based on
    let versionWarning: string | undefined;

    try {
      const versionInfo = await releaseTracker.getVersionInfo(
        "midnightntwrk",
        "compact"
      );
      const latestTag =
        versionInfo.latestStableRelease?.tag || versionInfo.latestRelease?.tag;
      if (latestTag) {
        // Extract version number from tag (e.g., "v0.18.0" -> "0.18")
        const latestVersion = latestTag
          .replace(/^v/, "")
          .split(".")
          .slice(0, 2)
          .join(".");
        const embeddedMajorMinor = EMBEDDED_DOCS_VERSION.split(".")
          .slice(0, 2)
          .join(".");

        if (
          latestVersion !== embeddedMajorMinor &&
          parseFloat(latestVersion) > parseFloat(embeddedMajorMinor)
        ) {
          versionWarning = `⚠️ Compact ${latestTag} is available. This reference is based on ${EMBEDDED_DOCS_VERSION}. Some syntax may have changed - check release notes for breaking changes.`;
        }
      }
    } catch {
      // Ignore version check errors, still return cached docs
    }

    if (compactReference) {
      return {
        repository: "midnightntwrk/compact",
        version: "0.16+ (current)",
        ...(versionWarning && { versionWarning }),
        syntaxReference: compactReference,
        sections: [
          "Basic Structure",
          "Data Types",
          "Circuits",
          "Witnesses",
          "State Management",
          "Common Patterns",
          "Disclosure in Conditionals (IMPORTANT)",
          "Common Pitfalls & Solutions",
        ],
        pitfalls: [
          "Cell<T> wrapper deprecated in 0.15+ - use direct type",
          'Cannot assign string literals to Opaque<"string"> - use enum or parameters',
          "Must disclose() comparisons used in if/else conditions",
          "Counter uses .increment()/.value(), Field uses direct assignment",
          "Boolean returns from witnesses need disclose()",
        ],
        note: "This is the curated syntax reference for Compact 0.16+. Includes common pitfalls and correct patterns.",
      };
    }
  }

  const resolved = resolveRepo(repoName);
  if (!resolved) {
    throw new Error(
      `Unknown repository: ${repoName}. Available: ${Object.keys(REPO_ALIASES).join(", ")}`
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

// ============================================================================
// COMPOUND TOOLS - Reduce multiple API calls to single operations
// These tools combine related operations to minimize round-trips and token usage
// ============================================================================

/**
 * Compound tool: Full upgrade check
 * Combines: getVersionInfo + checkBreakingChanges + getMigrationGuide
 * Reduces 3 tool calls to 1, saving ~60% tokens
 */
export async function upgradeCheck(input: UpgradeCheckInput) {
  const repoName = input?.repo || "compact";
  const currentVersion = input.currentVersion;

  logger.debug("Running compound upgrade check", {
    repo: repoName,
    currentVersion,
  });

  const resolved = resolveRepo(repoName);
  if (!resolved) {
    throw new Error(
      `Unknown repository: ${repoName}. Available: ${Object.keys(REPO_ALIASES).join(", ")}`
    );
  }

  // Fetch all data in parallel
  const [versionInfo, outdatedInfo, breakingChanges] = await Promise.all([
    releaseTracker.getVersionInfo(resolved.owner, resolved.repo),
    releaseTracker.isOutdated(resolved.owner, resolved.repo, currentVersion),
    releaseTracker.getBreakingChangesSince(
      resolved.owner,
      resolved.repo,
      currentVersion
    ),
  ]);

  const latestVersion =
    versionInfo.latestStableRelease?.tag || versionInfo.latestRelease?.tag;

  // Only fetch migration guide if there are breaking changes
  let migrationGuide = null;
  if (breakingChanges.length > 0 && latestVersion) {
    migrationGuide = await releaseTracker.getMigrationGuide(
      resolved.owner,
      resolved.repo,
      currentVersion,
      latestVersion
    );
  }

  // Compute upgrade urgency
  const urgency = computeUpgradeUrgency(outdatedInfo, breakingChanges.length);

  return {
    repository: `${resolved.owner}/${resolved.repo}`,
    currentVersion,

    // Version summary
    version: {
      latest: latestVersion || "No releases",
      latestStable:
        versionInfo.latestStableRelease?.tag || "No stable releases",
      publishedAt: versionInfo.latestRelease?.publishedAt || null,
      isOutdated: outdatedInfo.isOutdated,
      versionsBehind: outdatedInfo.versionsBehind,
    },

    // Breaking changes summary
    breakingChanges: {
      count: breakingChanges.length,
      hasBreakingChanges: breakingChanges.length > 0,
      items: breakingChanges.slice(0, 10), // Limit to avoid token bloat
    },

    // Migration guide (only if needed)
    migration: migrationGuide
      ? {
          steps: migrationGuide.migrationSteps,
          deprecations: migrationGuide.deprecations,
          newFeatures: migrationGuide.newFeatures.slice(0, 5),
        }
      : null,

    // Actionable recommendation
    urgency,
    recommendation: generateUpgradeRecommendation(
      urgency,
      breakingChanges.length,
      outdatedInfo
    ),
  };
}

/**
 * Compound tool: Full repository context
 * Combines: getVersionInfo + getLatestSyntax + listExamples (filtered)
 * Provides everything needed to start working with a repo
 */
export async function getFullRepoContext(input: FullRepoContextInput) {
  const repoName = input?.repo || "compact";

  logger.debug("Getting full repo context", { repo: repoName });

  const resolved = resolveRepo(repoName);
  if (!resolved) {
    throw new Error(
      `Unknown repository: ${repoName}. Available: ${Object.keys(REPO_ALIASES).join(", ")}`
    );
  }

  // Fetch version info
  const versionInfo = await releaseTracker.getVersionInfo(
    resolved.owner,
    resolved.repo
  );
  const version =
    versionInfo.latestStableRelease?.tag ||
    versionInfo.latestRelease?.tag ||
    "main";

  // Conditionally fetch syntax reference
  let syntaxRef = null;
  if (input.includeSyntax !== false) {
    syntaxRef = await releaseTracker.getLatestSyntaxReference(
      resolved.owner,
      resolved.repo
    );
  }

  // Get relevant examples for this repo
  let examples: Array<{
    name: string;
    description: string;
    complexity: string;
  }> = [];
  if (input.includeExamples !== false) {
    // Filter examples relevant to this repo type
    const repoType = getRepoType(repoName);
    examples = EXAMPLES.filter(
      (ex) =>
        repoType === "all" || ex.category === repoType || repoType === "compact"
    )
      .slice(0, 5)
      .map((ex) => ({
        name: ex.name,
        description: ex.description,
        complexity: ex.complexity,
      }));
  }

  return {
    repository: `${resolved.owner}/${resolved.repo}`,

    // Quick start info
    quickStart: {
      version,
      installCommand: getInstallCommand(repoName, version),
      docsUrl: `https://github.com/${resolved.owner}/${resolved.repo}`,
    },

    // Version context
    version: {
      current: version,
      stable: versionInfo.latestStableRelease?.tag || null,
      publishedAt: versionInfo.latestRelease?.publishedAt || null,
      recentReleases: versionInfo.recentReleases.slice(0, 3).map((r) => ({
        tag: r.tag,
        date: r.publishedAt.split("T")[0],
      })),
    },

    // Syntax reference (condensed)
    syntax: syntaxRef
      ? {
          version: syntaxRef.version,
          files: syntaxRef.syntaxFiles.map((f) => f.path),
          // Include first file content as primary reference
          primaryReference:
            syntaxRef.syntaxFiles[0]?.content?.slice(0, 2000) || null,
        }
      : null,

    // Relevant examples
    examples,

    note: `Use this context to write ${repoName} code at version ${version}. For detailed syntax, use midnight-get-latest-syntax.`,
  };
}

// Helper functions for compound tools

function computeUpgradeUrgency(
  outdatedInfo: {
    isOutdated: boolean;
    hasBreakingChanges: boolean;
    versionsBehind: number;
  },
  breakingCount: number
): "none" | "low" | "medium" | "high" | "critical" {
  if (!outdatedInfo.isOutdated) return "none";
  if (breakingCount === 0 && outdatedInfo.versionsBehind <= 2) return "low";
  if (breakingCount <= 2 && outdatedInfo.versionsBehind <= 5) return "medium";
  if (breakingCount <= 5) return "high";
  return "critical";
}

function generateUpgradeRecommendation(
  urgency: string,
  breakingCount: number,
  outdatedInfo: { isOutdated: boolean; versionsBehind: number }
): string {
  switch (urgency) {
    case "none":
      return "✅ You're on the latest version. No action needed.";
    case "low":
      return `📦 Minor update available (${outdatedInfo.versionsBehind} versions behind). Safe to upgrade at your convenience.`;
    case "medium":
      return `⚠️ Update recommended. ${breakingCount} breaking change(s) to review. Plan upgrade within 2 weeks.`;
    case "high":
      return `🔶 Important update. ${breakingCount} breaking changes require attention. Schedule upgrade soon.`;
    case "critical":
      return `🚨 Critical update needed! ${breakingCount} breaking changes and ${outdatedInfo.versionsBehind} versions behind. Upgrade immediately.`;
    default:
      return "Check the breaking changes and plan your upgrade.";
  }
}

function getRepoType(repoName: string): string {
  const name = repoName.toLowerCase();
  if (name.includes("counter")) return "counter";
  if (name.includes("bboard")) return "bboard";
  if (name.includes("token") || name.includes("dex")) return "token";
  if (name.includes("voting")) return "voting";
  return "all";
}

function getInstallCommand(repoName: string, version: string): string {
  const name = repoName.toLowerCase();
  if (name === "compact" || name.includes("compact")) {
    return `npx @aspect-sh/pnpm dlx @midnight-ntwrk/create-midnight-app@${version}`;
  }
  if (name === "midnight-js" || name.includes("js")) {
    return `npm install @midnight-ntwrk/midnight-js@${version}`;
  }
  return `git clone https://github.com/midnight-ntwrk/${repoName}.git && cd ${repoName} && git checkout ${version}`;
}
