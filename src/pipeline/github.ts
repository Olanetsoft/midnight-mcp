import { Octokit } from "octokit";
import {
  config,
  logger,
  RepositoryConfig,
  updateRateLimit,
  shouldProceedWithRequest,
  getRateLimitStatus,
} from "../utils/index.js";

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
};

/**
 * Retry wrapper with exponential backoff
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      const isRetryable = isRetryableError(error);

      if (!isRetryable || attempt === RETRY_CONFIG.maxRetries) {
        logger.error(`${operationName} failed after ${attempt} attempt(s)`, {
          error: String(error),
          attempt,
        });
        throw enhanceError(error, operationName);
      }

      const delay = Math.min(
        RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt - 1),
        RETRY_CONFIG.maxDelayMs
      );

      logger.warn(`${operationName} failed, retrying in ${delay}ms...`, {
        attempt,
        error: String(error),
      });

      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Check if an error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // Retry on network errors, rate limits, and server errors
    return (
      message.includes("network") ||
      message.includes("timeout") ||
      message.includes("econnreset") ||
      message.includes("rate limit") ||
      message.includes("403") ||
      message.includes("500") ||
      message.includes("502") ||
      message.includes("503") ||
      message.includes("504")
    );
  }
  return false;
}

/**
 * Enhance error with more context
 */
function enhanceError(error: unknown, operation: string): Error {
  const originalMessage =
    error instanceof Error ? error.message : String(error);

  // Provide user-friendly error messages
  if (
    originalMessage.includes("rate limit") ||
    originalMessage.includes("403")
  ) {
    return new Error(
      `GitHub API rate limit exceeded during ${operation}. ` +
        `Add a GITHUB_TOKEN to your config to increase limits from 60 to 5000 requests/hour.`
    );
  }

  if (originalMessage.includes("404")) {
    return new Error(
      `Resource not found during ${operation}. ` +
        `Check that the repository/file exists and is accessible.`
    );
  }

  if (
    originalMessage.includes("timeout") ||
    originalMessage.includes("network")
  ) {
    return new Error(
      `Network error during ${operation}. ` +
        `Check your internet connection and try again.`
    );
  }

  return new Error(`${operation} failed: ${originalMessage}`);
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Simple in-memory cache with TTL
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class SimpleCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private ttlMs: number;

  constructor(ttlMinutes: number = 10) {
    this.ttlMs = ttlMinutes * 60 * 1000;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  set(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }
}

export interface GitHubFile {
  path: string;
  content: string;
  sha: string;
  size: number;
  encoding: string;
}

export interface GitHubCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}

export interface RepositoryInfo {
  owner: string;
  repo: string;
  branch: string;
  lastCommit: GitHubCommit | null;
  fileCount: number;
}

export class GitHubClient {
  private octokit: Octokit;
  private fileCache = new SimpleCache<GitHubFile>(15); // 15 min cache for files
  private treeCache = new SimpleCache<string[]>(10); // 10 min cache for trees
  private repoInfoCache = new SimpleCache<RepositoryInfo>(10); // 10 min cache for repo info

  constructor(token?: string) {
    this.octokit = new Octokit({
      auth: token || config.githubToken,
      request: {
        timeout: 10000, // 10 second timeout for API calls
      },
    });
  }

