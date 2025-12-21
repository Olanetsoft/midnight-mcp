/**
 * Dashboard HTML template generator
 */

import type { Metrics } from "../interfaces";

/**
 * Generate the dashboard HTML page
 */
export function generateDashboardHtml(metrics: Metrics): string {
  const qualityScore =
    metrics.totalQueries > 0
      ? Math.round(
          (metrics.scoreDistribution.high * 100 +
            metrics.scoreDistribution.medium * 50) /
            metrics.totalQueries
        )
      : 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MCP Analytics</title>
  <style>
    ${getDashboardStyles()}
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
        : generateMetricsContent(metrics, qualityScore)
    }
  </div>
</body>
</html>`;
}

/**
 * Dashboard CSS styles
 */
function getDashboardStyles(): string {
  return `
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
    
    /* Mobile responsiveness */
    @media (max-width: 768px) {
      body { padding: 16px; }
      header { flex-direction: column; align-items: flex-start; gap: 12px; }
      header h1 { font-size: 18px; }
      header > div { display: flex; align-items: center; width: 100%; justify-content: space-between; }
      .metrics, .grid { grid-template-columns: 1fr; }
      .metric { padding: 16px; }
      .metric-value { font-size: 26px; }
      .card { padding: 16px; }
      .quality { flex-wrap: wrap; }
      .q-box { min-width: calc(50% - 6px); flex: 0 0 auto; }
      .q-num { font-size: 22px; }
      .bar-name { width: 70px; font-size: 12px; }
      .bar-val { width: 35px; font-size: 12px; margin-left: 8px; }
      
      /* Table mobile view */
      table { font-size: 12px; display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
      th, td { padding: 8px; white-space: nowrap; }
      td:first-child { max-width: 150px !important; }
    }
    
    @media (max-width: 480px) {
      body { padding: 12px; }
      header h1 { font-size: 16px; }
      .btn { padding: 6px 12px; font-size: 12px; }
      .metric-value { font-size: 22px; }
      .metric-label { font-size: 11px; }
      .card-title { font-size: 12px; margin-bottom: 12px; }
      .q-box { min-width: 100%; padding: 12px 8px; }
      .q-num { font-size: 20px; }
      .bar-name { width: 60px; font-size: 11px; }
      .bar-track { height: 6px; }
      .bar-val { width: 30px; font-size: 11px; }
      
      /* Stack quality boxes vertically */
      .quality { flex-direction: column; gap: 8px; }
    }
  `;
}

/**
 * Generate the main metrics content
 */
function generateMetricsContent(
  metrics: Metrics,
  qualityScore: number
): string {
  return `
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
        ${generateBarChart(metrics.queriesByEndpoint, metrics.totalQueries)}
      </div>
      
      <div class="card">
        <div class="card-title">By Language</div>
        ${generateBarChart(metrics.queriesByLanguage, metrics.totalQueries)}
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
        ${generateRepoChart(metrics.documentsByRepo)}
      </div>
    </div>
    
    <div class="card">
      <div class="card-title">Recent Queries</div>
      ${generateQueriesTable(metrics.recentQueries)}
    </div>
  `;
}

/**
 * Generate a bar chart from data
 */
function generateBarChart(data: Record<string, number>, total: number): string {
  const entries = Object.entries(data);
  if (entries.length === 0) {
    return '<p class="empty">—</p>';
  }

  return entries
    .sort((a, b) => b[1] - a[1])
    .map(([name, cnt]) => {
      const pct = total > 0 ? (cnt / total) * 100 : 0;
      return `<div class="bar-row"><span class="bar-name">${name}</span><div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div><span class="bar-val">${cnt}</span></div>`;
    })
    .join("");
}

/**
 * Generate repository chart (top 5)
 */
function generateRepoChart(documentsByRepo: Record<string, number>): string {
  const entries = Object.entries(documentsByRepo);
  if (entries.length === 0) {
    return '<p class="empty">—</p>';
  }

  const max = Math.max(...entries.map(([, cnt]) => cnt));

  return entries
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([repo, cnt]) => {
      const pct = max > 0 ? (cnt / max) * 100 : 0;
      const name = repo.split("/").pop();
      return `<div class="bar-row"><span class="bar-name" title="${repo}">${name}</span><div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div><span class="bar-val">${cnt}</span></div>`;
    })
    .join("");
}

/**
 * Generate recent queries table
 */
function generateQueriesTable(queries: Metrics["recentQueries"]): string {
  return `
    <table>
      <thead><tr><th>Query</th><th>Type</th><th>Results</th><th>Score</th><th>Time</th></tr></thead>
      <tbody>
        ${queries
          .slice(0, 15)
          .map(
            (q) =>
              `<tr><td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${q.query}</td><td>${q.endpoint}</td><td>${q.resultsCount}</td><td><span class="tag ${q.topScore > 0.8 ? "high" : q.topScore >= 0.5 ? "med" : "low"}">${(q.topScore * 100).toFixed(0)}%</span></td><td style="color:var(--muted)">${new Date(q.timestamp).toLocaleTimeString()}</td></tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;
}
