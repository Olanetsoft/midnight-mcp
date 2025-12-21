import { Hono } from "hono";
import { cors } from "hono/cors";

type Bindings = {
  VECTORIZE: VectorizeIndex;
  OPENAI_API_KEY: string;
  ENVIRONMENT: string;
  METRICS: KVNamespace; // Add KV for metrics storage
};

// In-memory metrics (reset on cold start, persisted to KV periodically)
interface QueryLog {
  query: string;
  endpoint: string;
  timestamp: string;
  resultsCount: number;
  avgScore: number;
  topScore: number;
  language?: string;
}

interface Metrics {
  totalQueries: number;
  queriesByEndpoint: Record<string, number>;
  queriesByLanguage: Record<string, number>;
  avgRelevanceScore: number;
  scoreDistribution: { high: number; medium: number; low: number };
  recentQueries: QueryLog[];
  documentsByRepo: Record<string, number>;
  lastUpdated: string;
}

// Initialize metrics
let metrics: Metrics = {
  totalQueries: 0,
  queriesByEndpoint: {},
  queriesByLanguage: {},
  avgRelevanceScore: 0,
  scoreDistribution: { high: 0, medium: 0, low: 0 },
  recentQueries: [],
  documentsByRepo: {},
  lastUpdated: new Date().toISOString(),
};

// Track a query
function trackQuery(
  query: string,
  endpoint: string,
  matches: VectorizeMatches["matches"],
  language?: string
) {
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

// Save metrics to KV (call periodically)
async function persistMetrics(kv: KVNamespace | undefined) {
  if (!kv) return;
  try {
    await kv.put("metrics", JSON.stringify(metrics), {
      expirationTtl: 86400 * 30,
    }); // 30 days
  } catch (e) {
    console.error("Failed to persist metrics:", e);
  }
}

// Load metrics from KV
async function loadMetrics(kv: KVNamespace | undefined) {
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

const app = new Hono<{ Bindings: Bindings }>();

// CORS - restrict to known origins in production
app.use(
  "*",
  cors({
    origin: "*", // Allow all origins for public API
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    maxAge: 86400, // 24 hours
  })
);

// Health check
app.get("/", (c) => c.json({ status: "ok", service: "midnight-mcp-api" }));

app.get("/health", (c) =>
  c.json({
    status: "healthy",
    environment: c.env.ENVIRONMENT,
    vectorize: !!c.env.VECTORIZE,
  })
);

// Generate embedding using OpenAI
async function getEmbedding(text: string, apiKey: string): Promise<number[]> {
  // Truncate input to prevent abuse (max ~8k tokens)
  const truncatedText = text.slice(0, 8000);

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: truncatedText,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    data: Array<{ embedding: number[] }>;
  };
  return data.data[0].embedding;
}

// Helper to format search results consistently
function formatResults(
  matches: VectorizeMatches["matches"],
  query: string
): object {
  return {
    results: matches.map((match) => ({
      content: match.metadata?.content || "",
      relevanceScore: match.score,
      source: {
        repository: match.metadata?.repository || "",
        filePath: match.metadata?.filePath || "",
        lines: match.metadata?.startLine
          ? `${match.metadata.startLine}-${match.metadata.endLine}`
          : undefined,
      },
      codeType: match.metadata?.language,
    })),
    query,
    totalResults: matches.length,
  };
}

// Validate and sanitize query
function validateQuery(query: unknown): string | null {
  if (typeof query !== "string") return null;
  const trimmed = query.trim();
  if (trimmed.length === 0 || trimmed.length > 1000) return null;
  return trimmed;
}

// Validate limit
function validateLimit(limit: unknown): number {
  if (typeof limit !== "number") return 10;
  return Math.min(Math.max(1, limit), 50); // Between 1 and 50
}

// Search endpoint
app.post("/v1/search", async (c) => {
  try {
    await loadMetrics(c.env.METRICS);

    const body = await c.req.json<{
      query: string;
      limit?: number;
      filter?: { language?: string };
    }>();

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

    // Track query metrics
    trackQuery(query, "search", results.matches, body.filter?.language);
    await persistMetrics(c.env.METRICS);

    return c.json(formatResults(results.matches, query));
  } catch (error) {
    console.error("Search error:", error);
    return c.json({ error: "Search failed" }, 500);
  }
});

// Search Compact code
app.post("/v1/search/compact", async (c) => {
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

    // Track query metrics
    trackQuery(query, "compact", results.matches, "compact");
    await persistMetrics(c.env.METRICS);

    return c.json(formatResults(results.matches, query));
  } catch (error) {
    console.error("Search compact error:", error);
    return c.json({ error: "Search failed" }, 500);
  }
});

