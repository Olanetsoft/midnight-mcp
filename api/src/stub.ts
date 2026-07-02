/**
 * Midnight MCP API — deprecation stub
 *
 * This replaces the real search Worker on the PUBLIC URL. midnight-mcp is being
 * retired in favour of the official Kapa MCP (docs Q&A) and Midnight Expert
 * (hands-on dev). The stub keeps every route the client calls so existing
 * installs get a clear redirect at the point of use instead of an opaque
 * network error — it holds no OpenAI key, no Vectorize index and no KV, so it
 * cannot leak or bill anything.
 *
 * The real search backend (src/index.ts) is deployed separately under a private
 * name via wrangler.private.toml for the maintainer's own local use.
 */

import { Hono } from "hono";
import type { Context } from "hono";
import { cors } from "hono/cors";

const BLOG_URL =
  "https://docs.midnight.network/blog/migrating-to-kapa-and-midnight-expert";

const DEPRECATION_MESSAGE =
  "This community Midnight MCP backend is deprecated. Midnight now uses the " +
  "official Kapa MCP (docs Q&A) and Midnight Expert (hands-on dev). " +
  `Migrate: ${BLOG_URL}`;

const REDIRECT = {
  deprecated: true,
  message: DEPRECATION_MESSAGE,
  kapa: "https://midnight.mcp.kapa.ai",
  midnightExpert: "https://midnightntwrk.expert",
  guide: BLOG_URL,
};

const app = new Hono();

// Keep CORS open so existing browser/tool callers still receive the payload.
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    maxAge: 86400,
  })
);

// Health — keep status "healthy" so the MCP client's health check does not
// hard-fail; it still carries the deprecation notice.
app.get("/", (c) =>
  c.json({ status: "ok", service: "midnight-mcp-api", ...REDIRECT })
);
app.get("/health", (c) =>
  c.json({ status: "healthy", vectorStore: "deprecated", ...REDIRECT })
);

// Search — return a shape the client parses cleanly (results[] + warnings[]) so
// the deprecation message surfaces in the tool output instead of crashing on a
// missing results array or being swallowed as an error.
async function readQuery(c: Context): Promise<string> {
  try {
    const body = await c.req.json<{ query?: unknown }>();
    return typeof body?.query === "string" ? body.query : "";
  } catch {
    return "";
  }
}

const searchStub = async (c: Context) => {
  const query = await readQuery(c);
  return c.json({
    results: [],
    totalResults: 0,
    query,
    warnings: [DEPRECATION_MESSAGE],
    ...REDIRECT,
  });
};

app.post("/v1/search", searchStub);
app.post("/v1/search/compact", searchStub);
app.post("/v1/search/typescript", searchStub);
app.post("/v1/search/docs", searchStub);

// Stats — no analytics are collected any more.
app.get("/v1/stats", (c) =>
  c.json({ service: "midnight-mcp-api", metrics: null, ...REDIRECT })
);
app.get("/v1/stats/queries", (c) =>
  c.json({ recentQueries: [], total: 0, ...REDIRECT })
);

// Track — accept and no-op so fire-and-forget telemetry calls do not error.
app.post("/v1/track/tool", (c) => c.json({ tracked: false, ...REDIRECT }));

// Dashboard — static deprecation page.
app.get("/dashboard", (c) =>
  c.html(
    `<!doctype html><html><head><meta charset="utf-8"><title>midnight-mcp — deprecated</title>
<style>body{font-family:system-ui,sans-serif;max-width:640px;margin:10vh auto;padding:0 1.5rem;line-height:1.6;color:#222}a{color:#5b21b6}code{background:#f4f4f5;padding:.15rem .35rem;border-radius:4px}</style>
</head><body>
<h1>⚠️ midnight-mcp is deprecated</h1>
<p>Midnight has standardised on two official tools:</p>
<ul>
<li><strong>Kapa MCP</strong> (docs Q&amp;A / search): <code>claude mcp add --transport http midnight https://midnight.mcp.kapa.ai</code></li>
<li><strong>Midnight Expert</strong> (hands-on dev): <code>curl -fsSL https://midnightntwrk.expert/install.sh | bash</code></li>
</ul>
<p>Migration guide → <a href="${BLOG_URL}">${BLOG_URL}</a></p>
</body></html>`
  )
);

// Anything else — redirect payload.
app.all("*", (c) => c.json(REDIRECT, 404));

export default app;
