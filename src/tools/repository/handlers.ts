/**
 * Repository handler functions
 * Business logic for repository-related MCP tools
 */

import { githubClient, GitHubCommit } from "../../pipeline/index.js";
import { releaseTracker } from "../../pipeline/releases.js";
import { logger, DEFAULT_REPOSITORIES } from "../../utils/index.js";
import { REPO_ALIASES, EXAMPLES } from "./constants.js";
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
} from "./schemas.js";

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
