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
  ValidateContractInput,
  ExtractContractStructureInput,
} from "./schemas.js";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, mkdir, readFile, rm } from "fs/promises";
import { join, basename, resolve, isAbsolute } from "path";
import { tmpdir } from "os";
import { platform } from "process";

// ============================================================================
// SECURITY & VALIDATION HELPERS
// ============================================================================

/**
 * Validate file path for security - prevent path traversal attacks
 */
function validateFilePath(filePath: string): {
  valid: boolean;
  error?: string;
  normalizedPath?: string;
} {
  // Must be absolute path
  if (!isAbsolute(filePath)) {
    return {
      valid: false,
      error: "File path must be absolute (e.g., /Users/you/contract.compact)",
    };
  }

  // Resolve to catch ../ traversal
  const normalized = resolve(filePath);

  // Check for path traversal attempts
  if (normalized !== filePath && filePath.includes("..")) {
    return {
      valid: false,
      error: "Path traversal detected - use absolute paths without ../",
    };
  }

  // Must end with .compact
  if (!normalized.endsWith(".compact")) {
    return {
      valid: false,
      error: "File must have .compact extension",
    };
  }

  // Block sensitive paths
  const blockedPaths = ["/etc", "/var", "/usr", "/bin", "/sbin", "/root"];
  if (blockedPaths.some((blocked) => normalized.startsWith(blocked))) {
    return {
      valid: false,
      error: "Cannot access system directories",
    };
  }

  return { valid: true, normalizedPath: normalized };
}

/**
 * Check if content is valid UTF-8 text (not binary)
 */
function isValidUtf8Text(content: string): boolean {
  // Check for null bytes (common in binary files)
  if (content.includes("\x00")) {
    return false;
  }

  // Check for excessive non-printable characters
  const nonPrintable = content.match(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g);
  if (nonPrintable && nonPrintable.length > content.length * 0.01) {
    return false;
  }

  return true;
}

/**
 * Detect local includes that won't work in temp directory
 */
function detectLocalIncludes(code: string): string[] {
  const localIncludes: string[] = [];

  // Pattern: include "something.compact" or include "./path"
  const includePattern = /include\s+"([^"]+)"/g;
  let match;

  while ((match = includePattern.exec(code)) !== null) {
    const includePath = match[1];
    // Skip standard library includes
    if (
      includePath === "std" ||
      includePath.startsWith("CompactStandardLibrary")
    ) {
      continue;
    }
    // Local file reference
    if (
      includePath.endsWith(".compact") ||
      includePath.startsWith("./") ||
      includePath.startsWith("../")
    ) {
      localIncludes.push(includePath);
    }
  }

  return localIncludes;
}

const execAsync = promisify(exec);

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

/**
 * Validate a Compact contract by running the compiler
 * This provides pre-compilation validation with detailed error diagnostics
 */
