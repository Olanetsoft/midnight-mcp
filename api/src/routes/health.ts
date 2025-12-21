/**
 * Health check routes
 */

import { Hono } from "hono";
import type { Bindings } from "../interfaces";

const healthRoutes = new Hono<{ Bindings: Bindings }>();

// Root health check
healthRoutes.get("/", (c) =>
  c.json({ status: "ok", service: "midnight-mcp-api" })
);

// Detailed health check
healthRoutes.get("/health", (c) =>
  c.json({
    status: "healthy",
    environment: c.env.ENVIRONMENT,
    vectorize: !!c.env.VECTORIZE,
  })
);

export default healthRoutes;
