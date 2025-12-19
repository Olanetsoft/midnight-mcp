import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import { config, validateConfig } from "./config.js";
import { search, getStats, SearchFilter } from "./vectorstore.js";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use("*", cors());

// Simple in-memory rate limiting
const rateLimits = new Map<string, { count: number; resetAt: number }>();

app.use("*", async (c, next) => {
  const ip = c.req.header("x-forwarded-for") || "unknown";
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute

  let record = rateLimits.get(ip);
  if (!record || now > record.resetAt) {
    record = { count: 0, resetAt: now + windowMs };
    rateLimits.set(ip, record);
  }

  record.count++;

  if (record.count > config.rateLimitPerMinute) {
    return c.json(
      {
        error: "Rate limit exceeded",
        retryAfter: Math.ceil((record.resetAt - now) / 1000),
      },
      429
    );
  }

  // Add rate limit headers
  c.header("X-RateLimit-Limit", config.rateLimitPerMinute.toString());
  c.header(
    "X-RateLimit-Remaining",
    (config.rateLimitPerMinute - record.count).toString()
  );
  c.header("X-RateLimit-Reset", record.resetAt.toString());

  await next();
});

// Health check
app.get("/", (c) => {
  return c.json({
    service: "midnight-mcp-api",
    version: "0.0.1",
    status: "healthy",
  });
});

app.get("/health", async (c) => {
  try {
    const stats = await getStats();
    return c.json({
      status: "healthy",
      vectorStore: {
        documentsIndexed: stats.count,
      },
    });
  } catch (error) {
    return c.json(
      {
        status: "unhealthy",
        error: String(error),
      },
      500
    );
  }
});

// Search endpoints
app.post("/v1/search", async (c) => {
  try {
    const body = await c.req.json();
    const {
      query,
      limit = 10,
      filter,
    } = body as {
      query: string;
      limit?: number;
      filter?: SearchFilter;
    };

    if (!query || typeof query !== "string") {
      return c.json({ error: "Query is required" }, 400);
    }

    if (query.length < 2) {
      return c.json({ error: "Query must be at least 2 characters" }, 400);
    }

    if (query.length > 1000) {
      return c.json({ error: "Query must be less than 1000 characters" }, 400);
    }

    const results = await search(query, Math.min(limit, 50), filter);

    return c.json({
      results,
      query,
      totalResults: results.length,
    });
  } catch (error) {
    console.error("Search error:", error);
    return c.json({ error: "Search failed", details: String(error) }, 500);
  }
});

// Search Compact code
app.post("/v1/search/compact", async (c) => {
  try {
    const body = await c.req.json();
    const { query, limit = 10 } = body as { query: string; limit?: number };

    if (!query) {
      return c.json({ error: "Query is required" }, 400);
    }

    const results = await search(query, Math.min(limit, 50), {
      language: "compact",
    });

    return c.json({
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
      query,
    });
  } catch (error) {
    console.error("Search error:", error);
    return c.json({ error: "Search failed" }, 500);
  }
});

// Search TypeScript code
app.post("/v1/search/typescript", async (c) => {
  try {
    const body = await c.req.json();
    const {
      query,
      limit = 10,
      includeTypes = true,
    } = body as {
      query: string;
      limit?: number;
      includeTypes?: boolean;
    };

    if (!query) {
      return c.json({ error: "Query is required" }, 400);
    }

    let results = await search(query, Math.min(limit, 50), {
      language: "typescript",
    });

    if (!includeTypes) {
      results = results.filter(
        (r) =>
          r.metadata.codeType !== "type" && r.metadata.codeType !== "interface"
      );
    }

    return c.json({
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
        isExported: r.metadata.isPublic,
      })),
      totalResults: results.length,
      query,
    });
  } catch (error) {
    console.error("Search error:", error);
    return c.json({ error: "Search failed" }, 500);
  }
});

// Search documentation
app.post("/v1/search/docs", async (c) => {
  try {
    const body = await c.req.json();
    const {
      query,
      limit = 10,
      category = "all",
    } = body as {
      query: string;
      limit?: number;
      category?: string;
    };

    if (!query) {
      return c.json({ error: "Query is required" }, 400);
    }

    const filter: SearchFilter = { language: "markdown" };
    if (category !== "all") {
      filter.repository = "midnightntwrk/midnight-docs";
    }

    const results = await search(query, Math.min(limit, 50), filter);

    return c.json({
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
      query,
      category,
    });
  } catch (error) {
    console.error("Search error:", error);
    return c.json({ error: "Search failed" }, 500);
  }
});

// Stats endpoint
app.get("/v1/stats", async (c) => {
  try {
    const stats = await getStats();
    return c.json({
      documentsIndexed: stats.count,
      repositories: config.repositories.length,
    });
  } catch (error) {
    return c.json({ error: "Failed to get stats" }, 500);
  }
});

// Start server
const validation = validateConfig();
if (!validation.valid) {
  console.error("Configuration errors:", validation.errors);
  process.exit(1);
}

console.log(`Starting Midnight MCP API on port ${config.port}...`);
serve({
  fetch: app.fetch,
  port: config.port,
});
console.log(`Server running at http://localhost:${config.port}`);
