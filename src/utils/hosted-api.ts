/**
 * Client for the hosted Midnight MCP API
 * Used when running in hosted mode (default)
 */

import { config, logger } from "./index.js";

const API_TIMEOUT = 10000; // 10 seconds

export interface HostedSearchResult {
  code?: string;
  content?: string;
  relevanceScore: number;
  source: {
    repository: string;
    filePath: string;
    lines?: string;
    section?: string;
  };
  codeType?: string;
  name?: string;
  isExported?: boolean;
}

export interface HostedSearchResponse {
  results: HostedSearchResult[];
  totalResults: number;
  query: string;
  category?: string;
  warnings?: string[];
}

export interface HostedSearchFilter {
  language?: string;
  repository?: string;
}

/**
 * Make a request to the hosted API
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${config.hostedApiUrl}${endpoint}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "midnight-mcp",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = (await response
        .json()
        .catch(() => ({ error: "Unknown error" }))) as { error?: string };
      throw new Error(errorData.error || `API error: ${response.status}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        "API request timed out. The hosted service may be unavailable."
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Search Compact code via hosted API
 */
export async function searchCompactHosted(
  query: string,
  limit: number = 10
): Promise<HostedSearchResponse> {
  logger.debug("Searching Compact code via hosted API", { query });

  return apiRequest<HostedSearchResponse>("/v1/search/compact", {
    method: "POST",
    body: JSON.stringify({ query, limit }),
  });
}

/**
 * Search TypeScript code via hosted API
 */
export async function searchTypeScriptHosted(
  query: string,
  limit: number = 10,
  includeTypes: boolean = true
): Promise<HostedSearchResponse> {
  logger.debug("Searching TypeScript code via hosted API", { query });

  return apiRequest<HostedSearchResponse>("/v1/search/typescript", {
    method: "POST",
    body: JSON.stringify({ query, limit, includeTypes }),
  });
}

/**
 * Search documentation via hosted API
 */
export async function searchDocsHosted(
  query: string,
  limit: number = 10,
  category: string = "all"
): Promise<HostedSearchResponse> {
  logger.debug("Searching documentation via hosted API", { query });

  return apiRequest<HostedSearchResponse>("/v1/search/docs", {
    method: "POST",
    body: JSON.stringify({ query, limit, category }),
  });
}

/**
 * Generic search via hosted API
 */
export async function searchHosted(
  query: string,
  limit: number = 10,
  filter?: HostedSearchFilter
): Promise<HostedSearchResponse> {
  logger.debug("Searching via hosted API", { query, filter });

  return apiRequest<HostedSearchResponse>("/v1/search", {
    method: "POST",
    body: JSON.stringify({ query, limit, filter }),
  });
}

/**
 * Check if the hosted API is available
 */
export async function checkHostedApiHealth(): Promise<{
  available: boolean;
  documentsIndexed?: number;
  error?: string;
}> {
  try {
    const response = await apiRequest<{
      status: string;
      vectorStore?: { documentsIndexed: number };
    }>("/health");

    return {
      available: response.status === "healthy",
      documentsIndexed: response.vectorStore?.documentsIndexed,
    };
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get hosted API stats
 */
export async function getHostedApiStats(): Promise<{
  documentsIndexed: number;
  repositories: number;
}> {
  return apiRequest<{ documentsIndexed: number; repositories: number }>(
    "/v1/stats"
  );
}