  /**
   * Get repository information
   */
  async getRepositoryInfo(
    owner: string,
    repo: string
  ): Promise<RepositoryInfo> {
    const cacheKey = `repo:${owner}/${repo}`;
    const cached = this.repoInfoCache.get(cacheKey);
    if (cached) {
      logger.debug(`Cache hit for repo info: ${cacheKey}`);
      return cached;
    }

    try {
      const { data: repoData } = await withRetry(
        () => this.octokit.rest.repos.get({ owner, repo }),
        `getRepositoryInfo(${owner}/${repo})`
      );

      const { data: commits } = await withRetry(
        () => this.octokit.rest.repos.listCommits({ owner, repo, per_page: 1 }),
        `getCommits(${owner}/${repo})`
      );

      const lastCommit = commits[0]
        ? {
            sha: commits[0].sha,
            message: commits[0].commit.message,
            author: commits[0].commit.author?.name || "Unknown",
            date: commits[0].commit.author?.date || "",
            url: commits[0].html_url,
          }
        : null;

      const result = {
        owner,
        repo,
        branch: repoData.default_branch,
        lastCommit,
        fileCount: 0, // Will be updated during tree fetch
      };

      this.repoInfoCache.set(cacheKey, result);
      return result;
    } catch (error) {
      logger.error(`Failed to get repository info for ${owner}/${repo}`, {
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Get file content from a repository
   */
  async getFileContent(
    owner: string,
    repo: string,
    path: string,
    ref?: string
  ): Promise<GitHubFile | null> {
    const cacheKey = `file:${owner}/${repo}/${path}@${ref || "main"}`;
    const cached = this.fileCache.get(cacheKey);
    if (cached) {
      logger.debug(`Cache hit for file: ${cacheKey}`);
      return cached;
    }

    try {
      const { data } = await withRetry(
        () => this.octokit.rest.repos.getContent({ owner, repo, path, ref }),
        `getFileContent(${owner}/${repo}/${path})`
      );

      if (Array.isArray(data) || data.type !== "file") {
        return null;
      }

      const content =
        data.encoding === "base64"
          ? Buffer.from(data.content, "base64").toString("utf-8")
          : data.content;

      const result = {
        path: data.path,
        content,
        sha: data.sha,
        size: data.size,
        encoding: data.encoding,
      };

      this.fileCache.set(cacheKey, result);
      return result;
    } catch (error) {
      logger.warn(`Failed to get file ${path} from ${owner}/${repo}`, {
        error: String(error),
      });
      return null;
    }
  }

  /**
   * Get repository tree (list of all files)
   */
  async getRepositoryTree(
    owner: string,
    repo: string,
    ref?: string
  ): Promise<string[]> {
    const cacheKey = `tree:${owner}/${repo}@${ref || "main"}`;
    const cached = this.treeCache.get(cacheKey);
    if (cached) {
      logger.debug(`Cache hit for tree: ${cacheKey}`);
      return cached;
    }

    try {
      const { data: refData } = await withRetry(
        () =>
          this.octokit.rest.git.getRef({
            owner,
            repo,
            ref: `heads/${ref || "main"}`,
          }),
        `getRef(${owner}/${repo})`
      );

      const { data: treeData } = await withRetry(
        () =>
          this.octokit.rest.git.getTree({
            owner,
            repo,
            tree_sha: refData.object.sha,
            recursive: "true",
          }),
        `getTree(${owner}/${repo})`
      );

      const result = treeData.tree
        .filter((item) => item.type === "blob" && item.path)
        .map((item) => item.path as string);

      this.treeCache.set(cacheKey, result);
      return result;
    } catch (error) {
      logger.error(`Failed to get repository tree for ${owner}/${repo}`, {
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Filter files by patterns
   */
  filterFilesByPatterns(
    files: string[],
    patterns: string[],
    exclude: string[]
  ): string[] {
    const matchPattern = (file: string, pattern: string): boolean => {
      // Convert glob pattern to regex
      const regexPattern = pattern
        .replace(/\*\*/g, ".*")
        .replace(/\*/g, "[^/]*")
        .replace(/\./g, "\\.");
      return new RegExp(`^${regexPattern}$`).test(file);
    };

    return files.filter((file) => {
      const matchesInclude = patterns.some((p) => matchPattern(file, p));
      const matchesExclude = exclude.some((p) => matchPattern(file, p));
      return matchesInclude && !matchesExclude;
    });
  }

  /**
   * Fetch all files from a repository matching patterns
   */
  async fetchRepositoryFiles(
    repoConfig: RepositoryConfig
  ): Promise<GitHubFile[]> {
    const { owner, repo, branch, patterns, exclude } = repoConfig;
    logger.info(`Fetching files from ${owner}/${repo}...`);

    const allFiles = await this.getRepositoryTree(owner, repo, branch);
    const filteredFiles = this.filterFilesByPatterns(
      allFiles,
      patterns,
      exclude
    );

    logger.info(
      `Found ${filteredFiles.length} matching files in ${owner}/${repo}`
    );

    const files: GitHubFile[] = [];
    for (const filePath of filteredFiles) {
      const file = await this.getFileContent(owner, repo, filePath, branch);
      if (file) {
        files.push(file);
      }
    }

    return files;
  }

  /**
   * Get recent commits
   */
  async getRecentCommits(
    owner: string,
    repo: string,
    since?: string,
    perPage = 30
  ): Promise<GitHubCommit[]> {
    try {
      const params: Parameters<typeof this.octokit.rest.repos.listCommits>[0] =
        {
          owner,
          repo,
          per_page: perPage,
        };

      if (since) {
        params.since = since;
      }

      const { data } = await this.octokit.rest.repos.listCommits(params);

      return data.map((commit) => ({
        sha: commit.sha,
        message: commit.commit.message,
        author: commit.commit.author?.name || "Unknown",
        date: commit.commit.author?.date || "",
        url: commit.html_url,
      }));
    } catch (error) {
      logger.error(`Failed to get commits for ${owner}/${repo}`, {
        error: String(error),
      });
      return [];
    }
  }

  /**
   * Get files changed in recent commits
   */
  async getChangedFiles(
    owner: string,
    repo: string,
    since: string
  ): Promise<string[]> {
    try {
      const commits = await this.getRecentCommits(owner, repo, since);
      const changedFiles = new Set<string>();

      for (const commit of commits) {
        const { data } = await this.octokit.rest.repos.getCommit({
          owner,
          repo,
          ref: commit.sha,
        });

        data.files?.forEach((file) => {
          if (file.filename) {
            changedFiles.add(file.filename);
          }
        });
      }

      return Array.from(changedFiles);
    } catch (error) {
      logger.error(`Failed to get changed files for ${owner}/${repo}`, {
        error: String(error),
      });
      return [];
    }
  }

  /**
   * Search code in repositories
   */
  async searchCode(
    query: string,
    owner?: string,
    repo?: string,
    language?: string
  ): Promise<Array<{ path: string; repository: string; url: string }>> {
    try {
      let q = query;
      if (owner && repo) {
        q += ` repo:${owner}/${repo}`;
      } else if (owner) {
        q += ` user:${owner}`;
      }
      if (language) {
        q += ` language:${language}`;
      }

      const { data } = await this.octokit.rest.search.code({
        q,
        per_page: 30,
      });

      return data.items.map((item) => ({
        path: item.path,
        repository: item.repository.full_name,
        url: item.html_url,
      }));
    } catch (error) {
      logger.warn(`Code search failed for query: ${query}`, {
        error: String(error),
      });
      return [];
    }
  }

  /**
   * Get current rate limit status from GitHub API
   */
  async getRateLimit(): Promise<{
    limit: number;
    remaining: number;
    reset: Date;
    used: number;
  }> {
    try {
      const { data } = await this.octokit.rest.rateLimit.get();

      const rateLimit = {
        limit: data.rate.limit,
        remaining: data.rate.remaining,
        reset: new Date(data.rate.reset * 1000),
        used: data.rate.used,
      };

      // Update the global rate limit tracker
      updateRateLimit(rateLimit);

      return rateLimit;
    } catch (error) {
      logger.warn("Failed to get rate limit", { error: String(error) });
      // Return defaults if we can't get rate limit
      return {
        limit: 60,
        remaining: 60,
        reset: new Date(Date.now() + 3600000),
        used: 0,
      };
    }
  }

  /**
   * Check if it's safe to make API requests
   */
  checkRateLimit(): {
    proceed: boolean;
    reason?: string;
    status: ReturnType<typeof getRateLimitStatus>;
  } {
    const check = shouldProceedWithRequest();
    const status = getRateLimitStatus();

    if (!check.proceed) {
      logger.warn("Rate limit check failed", { reason: check.reason });
    }

    return {
      proceed: check.proceed,
      reason: check.reason,
      status,
    };
  }
}

export const githubClient = new GitHubClient();
