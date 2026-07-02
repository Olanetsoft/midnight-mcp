/**
 * Midnight MCP API
 *
 * A Cloudflare Worker API for semantic search across Midnight repositories.
 * Provides search endpoints for Compact, TypeScript, and documentation.
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Bindings } from "./interfaces";
import {
  healthRoutes,
  searchRoutes,
  statsRoutes,
  dashboardRoute,
  trackRoutes,
} from "./routes";

const app = new Hono<{ Bindings: Bindings }>();

// CORS - allow all origins for public API
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400, // 24 hours
  })
);

// Optional bearer auth for private/self-hosted deployments. When API_AUTH_TOKEN
// is set, every request except the health probes must send
// `Authorization: Bearer <token>`. Unset = open (preserves prior behaviour).
app.use("*", async (c, next) => {
  const token = c.env.API_AUTH_TOKEN;
  if (!token) return next();

  const path = new URL(c.req.url).pathname;
  if (c.req.method === "OPTIONS" || path === "/" || path === "/health") {
    return next();
  }

  if (c.req.header("Authorization") !== `Bearer ${token}`) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return next();
});

// Mount routes
app.route("/", healthRoutes);
app.route("/v1/search", searchRoutes);
app.route("/v1/stats", statsRoutes);
app.route("/v1/track", trackRoutes);
app.route("/dashboard", dashboardRoute);

export default app;
