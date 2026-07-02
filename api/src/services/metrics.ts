/**
 * Metrics service for tracking query analytics
 */

import type { Metrics, QueryLog, ToolCall } from "../interfaces";

// Initialize default metrics
export function createDefaultMetrics(): Metrics {
  return {
    totalQueries: 0,
    queriesByEndpoint: {},
    queriesByLanguage: {},
    avgRelevanceScore: 0,
    scoreDistribution: { high: 0, medium: 0, low: 0 },
    recentQueries: [],
    documentsByRepo: {},
    lastUpdated: new Date().toISOString(),
    // Tool tracking
    totalToolCalls: 0,
    toolCallsByName: {},
    recentToolCalls: [],
  };
}

// In-memory metrics (reset on cold start, persisted to KV periodically)
let metrics: Metrics = createDefaultMetrics();

/**
 * Get current metrics state
 */
export function getMetrics(): Metrics {
  return metrics;
}

/**
 * Track a query for analytics
 */
export function trackQuery(
  query: string,
  endpoint: string,
  matches: VectorizeMatches["matches"],
  language?: string
): void {
  const scores = matches.map((m) => m.score);
  const avgScore =
    scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const topScore = scores.length > 0 ? Math.max(...scores) : 0;

  // Update totals
  metrics.totalQueries++;
  metrics.queriesByEndpoint[endpoint] =
    (metrics.queriesByEndpoint[endpoint] || 0) + 1;
  if (language) {
    metrics.queriesByLanguage[language] =
      (metrics.queriesByLanguage[language] || 0) + 1;
  }

  // Update score distribution (high >= 0.7, medium 0.4-0.7, low < 0.4)
  if (topScore >= 0.7) metrics.scoreDistribution.high++;
  else if (topScore >= 0.4) metrics.scoreDistribution.medium++;
  else metrics.scoreDistribution.low++;

  // Rolling average for relevance score
  metrics.avgRelevanceScore =
    (metrics.avgRelevanceScore * (metrics.totalQueries - 1) + avgScore) /
    metrics.totalQueries;

  // Track repos from results
  matches.forEach((m) => {
    const repo = m.metadata?.repository as string;
    if (repo) {
      metrics.documentsByRepo[repo] = (metrics.documentsByRepo[repo] || 0) + 1;
    }
  });

  // Keep last 100 queries.
  // NOTE: query text is intentionally NOT stored. Search queries can contain
  // proprietary contract source, and recentQueries is exposed publicly
  // (see routes/stats.ts and the dashboard). We retain only non-sensitive
  // analytics (endpoint, scores, counts) — never the query body.
  const logEntry: QueryLog = {
    query: "",
    endpoint,
    timestamp: new Date().toISOString(),
    resultsCount: matches.length,
    avgScore: Math.round(avgScore * 1000) / 1000,
    topScore: Math.round(topScore * 1000) / 1000,
    language,
  };
  metrics.recentQueries.unshift(logEntry);
  if (metrics.recentQueries.length > 100) {
    metrics.recentQueries = metrics.recentQueries.slice(0, 100);
  }

  metrics.lastUpdated = new Date().toISOString();
}

/**
 * Track a tool call from the MCP
 */
export function trackToolCall(
  tool: string,
  success: boolean,
  durationMs?: number,
  version?: string
): void {
  // Initialize if needed (for older metrics without tool tracking)
  if (!metrics.totalToolCalls) metrics.totalToolCalls = 0;
  if (!metrics.toolCallsByName) metrics.toolCallsByName = {};
  if (!metrics.recentToolCalls) metrics.recentToolCalls = [];

  metrics.totalToolCalls++;
  metrics.toolCallsByName[tool] = (metrics.toolCallsByName[tool] || 0) + 1;

  const logEntry: ToolCall = {
    tool,
    timestamp: new Date().toISOString(),
    success,
    durationMs,
    version,
  };
  metrics.recentToolCalls.unshift(logEntry);
  if (metrics.recentToolCalls.length > 100) {
    metrics.recentToolCalls = metrics.recentToolCalls.slice(0, 100);
  }

  metrics.lastUpdated = new Date().toISOString();
}

/**
 * Save metrics to KV (call periodically)
 */
export async function persistMetrics(
  kv: KVNamespace | undefined
): Promise<void> {
  if (!kv) return;
  try {
    await kv.put("metrics", JSON.stringify(metrics), {
      expirationTtl: 86400 * 30, // 30 days
    });
  } catch (e) {
    console.error("Failed to persist metrics:", e);
  }
}

/**
 * Load metrics from KV
 */
export async function loadMetrics(kv: KVNamespace | undefined): Promise<void> {
  if (!kv) return;
  try {
    const stored = await kv.get("metrics");
    if (stored) {
      const storedMetrics = JSON.parse(stored);
      // Merge stored metrics, preserving score distribution from persistent storage
      // Score distribution is tracked incrementally and should NOT be recalculated
      // from recentQueries (which only has last 100) as that would be inaccurate
      metrics = {
        ...metrics,
        ...storedMetrics,
      };
    }
  } catch (e) {
    console.error("Failed to load metrics:", e);
  }
}

/**
 * Recalculate score distribution and average relevance from recent queries.
 *
 * WARNING: This only uses the last 100 queries (recentQueries array).
 * Use this only for:
 * - Fixing corrupted data
 * - When you want metrics based on recent activity only
 * - NOT for normal operations (would make totalQueries and scoreDistribution inconsistent)
 *
 * The score distribution is normally tracked incrementally in trackQuery() and
 * should represent ALL queries, not just the recent 100.
 */
export function recalculateScoreDistributionFromRecent(): void {
  const distribution = { high: 0, medium: 0, low: 0 };
  let totalAvgScore = 0;

  for (const q of metrics.recentQueries) {
    if (q.topScore >= 0.7) distribution.high++;
    else if (q.topScore >= 0.4) distribution.medium++;
    else distribution.low++;

    totalAvgScore += q.avgScore;
  }

  if (metrics.recentQueries.length > 0) {
    metrics.scoreDistribution = distribution;
    metrics.avgRelevanceScore = totalAvgScore / metrics.recentQueries.length;
  }
}
