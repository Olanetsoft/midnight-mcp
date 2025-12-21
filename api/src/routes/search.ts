/**
 * Search API routes
 */

import { Hono } from "hono";
import type { Bindings, SearchRequestBody } from "../interfaces";
import {
  getEmbedding,
  trackQuery,
  persistMetrics,
  loadMetrics,
} from "../services";
import {
  validateQuery,
  validateLimit,
  formatResults,
  applyKeywordBoost,
} from "../utils";

const searchRoutes = new Hono<{ Bindings: Bindings }>();

// General search endpoint
searchRoutes.post("/", async (c) => {
  try {
    await loadMetrics(c.env.METRICS);

    const body = await c.req.json<SearchRequestBody>();

    const query = validateQuery(body.query);
    if (!query) {
      return c.json({ error: "query is required (1-1000 chars)" }, 400);
    }

    const limit = validateLimit(body.limit);
    const embedding = await getEmbedding(query, c.env.OPENAI_API_KEY);

    const results = await c.env.VECTORIZE.query(embedding, {
      topK: limit,
      returnMetadata: "all",
      filter: body.filter?.language
        ? { language: body.filter.language }
        : undefined,
    });

    const boostedMatches = applyKeywordBoost(results.matches, query);
    trackQuery(query, "search", boostedMatches, body.filter?.language);
    await persistMetrics(c.env.METRICS);

    return c.json(formatResults(boostedMatches, query));
  } catch (error) {
    console.error("Search error:", error);
    return c.json({ error: "Search failed" }, 500);
  }
});

// Search Compact code
searchRoutes.post("/compact", async (c) => {
  try {
    await loadMetrics(c.env.METRICS);

    const body = await c.req.json<{ query: string; limit?: number }>();

    const query = validateQuery(body.query);
    if (!query) {
      return c.json({ error: "query is required (1-1000 chars)" }, 400);
    }

    const limit = validateLimit(body.limit);
    const embedding = await getEmbedding(query, c.env.OPENAI_API_KEY);

    const results = await c.env.VECTORIZE.query(embedding, {
      topK: limit,
      returnMetadata: "all",
      filter: { language: "compact" },
    });

    const boostedMatches = applyKeywordBoost(results.matches, query);
    trackQuery(query, "compact", boostedMatches, "compact");
    await persistMetrics(c.env.METRICS);

    return c.json(formatResults(boostedMatches, query));
  } catch (error) {
    console.error("Search compact error:", error);
    return c.json({ error: "Search failed" }, 500);
  }
});

// Search TypeScript code
searchRoutes.post("/typescript", async (c) => {
  try {
    await loadMetrics(c.env.METRICS);

    const body = await c.req.json<{ query: string; limit?: number }>();

    const query = validateQuery(body.query);
    if (!query) {
      return c.json({ error: "query is required (1-1000 chars)" }, 400);
    }

    const limit = validateLimit(body.limit);
    const embedding = await getEmbedding(query, c.env.OPENAI_API_KEY);

    const results = await c.env.VECTORIZE.query(embedding, {
      topK: limit,
      returnMetadata: "all",
      filter: { language: "typescript" },
    });

    const boostedMatches = applyKeywordBoost(results.matches, query);
    trackQuery(query, "typescript", boostedMatches, "typescript");
    await persistMetrics(c.env.METRICS);

    return c.json(formatResults(boostedMatches, query));
  } catch (error) {
    console.error("Search typescript error:", error);
    return c.json({ error: "Search failed" }, 500);
  }
});

// Search documentation
searchRoutes.post("/docs", async (c) => {
  try {
    await loadMetrics(c.env.METRICS);

    const body = await c.req.json<{ query: string; limit?: number }>();

    const query = validateQuery(body.query);
    if (!query) {
      return c.json({ error: "query is required (1-1000 chars)" }, 400);
    }

    const limit = validateLimit(body.limit);
    const embedding = await getEmbedding(query, c.env.OPENAI_API_KEY);

    const results = await c.env.VECTORIZE.query(embedding, {
      topK: limit,
      returnMetadata: "all",
      filter: { language: "markdown" },
    });

    const boostedMatches = applyKeywordBoost(results.matches, query);
    trackQuery(query, "docs", boostedMatches, "markdown");
    await persistMetrics(c.env.METRICS);

    return c.json(formatResults(boostedMatches, query));
  } catch (error) {
    console.error("Search docs error:", error);
    return c.json({ error: "Search failed" }, 500);
  }
});

export default searchRoutes;
