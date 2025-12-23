import { z } from "zod";
import { vectorStore, SearchFilter } from "../db/index.js";
import {
  logger,
  validateQuery,
  validateNumber,
  searchCache,
  createCacheKey,
  isHostedMode,
  searchCompactHosted,
  searchTypeScriptHosted,
  searchDocsHosted,
} from "../utils/index.js";
import type {
  ExtendedToolDefinition,
  ToolAnnotations,
  OutputSchema,
} from "../types/index.js";

// ============================================================================
// Common Output Schema for Search Results
// ============================================================================

const searchResultSchema: OutputSchema = {
  type: "object",
  properties: {
    results: {
      type: "array",
      description: "Array of search results",
      items: {
        type: "object",
        properties: {
          code: { type: "string", description: "The matched code content" },
          relevanceScore: {
            type: "number",
            description: "Relevance score from 0 to 1",
          },
          source: {
            type: "object",
            description: "Source location information",
            properties: {
              repository: { type: "string", description: "Repository name" },
              filePath: { type: "string", description: "File path" },
              lines: {
                type: "string",
                description: "Line range (e.g., 10-50)",
              },
            },
          },
          codeType: {
            type: "string",
            description: "Type of code (compact, typescript, markdown)",
          },
          name: { type: "string", description: "Name of the code element" },
        },
      },
    },
    totalResults: {
      type: "number",
      description: "Total number of results returned",
    },
    query: { type: "string", description: "The search query used" },
    warnings: {
      type: "array",
      description: "Any warnings about the search",
      items: { type: "string" },
    },
  },
  required: ["results", "totalResults", "query"],
  description: "Search results with relevance scores and source information",
};

// Common annotations for search tools
const searchToolAnnotations: ToolAnnotations = {
  readOnlyHint: true,
  idempotentHint: true,
  openWorldHint: true,
  category: "search",
};

// ============================================================================
// Common Search Infrastructure
// ============================================================================

interface SearchContext {
  sanitizedQuery: string;
  limit: number;
  warnings: string[];
}

type SearchValidationResult =
  | {
      success: true;
      context: SearchContext;
    }
  | {
      success: false;
      error: {
        error: string;
        details: string[];
        suggestion: string;
      };
    };

/**
 * Validate and prepare common search parameters
 * Extracts common validation logic used by all search functions
 */
function validateSearchInput(
  query: string,
  limit: number | undefined
): SearchValidationResult {
  const queryValidation = validateQuery(query);
  if (!queryValidation.isValid) {
    return {
      success: false,
      error: {
        error: "Invalid query",
        details: queryValidation.errors,
        suggestion: "Provide a valid search query with at least 2 characters",
      },
    };
  }

  const limitValidation = validateNumber(limit, {
    min: 1,
    max: 50,
    defaultValue: 10,
  });

  return {
    success: true,
    context: {
      sanitizedQuery: queryValidation.sanitized,
      limit: limitValidation.value,
      warnings: queryValidation.warnings,
    },
  };
}

/**
 * Check cache for existing search results
 */
function checkSearchCache<T>(cacheKey: string): T | null {
  const cached = searchCache.get(cacheKey);
  if (cached) {
    logger.debug("Search cache hit", { cacheKey });
    return cached as T;
  }
  return null;
}

/**
 * Execute hosted search with fallback handling
 */
async function tryHostedSearch<T>(
  searchType: string,
  hostedSearchFn: () => Promise<T>,
  cacheKey: string,
  warnings: string[]
): Promise<{ result: T; cached: boolean } | null> {
  if (!isHostedMode()) {
    return null;
  }

  try {
    const response = await hostedSearchFn();
    searchCache.set(cacheKey, response);
    return {
      result: {
        ...response,
        ...(warnings.length > 0 && { warnings }),
      } as T,
      cached: true,
    };
  } catch (error) {
    logger.warn(
      `Hosted API ${searchType} search failed, falling back to local`,
      {
        error: String(error),
      }
    );
    return null;
  }
}

/**
 * Add warnings to response and cache it
 */
function finalizeResponse<T extends object>(
  response: T,
  cacheKey: string,
  warnings: string[]
): T {
  const finalResponse = {
    ...response,
    ...(warnings.length > 0 && { warnings }),
  };
  searchCache.set(cacheKey, finalResponse);
  return finalResponse;
}

// ============================================================================
// Schema Definitions
// ============================================================================

