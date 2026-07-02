/**
 * Repository handler functions
 * Business logic for repository-related MCP tools
 */

import { githubClient, GitHubCommit } from "../../pipeline/index.js";
import { releaseTracker } from "../../pipeline/releases.js";
import {
  logger,
  config,
  DEFAULT_REPOSITORIES,
  SelfCorrectionHints,
} from "../../utils/index.js";
import { sendProgressNotification } from "../../server.js";
import { REPO_ALIASES, EXAMPLES } from "./constants.js";
import { EMBEDDED_DOCS } from "../../resources/content/docs-content.js";
import {
  COMPACT_VERSION,
  RECOMMENDED_PRAGMA,
  REFERENCE_CONTRACTS,
  BUILTIN_FUNCTIONS,
  TYPE_COMPATIBILITY,
  LEDGER_TYPE_LIMITS,
  COMMON_ERRORS,
  type LedgerADTOperations,
} from "../../config/compact-version.js";
import {
  searchCompactSyntax,
  validateAllStaticData,
  scanForDeprecatedPatterns,
  type StaticDataValidation,
} from "../../services/syntax-validator.js";
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
export { extractContractStructure } from "./validation.js";

/**
 * Owners allowed for the bare "owner/repo" fall-through in resolveRepo().
 * Seeded from the vetted alias + configured-repo lists and extended by the
 * operator via MIDNIGHT_MCP_ALLOWED_REPO_OWNERS. Without this gate a
 * prompt-injected model could read ANY GitHub repo — including private ones —
 * with the operator's token.
 */
const ALLOWED_REPO_OWNERS: Set<string> = new Set(
  [
    ...Object.values(REPO_ALIASES).map((a) => a.owner),
    ...DEFAULT_REPOSITORIES.map((r) => r.owner),
    ...config.allowedRepoOwners,
  ].map((owner) => owner.toLowerCase())
);

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

  // Assume it's a full org/repo name — but only for allowlisted owners.
  // Returning null for anything else makes callers emit the UNKNOWN_REPO hint
  // instead of reading an arbitrary repo with the operator's token.
  if (name.includes("/")) {
    const [owner, repo] = name.split("/");
    if (owner && repo && ALLOWED_REPO_OWNERS.has(owner.toLowerCase())) {
      return { owner, repo };
    }
    return null;
  }

  return null;
}

/**
 * Retrieve a specific file from Midnight repositories
 */
// Maximum content size to prevent MCP response overflow (50KB)
const MAX_FILE_CONTENT_LENGTH = 50000;

/**
 * Language-aware truncation ratios
 * - Compact: pragma/imports at top are critical, keep more from top
 * - TypeScript/JS: exports often at bottom, keep balanced
 */
const TRUNCATION_RATIOS: Record<string, { top: number; bottom: number }> = {
  compact: { top: 0.8, bottom: 0.2 }, // 40KB top, 10KB bottom
  typescript: { top: 0.5, bottom: 0.5 }, // 25KB each
  javascript: { top: 0.5, bottom: 0.5 },
  default: { top: 0.6, bottom: 0.4 }, // Slight preference for top
};

/**
 * Detect language from file path
 */
function detectLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "compact":
      return "compact";
    case "ts":
    case "tsx":
      return "typescript";
    case "js":
    case "jsx":
    case "mjs":
      return "javascript";
    default:
      return "default";
  }
}

/**
 * Truncation result with detailed agent guidance
 */
interface TruncationResult {
  content: string;
  truncated: boolean;
  truncationInfo?: {
    originalSize: number;
    keptBytes: number;
    omittedBytes: number;
    keptLineRanges: { start: number; end: number }[];
    omittedLineRange: { start: number; end: number };
    language: string;
    ratioUsed: { top: number; bottom: number };
  };
  agentGuidance?: {
    whatYouHave: string;
    whatIsMissing: string;
    howToGetMore: string[];
    suggestedNextCalls: Array<{
      startLine: number;
      endLine: number;
      reason: string;
    }>;
  };
}

