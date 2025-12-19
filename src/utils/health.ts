/**
 * Health check utilities for MCP server monitoring
 */

import { githubClient } from "../pipeline/index.js";

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    name: string;
    status: "pass" | "warn" | "fail";
    message?: string;
    latency?: number;
  }[];
}

// Track server start time
const startTime = Date.now();

// Get package version
const VERSION = process.env.npm_package_version || "0.0.3";

/**
 * Check if GitHub API is accessible
 */
async function checkGitHubAPI(): Promise<{
  status: "pass" | "warn" | "fail";
  message?: string;
  latency?: number;
}> {
  const start = Date.now();

  try {
    // Try to get rate limit info (lightweight API call)
    const rateLimit = await githubClient.getRateLimit();
    const latency = Date.now() - start;

    if (rateLimit.remaining < 100) {
      return {
        status: "warn",
        message: `Rate limit low: ${rateLimit.remaining}/${rateLimit.limit} remaining`,
        latency,
      };
    }

    return {
      status: "pass",
      message: `Rate limit: ${rateLimit.remaining}/${rateLimit.limit}`,
      latency,
    };
  } catch (error) {
    return {
      status: "fail",
      message: `GitHub API error: ${error instanceof Error ? error.message : String(error)}`,
      latency: Date.now() - start,
    };
  }
}

/**
 * Check if ChromaDB is accessible (optional dependency)
 */
async function checkVectorStore(): Promise<{
  status: "pass" | "warn" | "fail";
  message?: string;
}> {
  try {
    // Import dynamically to handle optional dependency
    const { vectorStore } = await import("../db/index.js");

    // Check if vector store is initialized
    if (vectorStore) {
      return {
        status: "pass",
        message: "Vector store available",
      };
    }

    return {
      status: "warn",
      message: "Vector store not initialized (semantic search unavailable)",
    };
  } catch {
    return {
      status: "warn",
      message: "Vector store not configured (semantic search unavailable)",
    };
  }
}

/**
 * Check memory usage
 */
function checkMemory(): { status: "pass" | "warn" | "fail"; message: string } {
  const usage = process.memoryUsage();
  const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
  const percentUsed = Math.round((usage.heapUsed / usage.heapTotal) * 100);

  if (percentUsed > 90) {
    return {
      status: "fail",
      message: `High memory usage: ${heapUsedMB}MB/${heapTotalMB}MB (${percentUsed}%)`,
    };
  }

  if (percentUsed > 75) {
    return {
      status: "warn",
      message: `Elevated memory usage: ${heapUsedMB}MB/${heapTotalMB}MB (${percentUsed}%)`,
    };
  }

  return {
    status: "pass",
    message: `Memory: ${heapUsedMB}MB/${heapTotalMB}MB (${percentUsed}%)`,
  };
}

/**
 * Perform a full health check
 */
export async function getHealthStatus(): Promise<HealthStatus> {
  const checks: HealthStatus["checks"] = [];

  // Run all health checks in parallel
  const [githubCheck, vectorCheck] = await Promise.all([
    checkGitHubAPI(),
    checkVectorStore(),
  ]);

  const memoryCheck = checkMemory();

  checks.push(
    { name: "github_api", ...githubCheck },
    { name: "vector_store", ...vectorCheck },
    { name: "memory", ...memoryCheck }
  );

  // Determine overall status
  const hasFailure = checks.some((c) => c.status === "fail");
  const hasWarning = checks.some((c) => c.status === "warn");

  let status: HealthStatus["status"] = "healthy";
  if (hasFailure) {
    status = "unhealthy";
  } else if (hasWarning) {
    status = "degraded";
  }

  return {
    status,
    timestamp: new Date().toISOString(),
    version: VERSION,
    uptime: Math.round((Date.now() - startTime) / 1000),
    checks,
  };
}

/**
 * Get a quick health check (no external calls)
 */
export function getQuickHealthStatus(): Omit<HealthStatus, "checks"> & {
  checks: { name: string; status: "pass" }[];
} {
  return {
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: VERSION,
    uptime: Math.round((Date.now() - startTime) / 1000),
    checks: [{ name: "server", status: "pass" as const }],
  };
}