// Schema definitions for tool inputs
export const SearchCompactInputSchema = z.object({
  query: z.string().describe("Natural language search query for Compact code"),
  limit: z
    .number()
    .optional()
    .default(10)
    .describe("Maximum results to return"),
  filter: z
    .object({
      repository: z.string().optional(),
      isPublic: z.boolean().optional(),
    })
    .optional()
    .describe("Optional filters"),
});

export const SearchTypeScriptInputSchema = z.object({
  query: z.string().describe("Search query for TypeScript SDK code"),
  includeTypes: z
    .boolean()
    .optional()
    .default(true)
    .describe("Include type definitions"),
  includeExamples: z
    .boolean()
    .optional()
    .default(true)
    .describe("Include usage examples"),
  limit: z.number().optional().default(10),
});

export const SearchDocsInputSchema = z.object({
  query: z.string().describe("Documentation search query"),
  category: z
    .enum(["guides", "api", "concepts", "all"])
    .optional()
    .default("all")
    .describe("Filter by documentation category"),
  limit: z.number().optional().default(10),
});

export type SearchCompactInput = z.infer<typeof SearchCompactInputSchema>;
export type SearchTypeScriptInput = z.infer<typeof SearchTypeScriptInputSchema>;
export type SearchDocsInput = z.infer<typeof SearchDocsInputSchema>;

/**
 * Search Compact smart contract code and patterns
 */
export async function searchCompact(input: SearchCompactInput) {
  // Validate input using common helper
  const validation = validateSearchInput(input.query, input.limit);
  if (!validation.success) {
    return validation.error;
  }
  const { sanitizedQuery, limit, warnings } = validation.context;

  logger.debug("Searching Compact code", {
    query: sanitizedQuery,
    mode: isHostedMode() ? "hosted" : "local",
  });

  // Check cache first
  const cacheKey = createCacheKey(
    "compact",
    sanitizedQuery,
    limit,
    input.filter?.repository
  );
  const cached = checkSearchCache(cacheKey);
  if (cached) return cached;

  // Try hosted API first
  const hostedResult = await tryHostedSearch(
    "compact",
    () => searchCompactHosted(sanitizedQuery, limit),
    cacheKey,
    warnings
  );
  if (hostedResult) return hostedResult.result;

  // Local search (fallback or when in local mode)
  const filter: SearchFilter = {
    language: "compact",
    ...input.filter,
  };

  const results = await vectorStore.search(sanitizedQuery, limit, filter);

  const response = {
    results: results.map((r) => ({
      code: r.content,
      relevanceScore: r.score,
      source: {
        repository: r.metadata.repository,
        filePath: r.metadata.filePath,
        lines: `${r.metadata.startLine}-${r.metadata.endLine}`,
      },
      codeType: r.metadata.codeType,
      name: r.metadata.codeName,
    })),
    totalResults: results.length,
    query: sanitizedQuery,
  };

  return finalizeResponse(response, cacheKey, warnings);
}

/**
 * Search TypeScript SDK code, types, and API implementations
 */
export async function searchTypeScript(input: SearchTypeScriptInput) {
  // Validate input using common helper
  const validation = validateSearchInput(input.query, input.limit);
  if (!validation.success) {
    return validation.error;
  }
  const { sanitizedQuery, limit, warnings } = validation.context;

  logger.debug("Searching TypeScript code", {
    query: sanitizedQuery,
    mode: isHostedMode() ? "hosted" : "local",
  });

  // Check cache
  const cacheKey = createCacheKey(
    "typescript",
    sanitizedQuery,
    limit,
    input.includeTypes,
    input.includeExamples
  );
  const cached = checkSearchCache(cacheKey);
  if (cached) return cached;

  // Try hosted API first
  const hostedResult = await tryHostedSearch(
    "typescript",
    () => searchTypeScriptHosted(sanitizedQuery, limit, input.includeTypes),
    cacheKey,
    warnings
  );
  if (hostedResult) return hostedResult.result;

  // Local search (fallback or when in local mode)
  const filter: SearchFilter = {
    language: "typescript",
  };

  const results = await vectorStore.search(sanitizedQuery, limit, filter);

  // Filter based on type preferences
  let filteredResults = results;
  if (!input.includeTypes) {
    filteredResults = results.filter(
      (r) =>
        r.metadata.codeType !== "type" && r.metadata.codeType !== "interface"
    );
  }

  const response = {
    results: filteredResults.map((r) => ({
      code: r.content,
      relevanceScore: r.score,
      source: {
        repository: r.metadata.repository,
        filePath: r.metadata.filePath,
        lines: `${r.metadata.startLine}-${r.metadata.endLine}`,
      },
      codeType: r.metadata.codeType,
      name: r.metadata.codeName,
      isExported: r.metadata.isPublic,
    })),
    totalResults: filteredResults.length,
    query: sanitizedQuery,
  };

  return finalizeResponse(response, cacheKey, warnings);
}

