/**
 * Client for the hosted Midnight MCP API
 * Used when running in hosted mode (default)
 */

import { config, logger } from "./index.js";

const API_TIMEOUT = 15000; // 15 seconds (increased from 10s for reliability)
const MAX_RETRIES = 2; // Retry up to 2 times (3 total attempts)
const RETRY_DELAY_MS = 1000; // 1 second base delay

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Generate actionable error messages based on HTTP status codes
 * Provides users with specific guidance on how to resolve issues
 */
function getActionableErrorMessage(
  status: number,
  endpoint: string,
  serverMessage?: string
): string {
  const baseMessages: Record<number, string> = {
    400: `Bad request to ${endpoint}. Check your query parameters are valid.`,
    401: `Authentication failed. If you have an API key configured, verify it's correct.`,
    403: `Access denied to ${endpoint}. This resource may require authentication.`,
    404: `Resource not found at ${endpoint}. Use midnight-list-examples to see available resources.`,
    408: `Request timed out. The hosted service may be under heavy load - try again in a moment.`,
    429: `Rate limited. Try again in a few minutes, or set MIDNIGHT_LOCAL=true for unlimited local search (requires ChromaDB + OpenAI API key).`,
    500: `Server error. This is temporary - try again shortly or report at github.com/Olanetsoft/midnight-mcp/issues`,
    502: `Bad gateway. The hosted API may be restarting - try again in 30 seconds.`,
    503: `Service temporarily unavailable. The hosted API may be under maintenance - try again later or use MIDNIGHT_LOCAL=true for local mode.`,
    504: `Gateway timeout. The request took too long - try a simpler query or try again later.`,
  };

  const actionableMessage =
    baseMessages[status] ||
    `API error (${status}). Try again or report at github.com/Olanetsoft/midnight-mcp/issues`;

  // Include server message if available and different from our message
  if (serverMessage && !actionableMessage.includes(serverMessage)) {
    return `${actionableMessage} Server said: "${serverMessage}"`;
  }

  return actionableMessage;
}

/**
 * Parse error response from the hosted API
 */
async function parseApiError(
  response: Response,
  endpoint: string
): Promise<Error> {
  let serverMessage: string | undefined;

  try {
    const errorData = (await response.json()) as {
      error?: string;
      message?: string;
    };
    serverMessage = errorData.error || errorData.message;
  } catch {
    // JSON parsing failed, that's okay
  }

  const actionableMessage = getActionableErrorMessage(
    response.status,
    endpoint,
    serverMessage
  );

  return new Error(actionableMessage);
}

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
  lastIndexed?: string | null;
}

export interface HostedSearchFilter {
  language?: string;
  repository?: string;
}

/**
 * Check if an error is retryable (network issues, timeouts, server errors)
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      error.name === "AbortError" ||
      message.includes("timeout") ||
      message.includes("network") ||
      message.includes("econnreset") ||
      message.includes("502") ||
      message.includes("503") ||
      message.includes("504") ||
      message.includes("bad gateway") ||
      message.includes("service unavailable") ||
      message.includes("gateway timeout")
    );
  }
  return false;
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Make a single request attempt to the hosted API
 */
async function makeRequest<T>(
  url: string,
  endpoint: string,
  options: RequestInit
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "midnight-mcp",
        // Send bearer auth when the backend requires it (private/self-hosted
        // deployments that set MIDNIGHT_API_TOKEN).
        ...(config.hostedApiToken
          ? { Authorization: `Bearer ${config.hostedApiToken}` }
          : {}),
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw await parseApiError(response, endpoint);
    }

    return (await response.json()) as T;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `Request to ${endpoint} timed out after ${API_TIMEOUT / 1000}s.`,
        { cause: error }
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Make a request to the hosted API with automatic retry on transient failures
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${config.hostedApiUrl}${endpoint}`;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await makeRequest<T>(url, endpoint, options);
    } catch (error: unknown) {
      lastError = error as Error;

      // Don't retry non-retryable errors (4xx client errors, etc.)
      if (!isRetryableError(error)) {
        break;
      }

      // Don't retry if we've exhausted attempts
      if (attempt === MAX_RETRIES) {
        logger.warn(`Hosted API request failed after ${attempt + 1} attempts`, {
          endpoint,
          error: String(error),
        });
        break;
      }

      // Exponential backoff: 1s, 2s
      const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
      logger.debug(
        `Retrying hosted API request in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES + 1})`,
        { endpoint }
      );
      await sleep(delay);
    }
  }

  // Enhance the final error message
  if (lastError) {
    // Already processed errors from parseApiError
    if (lastError.message.includes("github.com/Olanetsoft")) {
      throw lastError;
    }

    // Timeout errors
    if (lastError.message.includes("timed out")) {
      throw new Error(
        `Request to ${endpoint} timed out after ${MAX_RETRIES + 1} attempts. ` +
          `The hosted service may be slow or unavailable. ` +
          `Try a simpler query or set MIDNIGHT_LOCAL=true for local search.`
      );
    }

    // Network errors
    throw new Error(
      `Failed to connect to hosted API after ${MAX_RETRIES + 1} attempts: ${lastError.message}. ` +
        `Check your internet connection or set MIDNIGHT_LOCAL=true for local search.`
    );
  }

  throw new Error("Unknown error in API request");
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
  } catch (error: unknown) {
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

/**
 * Track a tool call to the hosted API
 * Fire-and-forget - doesn't block on response
 */
export function trackToolCall(
  tool: string,
  success: boolean,
  durationMs?: number,
  version?: string
): void {
  // Fire and forget - don't await, don't block
  apiRequest("/v1/track/tool", {
    method: "POST",
    body: JSON.stringify({ tool, success, durationMs, version }),
  }).catch((error: unknown) => {
    logger.debug("Tracking call failed (non-blocking)", {
      error: String(error),
    });
  });
}
