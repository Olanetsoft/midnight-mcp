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
} from "./routes";

const app = new Hono<{ Bindings: Bindings }>();

// CORS - allow all origins for public API
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    maxAge: 86400, // 24 hours
  })
);

// Mount routes
app.route("/", healthRoutes);
app.route("/v1/search", searchRoutes);
app.route("/v1/stats", statsRoutes);
app.route("/dashboard", dashboardRoute);

export default app;
