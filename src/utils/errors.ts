/**
 * User-friendly error messages and error handling utilities
 */

export class MCPError extends Error {
  public readonly code: string;
  public readonly suggestion?: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    suggestion?: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "MCPError";
    this.code = code;
    this.suggestion = suggestion;
    this.details = details;
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      suggestion: this.suggestion,
      ...(this.details && { details: this.details }),
    };
  }
}

/**
 * Common error codes
 */
export const ErrorCodes = {
  RATE_LIMIT: "RATE_LIMIT_EXCEEDED",
  NOT_FOUND: "RESOURCE_NOT_FOUND",
  NETWORK: "NETWORK_ERROR",
  INVALID_INPUT: "INVALID_INPUT",
  UNKNOWN_REPO: "UNKNOWN_REPOSITORY",
  PARSE_ERROR: "PARSE_ERROR",
  CHROMADB_UNAVAILABLE: "CHROMADB_UNAVAILABLE",
  OPENAI_UNAVAILABLE: "OPENAI_UNAVAILABLE",
  MISSING_PARAM: "MISSING_PARAMETER",
  INVALID_VERSION: "INVALID_VERSION",
  SAMPLING_UNAVAILABLE: "SAMPLING_UNAVAILABLE",
} as const;

/**
 * LLM-friendly error hints that help the model self-correct
 * These are designed to give the AI enough context to retry with corrected input
 */
export const SelfCorrectionHints = {
  UNKNOWN_REPO: (repo: string, validRepos: string[]) => ({
    error: `Unknown repository: '${repo}'`,
    code: ErrorCodes.UNKNOWN_REPO,
    suggestion: `Try one of these instead: ${validRepos.slice(0, 8).join(", ")}`,
    correction: {
      invalidValue: repo,
      validValues: validRepos,
      parameterName: "repo",
    },
  }),

  INVALID_VERSION: (version: string, example: string) => ({
    error: `Invalid version format: '${version}'`,
    code: ErrorCodes.INVALID_VERSION,
    suggestion: `Version should be like '${example}'. Check available versions with midnight-get-version-info first.`,
    correction: {
      invalidValue: version,
      expectedFormat: "v1.0.0 or 0.14.0",
      example,
    },
  }),

  MISSING_REQUIRED_PARAM: (paramName: string, toolName: string) => ({
    error: `Missing required parameter: '${paramName}'`,
    code: ErrorCodes.MISSING_PARAM,
    suggestion: `The '${paramName}' parameter is required for ${toolName}. Please provide it.`,
    correction: {
      missingParameter: paramName,
      tool: toolName,
    },
  }),

  FILE_NOT_FOUND: (path: string, repo: string, similarPaths?: string[]) => ({
    error: `File not found: '${path}' in ${repo}`,
    code: ErrorCodes.NOT_FOUND,
    suggestion: similarPaths?.length
      ? `Did you mean: ${similarPaths.join(", ")}?`
      : `Check the file path. Use midnight-get-file with a different path or list directory contents first.`,
    correction: {
      invalidPath: path,
      ...(similarPaths && { suggestions: similarPaths }),
    },
  }),

  SAMPLING_NOT_AVAILABLE: (toolName: string) => ({
    error: `Sampling capability not available`,
    code: ErrorCodes.SAMPLING_UNAVAILABLE,
    suggestion: `${toolName} requires a client that supports sampling (e.g., Claude Desktop). Use a non-AI alternative or switch clients.`,
    alternatives: {
      "midnight-generate-contract":
        "Use midnight-search-compact to find similar contracts as templates",
      "midnight-review-contract":
        "Use midnight-analyze-contract for static analysis",
      "midnight-document-contract": "Manual documentation or inline comments",
    },
  }),

  RATE_LIMIT: (retryAfter?: number) => ({
    error: "GitHub API rate limit exceeded",
    code: ErrorCodes.RATE_LIMIT,
    suggestion: retryAfter
      ? `Wait ${retryAfter} seconds before retrying. Or add GITHUB_TOKEN for higher limits.`
      : "Add GITHUB_TOKEN to increase from 60 to 5000 requests/hour.",
    correction: {
      action: "wait_and_retry",
      ...(retryAfter && { retryAfterSeconds: retryAfter }),
    },
  }),
};

/**
 * Create user-friendly error from various error types
 */
export function createUserError(error: unknown, context?: string): MCPError {
  const message = error instanceof Error ? error.message : String(error);
  const ctx = context ? ` while ${context}` : "";

  // Rate limit errors
  if (
    message.includes("rate limit") ||
    message.includes("403") ||
    message.includes("API rate limit")
  ) {
    return new MCPError(
      `GitHub API rate limit exceeded${ctx}`,
      ErrorCodes.RATE_LIMIT,
      "Add GITHUB_TOKEN to your config to increase limits from 60 to 5000 requests/hour. " +
        "Get a token at https://github.com/settings/tokens"
    );
  }

  // Not found errors
  if (message.includes("404") || message.includes("Not Found")) {
    return new MCPError(
      `Resource not found${ctx}`,
      ErrorCodes.NOT_FOUND,
      "Check that the repository, file, or version exists and is publicly accessible."
    );
  }

  // Network errors
  if (
    message.includes("network") ||
    message.includes("ECONNREFUSED") ||
    message.includes("ETIMEDOUT") ||
    message.includes("timeout")
  ) {
    return new MCPError(
      `Network error${ctx}`,
      ErrorCodes.NETWORK,
      "Check your internet connection and try again. If the problem persists, " +
        "the service may be temporarily unavailable."
    );
  }

  // ChromaDB errors
  if (message.includes("chroma") || message.includes("8000")) {
    return new MCPError(
      `ChromaDB is not available${ctx}`,
      ErrorCodes.CHROMADB_UNAVAILABLE,
      "ChromaDB is optional. Without it, search uses keyword matching instead of semantic search. " +
        "To enable semantic search, run: docker run -d -p 8000:8000 chromadb/chroma"
    );
  }

  // OpenAI errors
  if (message.includes("openai") || message.includes("embedding")) {
    return new MCPError(
      `OpenAI API error${ctx}`,
      ErrorCodes.OPENAI_UNAVAILABLE,
      "OpenAI is optional. Without it, search uses keyword matching. " +
        "To enable semantic search, add OPENAI_API_KEY to your config."
    );
  }

  // Default error - don't leak internal details
  return new MCPError(
    `An error occurred${ctx}`,
    "UNKNOWN_ERROR",
    "If this problem persists, please report it at https://github.com/Olanetsoft/midnight-mcp/issues"
  );
}

/**
 * Format error for MCP response
 */
export function formatErrorResponse(
  error: unknown,
  context?: string
): {
  error: string;
  code: string;
  suggestion?: string;
} {
  const mcpError =
    error instanceof MCPError ? error : createUserError(error, context);
  return mcpError.toJSON();
}

/**
 * Wrap a function with error handling
 */
export function withErrorHandling<
  T extends (...args: unknown[]) => Promise<unknown>,
>(fn: T, context: string): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      throw createUserError(error, context);
    }
  }) as T;
}