// Search TypeScript code
app.post("/v1/search/typescript", async (c) => {
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

    // Track query metrics
    trackQuery(query, "typescript", results.matches, "typescript");
    await persistMetrics(c.env.METRICS);

    return c.json(formatResults(results.matches, query));
  } catch (error) {
    console.error("Search typescript error:", error);
    return c.json({ error: "Search failed" }, 500);
  }
});

// Search docs
app.post("/v1/search/docs", async (c) => {
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

    // Track query metrics
    trackQuery(query, "docs", results.matches, "markdown");
    await persistMetrics(c.env.METRICS);

    return c.json(formatResults(results.matches, query));
  } catch (error) {
    console.error("Search docs error:", error);
    return c.json({ error: "Search failed" }, 500);
  }
});

// Stats endpoint (JSON API)
app.get("/v1/stats", async (c) => {
  await loadMetrics(c.env.METRICS);
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
app.get("/v1/stats/queries", async (c) => {
  await loadMetrics(c.env.METRICS);
  return c.json({
    recentQueries: metrics.recentQueries,
    total: metrics.totalQueries,
  });
});

// Dashboard HTML page - viewable in browser
app.get("/dashboard", async (c) => {
  await loadMetrics(c.env.METRICS);

  const qualityScore =
    metrics.totalQueries > 0
      ? Math.round(
          (metrics.scoreDistribution.high * 100 +
            metrics.scoreDistribution.medium * 50) /
            metrics.totalQueries
        )
      : 0;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MCP Analytics</title>
  <style>
    :root { --bg: #111; --card: #1c1c1c; --border: #333; --text: #eee; --muted: #888; --accent: #6366f1; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', -apple-system, system-ui, sans-serif; background: var(--bg); color: var(--text); padding: 24px; line-height: 1.5; }
    .container { max-width: 1100px; margin: 0 auto; }
    header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; padding-bottom: 16px; border-bottom: 1px solid var(--border); }
    header h1 { font-size: 20px; font-weight: 600; }
    header span { color: var(--muted); font-size: 13px; }
    .btn { background: var(--card); color: var(--text); border: 1px solid var(--border); padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; transition: background .15s; }
    .btn:hover { background: #252525; }
    .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
    .metric { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 20px; }
    .metric-value { font-size: 32px; font-weight: 700; font-variant-numeric: tabular-nums; }
    .metric-label { color: var(--muted); font-size: 12px; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 20px; }
    .card-title { font-size: 13px; font-weight: 600; color: var(--muted); margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.5px; }
    .bar-row { display: flex; align-items: center; margin-bottom: 10px; }
    .bar-name { width: 90px; font-size: 13px; color: var(--muted); flex-shrink: 0; }
    .bar-track { flex: 1; height: 8px; background: #252525; border-radius: 4px; overflow: hidden; }
    .bar-fill { height: 100%; background: var(--accent); border-radius: 4px; transition: width .3s; }
    .bar-val { width: 40px; text-align: right; font-size: 13px; font-weight: 500; margin-left: 12px; }
    .quality { display: flex; gap: 12px; }
    .q-box { flex: 1; text-align: center; padding: 16px 8px; border-radius: 6px; }
    .q-box.high { background: rgba(34,197,94,.15); color: #22c55e; }
    .q-box.med { background: rgba(234,179,8,.15); color: #eab308; }
    .q-box.low { background: rgba(239,68,68,.15); color: #ef4444; }
    .q-num { font-size: 28px; font-weight: 700; }
    .q-label { font-size: 11px; margin-top: 4px; opacity: .8; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 10px 12px; color: var(--muted); font-weight: 500; border-bottom: 1px solid var(--border); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    td { padding: 10px 12px; border-bottom: 1px solid #222; }
    .tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; }
    .tag.high { background: rgba(34,197,94,.2); color: #22c55e; }
    .tag.med { background: rgba(234,179,8,.2); color: #eab308; }
    .tag.low { background: rgba(239,68,68,.2); color: #ef4444; }
    .empty { color: var(--muted); text-align: center; padding: 32px; font-size: 14px; }
    .full-width { grid-column: 1 / -1; }
    @media (max-width: 768px) { .metrics, .grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>MCP Analytics</h1>
      <div>
        <span>${metrics.lastUpdated ? new Date(metrics.lastUpdated).toLocaleString() : "—"}</span>
        <button class="btn" onclick="location.reload()" style="margin-left: 12px">Refresh</button>
      </div>
    </header>
    
    ${
      metrics.totalQueries === 0
        ? '<div class="card"><p class="empty">No queries yet</p></div>'
        : `
    <div class="metrics">
      <div class="metric">
        <div class="metric-value">${metrics.totalQueries.toLocaleString()}</div>
        <div class="metric-label">Total Queries</div>
      </div>
      <div class="metric">
        <div class="metric-value">${(metrics.avgRelevanceScore * 100).toFixed(1)}%</div>
        <div class="metric-label">Avg Relevance</div>
      </div>
      <div class="metric">
        <div class="metric-value">${qualityScore}%</div>
        <div class="metric-label">Quality Score</div>
      </div>
    </div>
    
    <div class="grid">
      <div class="card">
        <div class="card-title">By Endpoint</div>
        ${
          Object.entries(metrics.queriesByEndpoint).length === 0
            ? '<p class="empty">—</p>'
            : Object.entries(metrics.queriesByEndpoint)
                .sort((a, b) => b[1] - a[1])
                .map(([ep, cnt]) => {
                  const pct =
                    metrics.totalQueries > 0
                      ? (cnt / metrics.totalQueries) * 100
                      : 0;
                  return (
                    '<div class="bar-row"><span class="bar-name">' +
                    ep +
                    '</span><div class="bar-track"><div class="bar-fill" style="width:' +
                    pct +
                    '%"></div></div><span class="bar-val">' +
                    cnt +
                    "</span></div>"
                  );
                })
                .join("")
        }
      </div>
      
      <div class="card">
        <div class="card-title">By Language</div>
        ${
          Object.entries(metrics.queriesByLanguage).length === 0
            ? '<p class="empty">—</p>'
            : Object.entries(metrics.queriesByLanguage)
                .sort((a, b) => b[1] - a[1])
                .map(([lang, cnt]) => {
                  const pct =
                    metrics.totalQueries > 0
                      ? (cnt / metrics.totalQueries) * 100
                      : 0;
                  return (
                    '<div class="bar-row"><span class="bar-name">' +
                    lang +
                    '</span><div class="bar-track"><div class="bar-fill" style="width:' +
                    pct +
                    '%"></div></div><span class="bar-val">' +
                    cnt +
                    "</span></div>"
                  );
                })
                .join("")
        }
      </div>
      
      <div class="card">
        <div class="card-title">Quality Distribution</div>
        <div class="quality">
          <div class="q-box high"><div class="q-num">${metrics.scoreDistribution.high}</div><div class="q-label">High</div></div>
          <div class="q-box med"><div class="q-num">${metrics.scoreDistribution.medium}</div><div class="q-label">Medium</div></div>
          <div class="q-box low"><div class="q-num">${metrics.scoreDistribution.low}</div><div class="q-label">Low</div></div>
        </div>
      </div>
      
      <div class="card">
        <div class="card-title">Top Repositories</div>
        ${
          Object.entries(metrics.documentsByRepo).length === 0
            ? '<p class="empty">—</p>'
            : Object.entries(metrics.documentsByRepo)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([repo, cnt]) => {
                  const max = Math.max(
                    ...Object.values(metrics.documentsByRepo)
                  );
                  const pct = max > 0 ? (cnt / max) * 100 : 0;
                  const name = repo.split("/").pop();
                  return (
                    '<div class="bar-row"><span class="bar-name" title="' +
                    repo +
                    '">' +
                    name +
                    '</span><div class="bar-track"><div class="bar-fill" style="width:' +
                    pct +
                    '%"></div></div><span class="bar-val">' +
                    cnt +
                    "</span></div>"
                  );
                })
                .join("")
        }
      </div>
    </div>
    
    <div class="card">
      <div class="card-title">Recent Queries</div>
      <table>
        <thead><tr><th>Query</th><th>Type</th><th>Results</th><th>Score</th><th>Time</th></tr></thead>
        <tbody>
          ${metrics.recentQueries
            .slice(0, 15)
            .map(
              (q) =>
                '<tr><td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
                q.query +
                "</td><td>" +
                q.endpoint +
                "</td><td>" +
                q.resultsCount +
                '</td><td><span class="tag ' +
                (q.topScore > 0.8
                  ? "high"
                  : q.topScore >= 0.5
                    ? "med"
                    : "low") +
                '">' +
                (q.topScore * 100).toFixed(0) +
                '%</span></td><td style="color:var(--muted)">' +
                new Date(q.timestamp).toLocaleTimeString() +
                "</td></tr>"
            )
            .join("")}
        </tbody>
      </table>
    </div>
    `
    }
  </div>
</body>
</html>`;

  return c.html(html);
});

export default app;
