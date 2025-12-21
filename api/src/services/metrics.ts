/**
 * Metrics service for tracking query analytics
 */

import type { Metrics, QueryLog } from "../interfaces";

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

  // Update score distribution (high > 0.8, medium 0.5-0.8, low < 0.5)
  if (topScore > 0.8) metrics.scoreDistribution.high++;
  else if (topScore >= 0.5) metrics.scoreDistribution.medium++;
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

  // Keep last 100 queries
  const logEntry: QueryLog = {
    query: query.slice(0, 100), // Truncate for storage
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
      metrics = { ...metrics, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error("Failed to load metrics:", e);
  }
}
