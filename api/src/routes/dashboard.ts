/**
 * Dashboard route
 */

import { Hono } from "hono";
import type { Bindings } from "../interfaces";
import { getMetrics, loadMetrics } from "../services";
import { generateDashboardHtml } from "../templates/dashboard";

const dashboardRoute = new Hono<{ Bindings: Bindings }>();

// Dashboard HTML page - viewable in browser
dashboardRoute.get("/", async (c) => {
  await loadMetrics(c.env.METRICS);
  const metrics = getMetrics();
  const html = generateDashboardHtml(metrics);
  return c.html(html);
});

export default dashboardRoute;