/**
 * Smart truncation: language-aware content preservation
 * - Compact files: keeps 80% from top (pragma/imports are critical)
 * - TypeScript/JS: keeps 50/50 (exports often at bottom)
 * Returns detailed guidance for the agent to continue if needed
 */
function smartTruncate(
  content: string,
  filePath: string = "",
  maxLength: number = MAX_FILE_CONTENT_LENGTH
): TruncationResult {
  if (content.length <= maxLength) {
    return { content, truncated: false };
  }

  const language = detectLanguage(filePath);
  const ratio = TRUNCATION_RATIOS[language] || TRUNCATION_RATIOS.default;

  const lines = content.split("\n");
  const totalLines = lines.length;

  const topLength = Math.floor(maxLength * ratio.top);
  const bottomLength = maxLength - topLength;

  const firstPart = content.slice(0, topLength);
  const lastPart = content.slice(-bottomLength);
  const omittedBytes = content.length - maxLength;

  // Calculate line numbers for context
  const firstPartLines = firstPart.split("\n").length;
  const lastPartLines = lastPart.split("\n").length;
  const omittedStartLine = firstPartLines + 1;
  const omittedEndLine = totalLines - lastPartLines;

  // Language-specific context message
  const languageContext =
    language === "compact"
      ? "Compact files: pragma and imports preserved at top (critical for compilation)"
      : language === "typescript" || language === "javascript"
        ? "TS/JS files: balanced truncation preserves imports AND exports"
        : "Balanced truncation applied";

  const truncatedContent =
    firstPart +
    `\n\n/* ══════════════════════════════════════════════════════════════════════════════
   CONTENT TRUNCATED: Lines ${omittedStartLine}-${omittedEndLine} omitted (${omittedBytes.toLocaleString()} bytes)
   ${languageContext}
   
   To get the omitted content, call this tool again with:
   - startLine: ${omittedStartLine}, endLine: ${Math.min(omittedStartLine + 200, omittedEndLine)} (first part of omitted)
   - startLine: ${Math.max(omittedStartLine, omittedEndLine - 200)}, endLine: ${omittedEndLine} (last part of omitted)
   
   Or request the full middle section:
   - startLine: ${omittedStartLine}, endLine: ${omittedEndLine}
══════════════════════════════════════════════════════════════════════════════ */\n\n` +
    lastPart;

  return {
    content: truncatedContent,
    truncated: true,
    truncationInfo: {
      originalSize: content.length,
      keptBytes: maxLength,
      omittedBytes,
      keptLineRanges: [
        { start: 1, end: firstPartLines },
        { start: totalLines - lastPartLines + 1, end: totalLines },
      ],
      omittedLineRange: { start: omittedStartLine, end: omittedEndLine },
      language,
      ratioUsed: ratio,
    },
    agentGuidance: {
      whatYouHave: `Lines 1-${firstPartLines} (${Math.round(ratio.top * 100)}% from top) and lines ${totalLines - lastPartLines + 1}-${totalLines} (${Math.round(ratio.bottom * 100)}% from bottom)`,
      whatIsMissing: `Lines ${omittedStartLine}-${omittedEndLine} (${omittedEndLine - omittedStartLine + 1} lines, ${omittedBytes.toLocaleString()} bytes)`,
      howToGetMore: [
        `Call midnight-get-file again with startLine and endLine parameters`,
        `The omitted content is in the middle of the file`,
        `You can request it in chunks (e.g., 200 lines at a time) or all at once`,
      ],
      suggestedNextCalls: [
        {
          startLine: omittedStartLine,
          endLine: Math.min(omittedStartLine + 199, omittedEndLine),
          reason: "First chunk of omitted content",
        },
        ...(omittedEndLine - omittedStartLine > 200
          ? [
              {
                startLine: Math.max(omittedStartLine, omittedEndLine - 199),
                endLine: omittedEndLine,
                reason:
                  "Last chunk of omitted content (may overlap if file is small)",
              },
            ]
          : []),
      ],
    },
  };
}

