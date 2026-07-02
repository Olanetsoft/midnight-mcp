/**
 * Stats API routes
 */

import { Hono } from "hono";
import type { Bindings } from "../interfaces";
import { getMetrics, loadMetrics } from "../services";

const statsRoutes = new Hono<{ Bindings: Bindings }>();

// Stats endpoint (JSON API)
statsRoutes.get("/", async (c) => {
  await loadMetrics(c.env.METRICS);
  const metrics = getMetrics();

  return c.json({
    service: "midnight-mcp-api",
    environment: c.env.ENVIRONMENT,
    vectorize: "connected",
    metrics: {
      totalQueries: metrics.totalQueries,
      avgRelevanceScore: Math.round(metrics.avgRelevanceScore * 1000) / 1000,
      queriesByEndpoint: metrics.queriesByEndpoint,
      queriesByLanguage: metrics.queriesByLanguage,
      scoreDistribution: metrics.scoreDistribution,
      documentHitsByRepo: metrics.documentsByRepo,
      lastUpdated: metrics.lastUpdated,
    },
  });
});

// Recent queries endpoint
statsRoutes.get("/queries", async (c) => {
  await loadMetrics(c.env.METRICS);
  const metrics = getMetrics();

  // Strip query text before serving. recentQueries is public and
  // unauthenticated; query bodies can contain proprietary contract source.
  // (New entries store no query text — see services/metrics.ts — but this also
  // protects any entries captured before that change and still cached in KV.)
  const safeRecentQueries = metrics.recentQueries.map(
    ({ query: _query, ...rest }) => rest
  );

  return c.json({
    recentQueries: safeRecentQueries,
    total: metrics.totalQueries,
  });
});

export default statsRoutes;
