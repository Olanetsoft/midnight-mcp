/**
 * Health check and diagnostic tools for MCP server
 */

import { z } from "zod";
import {
  getHealthStatus,
  getQuickHealthStatus,
  getRateLimitStatus,
  formatRateLimitStatus,
} from "../utils/index.js";
import { searchCache, fileCache, metadataCache } from "../utils/cache.js";

// Schema definitions
export const HealthCheckInputSchema = z.object({
  detailed: z
    .boolean()
    .optional()
    .default(false)
    .describe("Include detailed checks (slower but more comprehensive)"),
});

export const GetStatusInputSchema = z.object({});

export type HealthCheckInput = z.infer<typeof HealthCheckInputSchema>;
export type GetStatusInput = z.infer<typeof GetStatusInputSchema>;

/**
 * Perform health check on the MCP server
 */
export async function healthCheck(input: HealthCheckInput) {
  if (input.detailed) {
    const status = await getHealthStatus();
    return {
      ...status,
      rateLimit: formatRateLimitStatus(),
      cacheStats: {
        search: searchCache.getStats(),
        file: fileCache.getStats(),
        metadata: metadataCache.getStats(),
      },
    };
  }

  return {
    ...getQuickHealthStatus(),
    rateLimit: formatRateLimitStatus(),
  };
}

/**
 * Get current server status and statistics
 */
export async function getStatus(_input: GetStatusInput) {
  const rateLimitStatus = getRateLimitStatus();

  return {
    server: "midnight-mcp",
    status: "running",
    timestamp: new Date().toISOString(),
    rateLimit: {
      remaining: rateLimitStatus.remaining,
      limit: rateLimitStatus.limit,
      percentUsed: rateLimitStatus.percentUsed,
      status: rateLimitStatus.isLimited
        ? "limited"
        : rateLimitStatus.isWarning
          ? "warning"
          : "ok",
      message: rateLimitStatus.message,
    },
    cache: {
      search: searchCache.getStats(),
      file: fileCache.getStats(),
      metadata: metadataCache.getStats(),
    },
  };
}

// Tool definitions for MCP server
export const healthTools = [
  {
    name: "midnight-health-check",
    description:
      "Check the health status of the Midnight MCP server. Returns server status, API connectivity, and resource availability.",
    inputSchema: {
      type: "object" as const,
      properties: {
        detailed: {
          type: "boolean",
          description:
            "Include detailed checks including GitHub API and vector store status (slower)",
          default: false,
        },
      },
    },
    handler: healthCheck,
  },
  {
    name: "midnight-get-status",
    description:
      "Get current server status including rate limits and cache statistics. Quick status check without external API calls.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
    handler: getStatus,
  },
];