/**
 * Full-text search across official Midnight documentation
 */
export async function searchDocs(input: SearchDocsInput) {
  // Validate input using common helper
  const validation = validateSearchInput(input.query, input.limit);
  if (!validation.success) {
    return validation.error;
  }
  const { sanitizedQuery, limit, warnings } = validation.context;

  logger.debug("Searching documentation", {
    query: sanitizedQuery,
    mode: isHostedMode() ? "hosted" : "local",
  });

  // Check cache
  const cacheKey = createCacheKey(
    "docs",
    sanitizedQuery,
    limit,
    input.category
  );
  const cached = checkSearchCache(cacheKey);
  if (cached) return cached;

  // Try hosted API first
  const hostedResult = await tryHostedSearch(
    "docs",
    () => searchDocsHosted(sanitizedQuery, limit, input.category),
    cacheKey,
    warnings
  );
  if (hostedResult) return hostedResult.result;

  // Local search (fallback or when in local mode)
  const filter: SearchFilter = {
    language: "markdown",
  };

  // If category is specified, add repository filter
  if (input.category !== "all") {
    // Docs are typically in the midnight-docs repo
    filter.repository = "midnightntwrk/midnight-docs";
  }

  const results = await vectorStore.search(sanitizedQuery, limit, filter);

  const response = {
    results: results.map((r) => ({
      content: r.content,
      relevanceScore: r.score,
      source: {
        repository: r.metadata.repository,
        filePath: r.metadata.filePath,
        section: r.metadata.codeName,
      },
    })),
    totalResults: results.length,
    query: sanitizedQuery,
    category: input.category,
  };

  return finalizeResponse(response, cacheKey, warnings);
}

// Tool definitions for MCP
export const searchTools: ExtendedToolDefinition[] = [
  {
    name: "midnight-search-compact",
    description:
      "Semantic search across Compact smart contract code and patterns. Use this to find circuit definitions, witness functions, ledger declarations, and best practices for Midnight smart contracts.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Natural language search query for Compact code",
        },
        limit: {
          type: "number",
          description: "Maximum results to return (default: 10)",
        },
        filter: {
          type: "object",
          properties: {
            repository: { type: "string" },
            isPublic: { type: "boolean" },
          },
          description: "Optional filters",
        },
      },
      required: ["query"],
    },
    outputSchema: searchResultSchema,
    annotations: {
      ...searchToolAnnotations,
      title: "Search Compact Contracts",
    },
    handler: searchCompact,
  },
  {
    name: "midnight-search-typescript",
    description:
      "Search TypeScript SDK code, types, and API implementations. Use this to find how to use the Midnight JavaScript SDK, type definitions, and integration patterns.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search query for TypeScript SDK code",
        },
        includeTypes: {
          type: "boolean",
          description: "Include type definitions (default: true)",
        },
        includeExamples: {
          type: "boolean",
          description: "Include usage examples (default: true)",
        },
        limit: {
          type: "number",
          description: "Maximum results to return (default: 10)",
        },
      },
      required: ["query"],
    },
    outputSchema: searchResultSchema,
    annotations: {
      ...searchToolAnnotations,
      title: "Search TypeScript SDK",
    },
    handler: searchTypeScript,
  },
  {
    name: "midnight-search-docs",
    description:
      "Full-text search across official Midnight documentation. Use this to find guides, API documentation, and conceptual explanations about Midnight blockchain and the Compact language.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Documentation search query",
        },
        category: {
          type: "string",
          enum: ["guides", "api", "concepts", "all"],
          description: "Filter by documentation category (default: all)",
        },
        limit: {
          type: "number",
          description: "Maximum results to return (default: 10)",
        },
      },
      required: ["query"],
    },
    outputSchema: searchResultSchema,
    annotations: {
      ...searchToolAnnotations,
      title: "Search Documentation",
    },
    handler: searchDocs,
  },
];
