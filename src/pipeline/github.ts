import { Octokit } from "octokit";
import { config, logger, RepositoryConfig } from "../utils/index.js";

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
      const { data: repoData } = await this.octokit.rest.repos.get({
        owner,
        repo,
      });

      const { data: commits } = await this.octokit.rest.repos.listCommits({
        owner,
        repo,
        per_page: 1,
      });

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
      const { data } = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref,
      });

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
      const { data: refData } = await this.octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${ref || "main"}`,
      });

      const { data: treeData } = await this.octokit.rest.git.getTree({
        owner,
        repo,
        tree_sha: refData.object.sha,
        recursive: "true",
      });

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
}

export const githubClient = new GitHubClient();