export async function getFile(input: GetFileInput) {
  logger.debug("Getting file", {
    repo: input.repo,
    path: input.path,
    startLine: input.startLine,
    endLine: input.endLine,
  });

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

  let content = file.content;
  const totalLines = content.split("\n").length;
  let lineRange: { start: number; end: number } | undefined;

  // Handle line-range extraction
  if (input.startLine || input.endLine) {
    const lines = content.split("\n");
    const start = Math.max(1, input.startLine || 1);
    const end = Math.min(lines.length, input.endLine || lines.length);

    if (start > end) {
      return {
        error: `Invalid line range: startLine (${start}) > endLine (${end})`,
        suggestion: "Ensure startLine is less than or equal to endLine",
      };
    }

    content = lines.slice(start - 1, end).join("\n");
    lineRange = { start, end };
    logger.debug("Extracted line range", {
      start,
      end,
      extractedLines: end - start + 1,
    });
  }

  // Smart truncation (language-aware: Compact=80% top, TS/JS=50/50)
  const truncateResult = smartTruncate(content, input.path);

  // Log truncation events for monitoring
  if (truncateResult.truncated) {
    logger.info("File content truncated", {
      repository: `${repoInfo.owner}/${repoInfo.repo}`,
      path: input.path,
      language: truncateResult.truncationInfo?.language,
      originalSize: file.size,
      contentLength: content.length,
      omittedLines: truncateResult.truncationInfo?.omittedLineRange,
    });
  }

  return {
    content: truncateResult.content,
    path: file.path,
    repository: `${repoInfo.owner}/${repoInfo.repo}`,
    sha: file.sha,
    size: file.size,
    totalLines,
    ...(lineRange && { lineRange }),
    truncated: truncateResult.truncated,
    ...(truncateResult.truncationInfo && {
      truncationInfo: truncateResult.truncationInfo,
    }),
    ...(truncateResult.agentGuidance && {
      agentGuidance: truncateResult.agentGuidance,
    }),
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

  // Smart truncation (language-aware: Compact=80% top, TS/JS=50/50)
  const truncateResult = smartTruncate(result.content, input.path);

  // Log truncation events for monitoring
  if (truncateResult.truncated) {
    logger.info("File content truncated (versioned)", {
      repository: `${resolved.owner}/${resolved.repo}`,
      path: input.path,
      version: input.version,
      language: truncateResult.truncationInfo?.language,
      contentLength: result.content.length,
      omittedLines: truncateResult.truncationInfo?.omittedLineRange,
    });
  }

  return {
    repository: `${resolved.owner}/${resolved.repo}`,
    path: input.path,
    version: result.version,
    content: truncateResult.content,
    truncated: truncateResult.truncated,
    ...(truncateResult.truncationInfo && {
      truncationInfo: truncateResult.truncationInfo,
    }),
    ...(truncateResult.agentGuidance && {
      agentGuidance: truncateResult.agentGuidance,
    }),
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

  // Smart truncation for both versions (language-aware)
  const truncateForComparison = (content: string | null, label: string) => {
    if (!content) return { content: null, truncated: false };
    const result = smartTruncate(content, input.path);
    if (result.truncated) {
      logger.info("Comparison content truncated", {
        repository: `${resolved.owner}/${resolved.repo}`,
        path: input.path,
        version: label,
        language: result.truncationInfo?.language,
        contentLength: content.length,
        truncationInfo: result.truncationInfo,
      });
    }
    return result;
  };

  const old = truncateForComparison(
    comparison.oldContent,
    comparison.oldVersion
  );
  const newC = truncateForComparison(
    comparison.newContent,
    comparison.newVersion
  );

  return {
    repository: `${resolved.owner}/${resolved.repo}`,
    path: input.path,
    oldVersion: comparison.oldVersion,
    newVersion: comparison.newVersion,
    hasDifferences: comparison.hasDifferences,
    oldContent: old.content,
    newContent: newC.content,
    contentTruncated: old.truncated || newC.truncated,
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
    // Version config is centralized in src/config/compact-version.ts
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

        if (
          latestVersion !== COMPACT_VERSION.max &&
          parseFloat(latestVersion) > parseFloat(COMPACT_VERSION.max)
        ) {
          versionWarning = `⚠️ Compact ${latestTag} is available. This reference is based on ${COMPACT_VERSION.max}. Some syntax may have changed - check release notes for breaking changes. See docs/SYNTAX_MAINTENANCE.md for update instructions.`;
        }
      }
    } catch {
      // Ignore version check errors, still return cached docs
    }

    if (compactReference) {
      // ============================================================
      // HYBRID VALIDATION: Validate ALL static data against indexed docs
      // The indexed docs are the source of truth - static is fallback
      // ============================================================
      logger.debug(
        "Starting comprehensive hybrid validation against indexed docs"
      );

      // Validate ALL static data types in parallel
      let comprehensiveValidation:
        | {
            overall: {
              validated: boolean;
              totalDiscrepancies: number;
              totalEnrichments: number;
            };
            results: Record<string, StaticDataValidation>;
            lastValidated: string;
          }
        | undefined;

      try {
        comprehensiveValidation = await validateAllStaticData({
          builtinFunctions: BUILTIN_FUNCTIONS.stdlib,
          typeCompatibility: [
            ...TYPE_COMPATIBILITY.comparisons,
            ...TYPE_COMPATIBILITY.arithmetic,
          ],
          commonErrors: COMMON_ERRORS,
          ledgerTypeLimits: LEDGER_TYPE_LIMITS,
        });

        logger.debug("Comprehensive validation complete", {
          validated: comprehensiveValidation.overall.validated,
          discrepancies: comprehensiveValidation.overall.totalDiscrepancies,
          enrichments: comprehensiveValidation.overall.totalEnrichments,
        });
      } catch (err: unknown) {
        logger.warn(
          "Comprehensive validation failed, falling back to ADT-only validation",
          {
            error: err instanceof Error ? err.message : String(err),
          }
        );
      }

      // Collect all validation warnings and enrichments
      const validationWarnings: string[] = [];
      const validationEnrichments: string[] = [];

      if (comprehensiveValidation) {
        for (const [key, result] of Object.entries(
          comprehensiveValidation.results
        )) {
          if (result.discrepancies.length > 0) {
            validationWarnings.push(
              `${key}: ${result.discrepancies.join("; ")}`
            );
          }
          if (result.enrichments.length > 0) {
            validationEnrichments.push(
              `${key}: ${result.enrichments.join("; ")}`
            );
          }
        }
      }

      // Search indexed docs for additional syntax patterns
      let indexedSyntaxPatterns: Record<string, unknown> | undefined;
      try {
        const syntaxSearch = await searchCompactSyntax(
          "circuit witness ledger pragma"
        );
        if (syntaxSearch && syntaxSearch.results.length > 0) {
          indexedSyntaxPatterns = {
            resultCount: syntaxSearch.results.length,
            topSources: syntaxSearch.results.slice(0, 3).map((r) => ({
              path: r.source.filePath,
              repo: r.source.repository,
            })),
          };
        }
      } catch {
        // Syntax search failed, continue with static data
      }

      // Build validated ledger type limits from comprehensive validation
      const validatedLedgerTypeLimits: Record<string, unknown> = {};
      for (const [adtName, staticInfo] of Object.entries(LEDGER_TYPE_LIMITS)) {
        const typedStaticInfo = staticInfo as LedgerADTOperations;
        const adtValidation =
          comprehensiveValidation?.results[`adt_${adtName}`];

        if (adtValidation?.validated) {
          // Use validated data
          validatedLedgerTypeLimits[adtName] = {
            ...typedStaticInfo,
            validatedAgainstDocs: true,
            validationDiscrepancies: adtValidation.discrepancies,
            validationEnrichments: adtValidation.enrichments,
          };
        } else {
          // Fallback to static data
          validatedLedgerTypeLimits[adtName] = {
            ...typedStaticInfo,
            validatedAgainstDocs: false,
            warning:
              "Could not validate against indexed docs - using static reference",
          };
        }
      }

      // Scan the quick start template for deprecated patterns
      const quickStartTemplate = `${RECOMMENDED_PRAGMA}

import CompactStandardLibrary;

export ledger counter: Counter;

export circuit increment(): [] {
  counter.increment(1);
}`;
      const deprecatedInTemplate =
        scanForDeprecatedPatterns(quickStartTemplate);

      return {
        repository: "midnightntwrk/compact",
        version: `${COMPACT_VERSION.min}-${COMPACT_VERSION.max} (current)`,
        versionConfig: {
          min: COMPACT_VERSION.min,
          max: COMPACT_VERSION.max,
          lastUpdated: COMPACT_VERSION.lastUpdated,
          maintenanceGuide:
            "See docs/SYNTAX_MAINTENANCE.md for update instructions",
        },
        ...(versionWarning && { versionWarning }),

        // Comprehensive hybrid validation status
        hybridValidation: {
          enabled: true,
          comprehensive: true,
          // Overall validation stats
          overall: comprehensiveValidation?.overall || {
            validated: false,
            totalDiscrepancies: 0,
            totalEnrichments: 0,
          },
          // Which data types were validated
          validatedDataTypes: comprehensiveValidation
            ? Object.keys(comprehensiveValidation.results)
            : [],
          // All warnings from ALL static data validation
          warnings:
            validationWarnings.length > 0 ? validationWarnings : undefined,
          // All enrichments discovered from indexed docs
          enrichments:
            validationEnrichments.length > 0
              ? validationEnrichments
              : undefined,
          // Indexed syntax pattern sources
          indexedSyntaxPatterns,
          // Deprecated patterns found in quick start template (should be none!)
          deprecatedPatternsInTemplate:
            deprecatedInTemplate.length > 0 ? deprecatedInTemplate : undefined,
          // Last validation timestamp
          lastValidated:
            comprehensiveValidation?.lastValidated || new Date().toISOString(),
        },

        // Quick start template - ALWAYS compiles
        quickStartTemplate: `${RECOMMENDED_PRAGMA}

import CompactStandardLibrary;

export ledger counter: Counter;
export ledger owner: Bytes<32>;

witness local_secret_key(): Bytes<32>;

export circuit increment(): [] {
  counter.increment(1);
}`,

        // Built-in functions vs patterns (CRITICAL knowledge)
        builtinFunctions: BUILTIN_FUNCTIONS,

        // Type compatibility rules
        typeCompatibility: TYPE_COMPATIBILITY,

        // Ledger type limitations - VALIDATED against indexed docs
        ledgerTypeLimits: validatedLedgerTypeLimits,

        // Common compilation errors with fixes
        commonErrors: COMMON_ERRORS,

        // Common mistakes that cause compilation failures
        commonMistakes: [
          {
            wrong: "ledger { field: Type; }",
            correct: "export ledger field: Type;",
            error: 'parse error: found "{" looking for an identifier',
          },
          {
            wrong: "circuit fn(): Void",
            correct: "circuit fn(): []",
            error: 'parse error: found "{" looking for ";"',
          },
          {
            wrong: "pragma language_version >= 0.14.0;",
            correct: RECOMMENDED_PRAGMA,
            error: "version mismatch or parse error",
          },
          {
            wrong: "enum State { a, b }",
            correct: "export enum State { a, b }",
            error: "enum not accessible from TypeScript",
          },
          {
            wrong: "if (witness_val == x)",
            correct: "if (disclose(witness_val == x))",
            error: "implicit disclosure error",
          },
          {
            wrong: "Cell<Field>",
            correct: "Field",
            error: "unbound identifier Cell (deprecated)",
          },
          {
            wrong: "public_key(sk)",
            correct:
              'persistentHash<Vector<2, Bytes<32>>>([pad(32, "midnight:pk:"), sk])',
            error: 'unbound identifier "public_key"',
          },
          {
            wrong: "counter.value()",
            correct: "counter.read()  // Returns Uint<64>",
            error: 'operation "value" undefined for Counter',
          },
          {
            wrong: "Choice::rock (Rust-style)",
            correct: "Choice.rock (dot notation)",
            error: 'parse error: found ":" looking for ")"',
          },
          {
            wrong: "witness fn(): T { ... }",
            correct: "witness fn(): T;  // declaration only, no body",
            error: "parse error after witness declaration",
          },
          {
            wrong: "pure function helper(): T",
            correct: "pure circuit helper(): T",
            error: 'unbound identifier "function"',
          },
          {
            wrong: "amount as Bytes<32>  // direct Uint to Bytes",
            correct: "(amount as Field) as Bytes<32>  // go through Field",
            error: "cannot cast from type Uint<64> to type Bytes<32>",
          },
          {
            wrong: "ledger.insert(key, a + b)  // arithmetic result",
            correct: "ledger.insert(key, (a + b) as Uint<64>)  // cast result",
            error: "expected type Uint<64> but received Uint<0..N>",
          },
          {
            wrong:
              "export circuit fn(param: T): [] { ledger.insert(param, v); }",
            correct:
              "export circuit fn(param: T): [] { const d = disclose(param); ledger.insert(d, v); }",
            error: "potential witness-value disclosure must be declared",
          },
          {
            wrong:
              "NativePoint, nativePointX(p), constructNativePoint(x, y)",
            correct:
              "JubjubPoint, jubjubPointX(p), constructJubjubPoint(x, y)",
            error:
              "apparent use of an old standard-library / ledger operator name NativePoint: the new name is JubjubPoint (renamed in compactc 0.30.0)",
          },
          {
            wrong: "const let = 1;  // or `let` used as any identifier",
            correct: "const value = 1;  // rename the identifier",
            error:
              'parse error: found keyword "let" (which is reserved for future use)',
          },
          {
            wrong: "const MAX_SUPPLY: Uint<64> = 1000;  // module-level const",
            correct:
              "pure circuit max_supply(): Uint<64> { return 1000; }  // wrap in a pure circuit",
            error:
              'parse error: found keyword "const" looking for a program element',
          },
          {
            wrong: "flags | mask  // bitwise OR on Uint",
            correct:
              "// No bitwise ops on Uint — use arithmetic or branching. `||` is logical OR for Booleans only.",
            error: "unexpected character (single `|` not recognized)",
          },
          {
            wrong: "field: Uint<254>",
            correct: "field: Uint<248>  // max byte-aligned Uint width",
            error:
              "Uint width 254 is not between 1 and the maximum Uint width 248 (inclusive)",
          },
          {
            wrong: "convertBytesToUint(255, n, bytes, src)  // number literal",
            correct: "convertBytesToUint(255n, n, bytes, src)  // bigint literal",
            error:
              "TypeScript binding: maxval is bigint since compactc 0.30.101 (avoids silent precision loss)",
          },
        ],

        syntaxReference: compactReference,

        sections: [
          "Quick Start Template",
          "Pragma (Version Declaration)",
          "Imports",
          "Ledger Declarations",
          "Data Types",
          "Built-in Functions",
          "Type Compatibility",
          "Ledger Type Limits",
          "Circuits",
          "Witnesses",
          "Constructor",
          "Common Patterns",
          "Common Operations",
          "Assertions",
          "Common Mistakes to Avoid",
          "Common Errors & Fixes",
          "Exports for TypeScript",
          "Reference Contracts",
        ],

        referenceContracts: REFERENCE_CONTRACTS.map((rc) => ({
          name: rc.name,
          repo: rc.repo,
          description: rc.description,
        })),

        note: `⚠️ CALL THIS TOOL BEFORE generating ANY Compact code!
Use quickStartTemplate as your base. Check commonMistakes BEFORE submitting code.

KEY RULES:
1. public_key() is NOT a builtin - use persistentHash pattern
2. Counter uses .read() not .value() - all ADT methods work in circuits
3. Map.lookup()/Set.member() ARE available in circuits (verified)
4. Arithmetic results need casting: (a + b) as Uint<64>
5. Uint→Bytes needs two casts: (amount as Field) as Bytes<32>
6. Circuit params touching ledger need disclose(): const d = disclose(param);

Compact is NOT TypeScript - don't guess syntax, use this reference!
Version: ${COMPACT_VERSION.min}-${COMPACT_VERSION.max} (updated: ${COMPACT_VERSION.lastUpdated}).`,
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
    syntaxFiles: reference.syntaxFiles.map((f) => {
      const result = smartTruncate(f.content, f.path);
      if (result.truncated) {
        logger.info("Syntax file truncated", {
          repository: `${resolved.owner}/${resolved.repo}`,
          path: f.path,
          version: reference.version,
          language: result.truncationInfo?.language,
          contentLength: f.content.length,
          truncationInfo: result.truncationInfo,
        });
      }
      return {
        path: f.path,
        content: result.content,
        truncated: result.truncated,
        ...(result.truncationInfo && { truncationInfo: result.truncationInfo }),
      };
    }),
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
export async function upgradeCheck(
  input: UpgradeCheckInput & { _meta?: { progressToken?: string | number } }
) {
  const repoName = input?.repo || "compact";
  const currentVersion = input.currentVersion;
  const progressToken = input._meta?.progressToken;

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

  // Send progress: Starting
  if (progressToken) {
    sendProgressNotification(progressToken, 1, 4, "Fetching version info...");
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

  // Send progress: Fetched version data
  if (progressToken) {
    sendProgressNotification(
      progressToken,
      2,
      4,
      "Checking breaking changes..."
    );
  }

  const latestVersion =
    versionInfo.latestStableRelease?.tag || versionInfo.latestRelease?.tag;

  // Only fetch migration guide if there are breaking changes
  let migrationGuide = null;
  if (breakingChanges.length > 0 && latestVersion) {
    // Send progress: Fetching migration guide
    if (progressToken) {
      sendProgressNotification(
        progressToken,
        3,
        4,
        "Generating migration guide..."
      );
    }

    migrationGuide = await releaseTracker.getMigrationGuide(
      resolved.owner,
      resolved.repo,
      currentVersion,
      latestVersion
    );
  }

  // Send progress: Complete
  if (progressToken) {
    sendProgressNotification(progressToken, 4, 4, "Analysis complete");
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
export async function getFullRepoContext(
  input: FullRepoContextInput & { _meta?: { progressToken?: string | number } }
) {
  const repoName = input?.repo || "compact";
  const progressToken = input._meta?.progressToken;

  logger.debug("Getting full repo context", { repo: repoName });

  const resolved = resolveRepo(repoName);
  if (!resolved) {
    throw new Error(
      `Unknown repository: ${repoName}. Available: ${Object.keys(REPO_ALIASES).join(", ")}`
    );
  }

  // Send progress: Starting
  if (progressToken) {
    sendProgressNotification(progressToken, 1, 4, "Fetching version info...");
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

  // Send progress: Fetched version
  if (progressToken) {
    sendProgressNotification(
      progressToken,
      2,
      4,
      "Loading syntax reference..."
    );
  }

  // Conditionally fetch syntax reference
  let syntaxRef = null;
  if (input.includeSyntax !== false) {
    syntaxRef = await releaseTracker.getLatestSyntaxReference(
      resolved.owner,
      resolved.repo
    );
  }

  // Send progress: Loading examples
  if (progressToken) {
    sendProgressNotification(progressToken, 3, 4, "Gathering examples...");
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

  // Send progress: Complete
  if (progressToken) {
    sendProgressNotification(progressToken, 4, 4, "Context ready");
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
