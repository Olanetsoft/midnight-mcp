import { z } from "zod";
import { vectorStore, SearchFilter } from "../db/index.js";
import {
  logger,
  validateQuery,
  validateNumber,
  searchCache,
  createCacheKey,
} from "../utils/index.js";

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
  // Validate input
  const queryValidation = validateQuery(input.query);
  if (!queryValidation.isValid) {
    return {
      error: "Invalid query",
      details: queryValidation.errors,
      suggestion: "Provide a valid search query with at least 2 characters",
    };
  }

  const limitValidation = validateNumber(input.limit, {
    min: 1,
    max: 50,
    defaultValue: 10,
  });
  const sanitizedQuery = queryValidation.sanitized;
  const limit = limitValidation.value;

  logger.debug("Searching Compact code", {
    query: sanitizedQuery,
    originalQuery: input.query,
  });

  // Check cache first
  const cacheKey = createCacheKey(
    "compact",
    sanitizedQuery,
    limit,
    input.filter?.repository
  );
  const cached = searchCache.get(cacheKey);
  if (cached) {
    logger.debug("Search cache hit", { cacheKey });
    return cached;
  }

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
    ...(queryValidation.warnings.length > 0 && {
      warnings: queryValidation.warnings,
    }),
  };

  // Cache the response
  searchCache.set(cacheKey, response);

  return response;
}

/**
 * Search TypeScript SDK code, types, and API implementations
 */
export async function searchTypeScript(input: SearchTypeScriptInput) {
  // Validate input
  const queryValidation = validateQuery(input.query);
  if (!queryValidation.isValid) {
    return {
      error: "Invalid query",
      details: queryValidation.errors,
      suggestion: "Provide a valid search query with at least 2 characters",
    };
  }

  const limitValidation = validateNumber(input.limit, {
    min: 1,
    max: 50,
    defaultValue: 10,
  });
  const sanitizedQuery = queryValidation.sanitized;
  const limit = limitValidation.value;

  logger.debug("Searching TypeScript code", { query: sanitizedQuery });

  // Check cache
  const cacheKey = createCacheKey(
    "typescript",
    sanitizedQuery,
    limit,
    input.includeTypes,
    input.includeExamples
  );
  const cached = searchCache.get(cacheKey);
  if (cached) {
    logger.debug("Search cache hit", { cacheKey });
    return cached;
  }

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
    ...(queryValidation.warnings.length > 0 && {
      warnings: queryValidation.warnings,
    }),
  };

  searchCache.set(cacheKey, response);
  return response;
}

/**
 * Full-text search across official Midnight documentation
 */
export async function searchDocs(input: SearchDocsInput) {
  // Validate input
  const queryValidation = validateQuery(input.query);
  if (!queryValidation.isValid) {
    return {
      error: "Invalid query",
      details: queryValidation.errors,
      suggestion: "Provide a valid search query with at least 2 characters",
    };
  }

  const limitValidation = validateNumber(input.limit, {
    min: 1,
    max: 50,
    defaultValue: 10,
  });
  const sanitizedQuery = queryValidation.sanitized;
  const limit = limitValidation.value;

  logger.debug("Searching documentation", { query: sanitizedQuery });

  // Check cache
  const cacheKey = createCacheKey(
    "docs",
    sanitizedQuery,
    limit,
    input.category
  );
  const cached = searchCache.get(cacheKey);
  if (cached) {
    logger.debug("Search cache hit", { cacheKey });
    return cached;
  }

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
    ...(queryValidation.warnings.length > 0 && {
      warnings: queryValidation.warnings,
    }),
  };

  searchCache.set(cacheKey, response);
  return response;
}

// Tool definitions for MCP
export const searchTools = [
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
    handler: searchDocs,
  },
];