export async function validateContract(input: ValidateContractInput) {
  logger.debug("Validating contract", {
    filename: input.filename,
    hasCode: !!input.code,
    filePath: input.filePath,
  });

  // ============================================================================
  // RESOLVE CODE SOURCE - Either from code string or file path
  // ============================================================================

  let code: string;
  let filename: string;
  let sourceDir: string | null = null; // Track source directory for local includes

  if (input.filePath) {
    // SECURITY: Validate file path first
    const pathValidation = validateFilePath(input.filePath);
    if (!pathValidation.valid) {
      return {
        success: false,
        errorType: "security_error",
        error: "Invalid file path",
        message: `❌ ${pathValidation.error}`,
        userAction: {
          problem: pathValidation.error,
          solution:
            "Provide an absolute path to a .compact file in your project directory",
          example: { filePath: "/Users/you/projects/myapp/contract.compact" },
          isUserFault: true,
        },
      };
    }

    const safePath = pathValidation.normalizedPath!;
    sourceDir = join(safePath, "..");

    // Read code from file
    try {
      code = await readFile(safePath, "utf-8");
      filename = basename(safePath);

      // SECURITY: Check for binary/non-UTF8 content
      if (!isValidUtf8Text(code)) {
        return {
          success: false,
          errorType: "user_error",
          error: "Invalid file content",
          message:
            "❌ File appears to be binary or contains invalid characters",
          userAction: {
            problem: "The file is not a valid UTF-8 text file",
            solution:
              "Ensure you're pointing to a Compact source file (.compact), not a compiled binary",
            isUserFault: true,
          },
        };
      }
    } catch (fsError: unknown) {
      const err = fsError as { code?: string; message?: string };
      return {
        success: false,
        errorType: "user_error",
        error: "Failed to read file",
        message: `❌ Cannot read file: ${input.filePath}`,
        userAction: {
          problem:
            err.code === "ENOENT"
              ? "File does not exist"
              : err.code === "EACCES"
                ? "Permission denied"
                : "Cannot read file",
          solution:
            err.code === "ENOENT"
              ? "Check that the file path is correct"
              : "Check file permissions",
          details: err.message,
          isUserFault: true,
        },
      };
    }
  } else if (input.code) {
    code = input.code;
    // Sanitize filename to prevent command injection
    const rawFilename = input.filename || "contract.compact";
    filename = rawFilename.replace(/[^a-zA-Z0-9._-]/g, "_");
    if (!filename.endsWith(".compact")) {
      filename = "contract.compact";
    }

    // Check for binary content in provided code
    if (!isValidUtf8Text(code)) {
      return {
        success: false,
        errorType: "user_error",
        error: "Invalid code content",
        message: "❌ Code contains invalid characters",
        userAction: {
          problem:
            "The provided code contains binary or non-printable characters",
          solution: "Provide valid UTF-8 Compact source code",
          isUserFault: true,
        },
      };
    }
  } else {
    // Neither code nor filePath provided
    return {
      success: false,
      errorType: "user_error",
      error: "No contract provided",
      message: "❌ Must provide either 'code' or 'filePath'",
      userAction: {
        problem: "Neither code string nor file path was provided",
        solution:
          "Provide the contract source code OR a path to a .compact file",
        example: {
          withCode: { code: "pragma language_version >= 0.16; ..." },
          withFile: { filePath: "/path/to/contract.compact" },
        },
        isUserFault: true,
      },
    };
  }

  // ============================================================================
  // INPUT VALIDATION - Check for user errors before attempting compilation
  // ============================================================================

  // Check for local includes that won't work in temp directory
  const localIncludes = detectLocalIncludes(code);
  if (localIncludes.length > 0 && !sourceDir) {
    // Code was provided directly (not from file) and has local includes
    return {
      success: false,
      errorType: "user_error",
      error: "Local includes detected",
      message: "❌ Contract has local file includes that cannot be resolved",
      userAction: {
        problem: `Contract includes local files: ${localIncludes.join(", ")}`,
        solution:
          "Use filePath instead of code when your contract has local includes, so we can resolve relative paths",
        detectedIncludes: localIncludes,
        example: {
          instead: '{ code: "include \\"utils.compact\\"; ..." }',
          use: '{ filePath: "/path/to/your/contract.compact" }',
        },
        isUserFault: true,
      },
    };
  }

  // Warn about local includes (they may fail during compilation)
  const localIncludeWarning =
    localIncludes.length > 0
      ? {
          warning: "Contract has local includes",
          includes: localIncludes,
          note: "Local includes may fail if files are not in the expected location relative to the contract",
        }
      : null;

  // Check for empty input
  if (!code || code.trim().length === 0) {
    return {
      success: false,
      errorType: "user_error",
      error: "Empty contract code provided",
      message: "❌ No contract code to validate",
      userAction: {
        problem: "The contract code is empty or contains only whitespace",
        solution: "Provide valid Compact contract source code",
        example: `pragma language_version >= 0.16;

import CompactStandardLibrary;

export ledger counter: Counter;

export circuit increment(): [] {
  counter.increment(1);
}`,
      },
    };
  }

  // Check for excessively large input (potential abuse or mistake)
  const MAX_CODE_SIZE = 1024 * 1024; // 1MB
  if (code.length > MAX_CODE_SIZE) {
    return {
      success: false,
      errorType: "user_error",
      error: "Contract code too large",
      message: "❌ Contract code exceeds maximum size",
      userAction: {
        problem: `Contract is ${(code.length / 1024).toFixed(1)}KB, maximum is ${MAX_CODE_SIZE / 1024}KB`,
        solution: "Reduce contract size or split into multiple files",
      },
    };
  }

  // Check for missing pragma (common user mistake)
  if (!code.includes("pragma language_version")) {
    return {
      success: false,
      errorType: "user_error",
      error: "Missing pragma directive",
      message: "❌ Contract is missing required pragma directive",
      userAction: {
        problem:
          "All Compact contracts must start with a pragma language_version directive",
        solution: "Add pragma directive at the beginning of your contract",
        fix: "Add: pragma language_version >= 0.16;",
        example: `pragma language_version >= 0.16;

import CompactStandardLibrary;

// ... rest of your contract`,
      },
      detectedIssues: ["Missing pragma language_version directive"],
    };
  }

  // Check for missing import (common for Counter, Map, etc.)
  const usesStdLib =
    code.includes("Counter") ||
    code.includes("Map<") ||
    code.includes("Set<") ||
    code.includes("Opaque<");
  const hasImport =
    code.includes("import CompactStandardLibrary") ||
    code.includes('include "std"');

  if (usesStdLib && !hasImport) {
    return {
      success: false,
      errorType: "user_error",
      error: "Missing standard library import",
      message: "❌ Contract uses standard library types without importing them",
      userAction: {
        problem:
          "You're using types like Counter, Map, Set, or Opaque without importing the standard library",
        solution: "Add the import statement after your pragma directive",
        fix: "Add: import CompactStandardLibrary;",
        example: `pragma language_version >= 0.16;

import CompactStandardLibrary;

export ledger counter: Counter;
// ...`,
      },
      detectedIssues: [
        "Uses standard library types (Counter, Map, Set, Opaque)",
        "Missing: import CompactStandardLibrary;",
      ],
    };
  }

  // ============================================================================
  // COMPILER CHECK - Verify compiler is available
  // ============================================================================

  let compactPath: string;
  let compilerVersion: string;

  try {
    // Cross-platform compiler detection
    const findCommand = platform === "win32" ? "where compact" : "which compact";
    const { stdout: whichOutput } = await execAsync(findCommand);
    // On Windows, 'where' may return multiple lines; take the first
    compactPath = whichOutput.trim().split(/\r?\n/)[0];

    const { stdout: versionOutput } = await execAsync(
      "compact compile --version"
    );
    compilerVersion = versionOutput.trim();
  } catch {
    return {
      success: false,
      errorType: "environment_error",
      compilerInstalled: false,
      error: "Compact compiler not found",
      message: "❌ Compact compiler is not installed",
      installation: {
        message:
          "The Compact compiler is required for contract validation. Install it with:",
        command: `curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh`,
        postInstall: [
          "After installation, run: compact update",
          "Then verify with: compact compile --version",
        ],
        docs: "https://docs.midnight.network/develop/tutorial/building",
      },
      userAction: {
        problem: "The Compact compiler is not installed on this system",
        solution:
          "Install the compiler using the command above, then retry validation",
        isUserFault: false,
      },
    };
  }

  // Check compiler version compatibility
  const versionMatch = compilerVersion.match(/(\d+)\.(\d+)/);
  if (versionMatch) {
    const major = parseInt(versionMatch[1], 10);
    const minor = parseInt(versionMatch[2], 10);
    if (major === 0 && minor < 16) {
      return {
        success: false,
        errorType: "environment_error",
        compilerInstalled: true,
        compilerVersion,
        error: "Compiler version too old",
        message: `❌ Compact compiler ${compilerVersion} is outdated`,
        userAction: {
          problem: `Your compiler version (${compilerVersion}) may not support current syntax`,
          solution: "Update to the latest compiler version",
          command: "compact update",
          isUserFault: false,
        },
      };
    }
  }

  // ============================================================================
  // COMPILATION - Create temp files and run compiler
  // ============================================================================

  const tempDir = join(tmpdir(), `midnight-validate-${Date.now()}`);
  const contractPath = join(tempDir, filename);
  const outputDir = join(tempDir, "output");

  try {
    // Create temp directory
    try {
      await mkdir(tempDir, { recursive: true });
      await mkdir(outputDir, { recursive: true });
    } catch (fsError: unknown) {
      const err = fsError as { code?: string; message?: string };
      return {
        success: false,
        errorType: "system_error",
        error: "Failed to create temporary directory",
        message: "❌ System error: Cannot create temp files",
        systemError: {
          code: err.code,
          details: err.message,
          problem:
            err.code === "ENOSPC"
              ? "Disk is full"
              : err.code === "EACCES"
                ? "Permission denied"
                : "File system error",
          solution:
            err.code === "ENOSPC"
              ? "Free up disk space and retry"
              : err.code === "EACCES"
                ? "Check file system permissions"
                : "Check system resources",
          isUserFault: false,
        },
      };
    }

    // Write contract file
    try {
      await writeFile(contractPath, code, "utf-8");
    } catch (writeError: unknown) {
      const err = writeError as { code?: string; message?: string };
      return {
        success: false,
        errorType: "system_error",
        error: "Failed to write contract file",
        message: "❌ System error: Cannot write temp file",
        systemError: {
          code: err.code,
          details: err.message,
          isUserFault: false,
        },
      };
    }

    // Run compilation
    try {
      const { stdout, stderr } = await execAsync(
        `compact compile "${contractPath}" "${outputDir}"`,
        {
          timeout: 60000, // 60 second timeout
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        }
      );

      // Compilation succeeded!
      const allWarnings = stderr ? parseWarnings(stderr) : [];

      // Add local include warning if applicable
      if (localIncludeWarning) {
        allWarnings.push(
          `Note: Contract has local includes (${localIncludes.join(", ")}) - ensure these files exist relative to your contract`
        );
      }

      return {
        success: true,
        errorType: null,
        compilerInstalled: true,
        compilerVersion,
        compilerPath: compactPath,
        message: "✅ Contract compiled successfully!",
        output: stdout || "Compilation completed without errors",
        warnings: allWarnings,
        localIncludes: localIncludes.length > 0 ? localIncludes : undefined,
        contractInfo: {
          filename,
          codeLength: code.length,
          lineCount: code.split("\n").length,
        },
        nextSteps: [
          "The contract syntax is valid and compiles",
          "Generated files would be in the output directory",
          "You can proceed with deployment or further development",
        ],
      };
    } catch (compileError: unknown) {
      // Compilation failed - parse and categorize the error
      const error = compileError as {
        stdout?: string;
        stderr?: string;
        message?: string;
        killed?: boolean;
        signal?: string;
        code?: number;
      };

      // Check for timeout
      if (error.killed || error.signal === "SIGTERM") {
        return {
          success: false,
          errorType: "timeout_error",
          compilerInstalled: true,
          compilerVersion,
          error: "Compilation timed out",
          message: "❌ Compilation timed out after 60 seconds",
          userAction: {
            problem: "The contract took too long to compile",
            solution:
              "Simplify the contract or check for infinite loops in circuit logic",
            possibleCauses: [
              "Very complex contract with many circuits",
              "Recursive or deeply nested structures",
              "Large number of constraints",
            ],
            isUserFault: true,
          },
        };
      }

      const errorOutput = error.stderr || error.stdout || error.message || "";
      const diagnostics = parseCompilerErrors(errorOutput, code);

      // Categorize the error for better user feedback
      const errorCategory = categorizeCompilerError(errorOutput);

      return {
        success: false,
        errorType: "compilation_error",
        errorCategory,
        compilerInstalled: true,
        compilerVersion,
        compilerPath: compactPath,
        message: `❌ ${errorCategory.title}`,
        errors: diagnostics.errors,
        errorCount: diagnostics.errors.length,
        rawOutput: errorOutput.slice(0, 2000),
        contractInfo: {
          filename,
          codeLength: code.length,
          lineCount: code.split("\n").length,
        },
        userAction: {
          problem: errorCategory.explanation,
          solution: errorCategory.solution,
          isUserFault: true,
        },
        suggestions: diagnostics.suggestions,
        commonFixes: getCommonFixes(diagnostics.errors),
      };
    }
  } finally {
    // Cleanup temp files (cross-platform)
    try {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Categorize compiler errors for better user feedback
 */
function categorizeCompilerError(output: string): {
  category: string;
  title: string;
  explanation: string;
  solution: string;
} {
  const lowerOutput = output.toLowerCase();

  if (
    lowerOutput.includes("parse error") ||
    lowerOutput.includes("looking for")
  ) {
    return {
      category: "syntax_error",
      title: "Syntax Error",
      explanation:
        "The contract has invalid syntax that the parser cannot understand",
      solution:
        "Check for missing semicolons, brackets, or typos near the indicated line",
    };
  }

  if (
    lowerOutput.includes("type") &&
    (lowerOutput.includes("mismatch") || lowerOutput.includes("expected"))
  ) {
    return {
      category: "type_error",
      title: "Type Error",
      explanation: "There is a type mismatch in your contract",
      solution: "Ensure variable types match expected types in operations",
    };
  }

  if (
    lowerOutput.includes("undefined") ||
    lowerOutput.includes("not found") ||
    lowerOutput.includes("unknown")
  ) {
    return {
      category: "reference_error",
      title: "Reference Error",
      explanation: "The contract references something that doesn't exist",
      solution:
        "Check that all variables, types, and functions are properly defined or imported",
    };
  }

  if (
    lowerOutput.includes("import") ||
    lowerOutput.includes("include") ||
    lowerOutput.includes("module")
  ) {
    return {
      category: "import_error",
      title: "Import Error",
      explanation: "There is a problem with an import or include statement",
      solution:
        "Verify import paths and ensure required libraries are available",
    };
  }

  if (
    lowerOutput.includes("circuit") ||
    lowerOutput.includes("witness") ||
    lowerOutput.includes("ledger")
  ) {
    return {
      category: "structure_error",
      title: "Contract Structure Error",
      explanation:
        "There is an issue with the contract structure (circuits, witnesses, or ledger)",
      solution: "Review the contract structure against Compact documentation",
    };
  }

  return {
    category: "unknown_error",
    title: "Compilation Failed",
    explanation: "The compiler encountered an error",
    solution: "Review the error message and check Compact documentation",
  };
}

/**
 * Parse compiler error output into structured diagnostics
 */
function parseCompilerErrors(
  output: string,
  sourceCode: string
): {
  errors: Array<{
    line?: number;
    column?: number;
    message: string;
    severity: "error" | "warning";
    context?: string;
  }>;
  suggestions: string[];
} {
  const errors: Array<{
    line?: number;
    column?: number;
    message: string;
    severity: "error" | "warning";
    context?: string;
  }> = [];
  const suggestions: string[] = [];
  const lines = sourceCode.split("\n");

  // Common patterns in Compact compiler output
  // Pattern: "error: <message>" or "Error: <message>"
  const errorLinePattern = /(?:error|Error):\s*(.+)/gi;
  // Pattern: "line <n>:" or "at line <n>" or "<filename>:<line>:<col>"
  const lineNumberPattern = /(?:line\s*(\d+)|at\s+line\s+(\d+)|:(\d+):(\d+))/i;
  // Pattern: "expected <x>, found <y>"
  const expectedPattern =
    /expected\s+['"`]?([^'"`]+)['"`]?,?\s*(?:found|got)\s+['"`]?([^'"`]+)['"`]?/i;

  // Split output into logical segments
  const segments = output.split(/(?=error:|Error:)/i);

  for (const segment of segments) {
    if (!segment.trim()) continue;

    const errorMatch = segment.match(errorLinePattern);
    if (errorMatch) {
      const message = errorMatch[0].replace(/^(?:error|Error):\s*/i, "").trim();

      // Try to extract line number
      const lineMatch = segment.match(lineNumberPattern);
      const line = lineMatch
        ? parseInt(lineMatch[1] || lineMatch[2] || lineMatch[3], 10)
        : undefined;
      const column =
        lineMatch && lineMatch[4] ? parseInt(lineMatch[4], 10) : undefined;

      // Get source context if we have a line number
      let context: string | undefined;
      if (line && line > 0 && line <= lines.length) {
        const start = Math.max(0, line - 2);
        const end = Math.min(lines.length, line + 1);
        context = lines
          .slice(start, end)
          .map((l, i) => `${start + i + 1}: ${l}`)
          .join("\n");
      }

      errors.push({
        line,
        column,
        message,
        severity: "error",
        context,
      });

      // Generate suggestions based on error type
      const expectedMatch = message.match(expectedPattern);
      if (expectedMatch) {
        suggestions.push(
          `Expected "${expectedMatch[1]}" but found "${expectedMatch[2]}". Check your syntax.`
        );
      }
    }
  }

  // If no structured errors found, add the raw output as an error
  if (errors.length === 0 && output.trim()) {
    errors.push({
      message: output.trim().slice(0, 500),
      severity: "error",
    });
  }

  // Add general suggestions based on common issues
  if (output.includes("Cell")) {
    suggestions.push(
      "Remember to use .value to access Cell<T> contents (e.g., state.value)"
    );
  }
  if (output.includes("Opaque")) {
    suggestions.push(
      'Opaque<"string"> is a type, not a type alias. Use it directly in signatures.'
    );
  }
  if (output.includes("disclose")) {
    suggestions.push(
      "In conditionals, use: const x = disclose(expr); if (x) { ... } instead of if (disclose(expr))"
    );
  }
  if (output.includes("Counter")) {
    suggestions.push(
      "Counter type requires initialization: counter = Counter.increment(counter, 1)"
    );
  }

  return { errors, suggestions };
}

/**
 * Parse warnings from compiler output
 */
function parseWarnings(output: string): string[] {
  const warnings: string[] = [];
  const warningPattern = /(?:warning|Warning):\s*(.+)/gi;

  let match;
  while ((match = warningPattern.exec(output)) !== null) {
    warnings.push(match[1].trim());
  }

  return warnings;
}

/**
 * Get common fixes based on error patterns
 */
function getCommonFixes(
  errors: Array<{ message: string }>
): Array<{ pattern: string; fix: string }> {
  const fixes: Array<{ pattern: string; fix: string }> = [];
  const messages = errors.map((e) => e.message.toLowerCase()).join(" ");

  if (messages.includes("cell") || messages.includes("value")) {
    fixes.push({
      pattern: "Cell<T> access error",
      fix: "Use `state.value` instead of just `state` when accessing Cell contents",
    });
  }

  if (messages.includes("opaque") || messages.includes("string type")) {
    fixes.push({
      pattern: "Opaque string type error",
      fix: 'Use `Opaque<"your_type_name">` directly - it cannot be aliased with type keyword',
    });
  }

  if (messages.includes("boolean") || messages.includes("witness")) {
    fixes.push({
      pattern: "Boolean witness error",
      fix: "Witnesses return `Uint<1>` not `Boolean` - use `x != 0` to convert to Boolean",
    });
  }

  if (messages.includes("disclose") || messages.includes("conditional")) {
    fixes.push({
      pattern: "Disclosure in conditional error",
      fix: "Store disclose() result in const before using in if: `const revealed = disclose(x); if (revealed) { ... }`",
    });
  }

  if (messages.includes("counter") || messages.includes("increment")) {
    fixes.push({
      pattern: "Counter initialization error",
      fix: "Initialize counters with: `counter = Counter.increment(counter, 1)`",
    });
  }

  if (
    messages.includes("map") ||
    messages.includes("key") ||
    messages.includes("insert")
  ) {
    fixes.push({
      pattern: "Map operation error",
      fix: "Maps require aligned access: insert at key before reading, or use default values",
    });
  }

  return fixes;
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

// ============================================================================
// CONTRACT STRUCTURE EXTRACTION
// ============================================================================

/**
 * Extract the structure of a Compact contract (circuits, witnesses, ledger, etc.)
 * This helps agents understand what a contract does without parsing it themselves
 */
export async function extractContractStructure(
  input: ExtractContractStructureInput
) {
  logger.debug("Extracting contract structure", {
    hasCode: !!input.code,
    filePath: input.filePath,
  });

  // Resolve code source
  let code: string;
  let filename: string;

  if (input.filePath) {
    // SECURITY: Validate file path
    const pathValidation = validateFilePath(input.filePath);
    if (!pathValidation.valid) {
      return {
        success: false,
        error: "Invalid file path",
        message: pathValidation.error,
      };
    }

    try {
      code = await readFile(pathValidation.normalizedPath!, "utf-8");
      filename = basename(pathValidation.normalizedPath!);

      // Check for binary content
      if (!isValidUtf8Text(code)) {
        return {
          success: false,
          error: "Invalid file content",
          message: "File appears to be binary or contains invalid characters",
        };
      }
    } catch (fsError: unknown) {
      const err = fsError as { code?: string; message?: string };
      return {
        success: false,
        error: "Failed to read file",
        message: `Cannot read file: ${input.filePath}`,
        details: err.code === "ENOENT" ? "File does not exist" : err.message,
      };
    }
  } else if (input.code) {
    code = input.code;
    filename = "contract.compact";

    // Check for binary content
    if (!isValidUtf8Text(code)) {
      return {
        success: false,
        error: "Invalid code content",
        message: "Code contains invalid characters",
      };
    }
  } else {
    return {
      success: false,
      error: "No contract provided",
      message: "Must provide either 'code' or 'filePath'",
    };
  }

  // Extract pragma version
  const pragmaMatch = code.match(/pragma\s+language_version\s*>=?\s*([\d.]+)/);
  const languageVersion = pragmaMatch ? pragmaMatch[1] : null;

  // Extract imports
  const imports: string[] = [];
  const importMatches = code.matchAll(/import\s+(\w+)|include\s+"([^"]+)"/g);
  for (const match of importMatches) {
    imports.push(match[1] || match[2]);
  }

  // Extract exported circuits
  const circuits: Array<{
    name: string;
    params: string[];
    returnType: string;
    isExport: boolean;
    line: number;
  }> = [];
  const circuitPattern =
    /(?:(export)\s+)?circuit\s+(\w+)\s*\(([^)]*)\)\s*:\s*(\[[^\]]*\]|[\w<>,\s]+)/g;
  const lines = code.split("\n");

  let circuitMatch;
  while ((circuitMatch = circuitPattern.exec(code)) !== null) {
    const lineNum = code.substring(0, circuitMatch.index).split("\n").length;
    const params = circuitMatch[3]
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p);

    circuits.push({
      name: circuitMatch[2],
      params,
      returnType: circuitMatch[4].trim(),
      isExport: circuitMatch[1] === "export",
      line: lineNum,
    });
  }

  // Extract witnesses
  const witnesses: Array<{
    name: string;
    type: string;
    isExport: boolean;
    line: number;
  }> = [];
  const witnessPattern = /(?:(export)\s+)?witness\s+(\w+)\s*:\s*([^;]+)/g;

  let witnessMatch;
  while ((witnessMatch = witnessPattern.exec(code)) !== null) {
    const lineNum = code.substring(0, witnessMatch.index).split("\n").length;
    witnesses.push({
      name: witnessMatch[2],
      type: witnessMatch[3].trim(),
      isExport: witnessMatch[1] === "export",
      line: lineNum,
    });
  }

  // Extract ledger items
  const ledgerItems: Array<{
    name: string;
    type: string;
    isExport: boolean;
    line: number;
  }> = [];
  const ledgerPattern = /(?:(export)\s+)?ledger\s+(\w+)\s*:\s*([^;]+)/g;

  let ledgerMatch;
  while ((ledgerMatch = ledgerPattern.exec(code)) !== null) {
    const lineNum = code.substring(0, ledgerMatch.index).split("\n").length;
    ledgerItems.push({
      name: ledgerMatch[2],
      type: ledgerMatch[3].trim(),
      isExport: ledgerMatch[1] === "export",
      line: lineNum,
    });
  }

  // Extract type definitions
  const types: Array<{
    name: string;
    definition: string;
    line: number;
  }> = [];
  const typePattern = /type\s+(\w+)\s*=\s*([^;]+)/g;

  let typeMatch;
  while ((typeMatch = typePattern.exec(code)) !== null) {
    const lineNum = code.substring(0, typeMatch.index).split("\n").length;
    types.push({
      name: typeMatch[1],
      definition: typeMatch[2].trim(),
      line: lineNum,
    });
  }

  // Extract struct definitions
  const structs: Array<{
    name: string;
    fields: string[];
    line: number;
  }> = [];
  const structPattern = /struct\s+(\w+)\s*\{([^}]+)\}/g;

  let structMatch;
  while ((structMatch = structPattern.exec(code)) !== null) {
    const lineNum = code.substring(0, structMatch.index).split("\n").length;
    const fields = structMatch[2]
      .split(",")
      .map((f) => f.trim())
      .filter((f) => f);
    structs.push({
      name: structMatch[1],
      fields,
      line: lineNum,
    });
  }

  // Extract enum definitions
  const enums: Array<{
    name: string;
    variants: string[];
    line: number;
  }> = [];
  const enumPattern = /enum\s+(\w+)\s*\{([^}]+)\}/g;

  let enumMatch;
  while ((enumMatch = enumPattern.exec(code)) !== null) {
    const lineNum = code.substring(0, enumMatch.index).split("\n").length;
    const variants = enumMatch[2]
      .split(",")
      .map((v) => v.trim())
      .filter((v) => v);
    enums.push({
      name: enumMatch[1],
      variants,
      line: lineNum,
    });
  }

  // Generate summary
  const exports = {
    circuits: circuits.filter((c) => c.isExport).map((c) => c.name),
    witnesses: witnesses.filter((w) => w.isExport).map((w) => w.name),
    ledger: ledgerItems.filter((l) => l.isExport).map((l) => l.name),
  };

  const summary = [];
  if (circuits.length > 0) {
    summary.push(`${circuits.length} circuit(s)`);
  }
  if (witnesses.length > 0) {
    summary.push(`${witnesses.length} witness(es)`);
  }
  if (ledgerItems.length > 0) {
    summary.push(`${ledgerItems.length} ledger item(s)`);
  }
  if (types.length > 0) {
    summary.push(`${types.length} type alias(es)`);
  }
  if (structs.length > 0) {
    summary.push(`${structs.length} struct(s)`);
  }
  if (enums.length > 0) {
    summary.push(`${enums.length} enum(s)`);
  }

  return {
    success: true,
    filename,
    languageVersion,
    imports,
    structure: {
      circuits,
      witnesses,
      ledgerItems,
      types,
      structs,
      enums,
    },
    exports,
    stats: {
      lineCount: lines.length,
      circuitCount: circuits.length,
      witnessCount: witnesses.length,
      ledgerCount: ledgerItems.length,
      typeCount: types.length,
      structCount: structs.length,
      enumCount: enums.length,
      exportedCircuits: exports.circuits.length,
      exportedWitnesses: exports.witnesses.length,
      exportedLedger: exports.ledger.length,
    },
    summary: summary.length > 0 ? summary.join(", ") : "Empty contract",
    message: `📋 Contract contains: ${summary.join(", ") || "no definitions found"}`,
  };
}
