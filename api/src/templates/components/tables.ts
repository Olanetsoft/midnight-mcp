/**
 * Table components for the dashboard
 * Reusable data tables with consistent styling
 */

import type { ToolCall } from "../../interfaces";
import { escapeHtml } from "./html-utils";

export interface TableColumn<T> {
  key: keyof T | string;
  label: string;
  width?: string;
  truncate?: boolean;
  render?: (item: T) => string;
}

export interface TableOptions {
  emptyMessage?: string;
  maxRows?: number;
  striped?: boolean;
}

/**
 * Generic table generator
 */
export function generateTable<T>(
  data: T[],
  columns: TableColumn<T>[],
  options: TableOptions = {}
): string {
  const { emptyMessage = "No data", maxRows, striped = false } = options;

  if (!data || data.length === 0) {
    return `<p class="empty">${emptyMessage}</p>`;
  }

  const displayData = maxRows ? data.slice(0, maxRows) : data;

  const headerHtml = columns
    .map((col) => {
      const style = col.width ? `style="width: ${col.width}"` : "";
      return `<th ${style}>${col.label}</th>`;
    })
    .join("");

  const rowsHtml = displayData
    .map((item, index) => {
      const rowClass = striped && index % 2 === 1 ? 'class="striped"' : "";
      const cellsHtml = columns
        .map((col) => {
          let value: string;
          if (col.render) {
            value = col.render(item);
          } else {
            const rawValue = (item as Record<string, unknown>)[
              col.key as string
            ];
            value = String(rawValue ?? "");
          }
          const truncateClass = col.truncate ? 'class="cell-truncate"' : "";
          return `<td ${truncateClass}>${value}</td>`;
        })
        .join("");
      return `<tr ${rowClass}>${cellsHtml}</tr>`;
    })
    .join("");

  return `
    <table>
      <thead><tr>${headerHtml}</tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  `;
}

/**
 * Generate score tag HTML
 */
export function generateScoreTag(score: number): string {
  const percentage = Math.round(score * 100);
  const level = score >= 0.7 ? "high" : score >= 0.4 ? "med" : "low";
  return `<span class="tag ${level}">${percentage}%</span>`;
}

/**
 * Generate status tag HTML
 */
export function generateStatusTag(success: boolean): string {
  const level = success ? "high" : "low";
  const icon = success ? "✓" : "✗";
  return `<span class="tag ${level}">${icon}</span>`;
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(timestamp: string | number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format date for display
 */
export function formatDate(timestamp: string | number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

/**
 * Format full datetime for display
 */
export function formatDateTime(timestamp: string | number): string {
  const date = new Date(timestamp);
  return `${formatDate(timestamp)} ${formatTimestamp(timestamp)}`;
}

/**
 * Generate recent queries table
 */
export function generateQueriesTable(
  queries: Array<{
    query: string;
    endpoint: string;
    topScore: number;
    timestamp: string;
  }>,
  options: TableOptions = {}
): string {
  const { emptyMessage = "No searches yet", maxRows = 15 } = options;

  if (!queries || queries.length === 0) {
    return `<p class="empty">${emptyMessage}</p>`;
  }

  // Query text is intentionally NOT rendered. Search queries can contain
  // proprietary contract source; only non-sensitive analytics are shown.
  const columns: TableColumn<(typeof queries)[0]>[] = [
    { key: "endpoint", label: "Type" },
    {
      key: "topScore",
      label: "Score",
      render: (q) => generateScoreTag(q.topScore),
    },
    {
      key: "timestamp",
      label: "Time",
      render: (q) =>
        `<span style="color: var(--muted)">${formatTimestamp(q.timestamp)}</span>`,
    },
  ];

  return generateTable(queries, columns, { ...options, maxRows });
}

/**
 * Generate recent tool calls table
 */
export function generateToolCallsTable(
  toolCalls: ToolCall[],
  options: TableOptions = {}
): string {
  const { emptyMessage = "No tool calls yet", maxRows = 10 } = options;

  if (!toolCalls || toolCalls.length === 0) {
    return `<p class="empty">${emptyMessage}</p>`;
  }

  const columns: TableColumn<ToolCall>[] = [
    {
      key: "tool",
      label: "Tool",
      truncate: true,
      render: (t) => escapeHtml(t.tool.replace("midnight-", "")),
    },
    {
      key: "success",
      label: "Status",
      render: (t) => generateStatusTag(t.success),
    },
    {
      key: "timestamp",
      label: "Time",
      render: (t) =>
        `<span style="color: var(--muted)">${formatTimestamp(t.timestamp)}</span>`,
    },
  ];

  return generateTable(toolCalls, columns, { ...options, maxRows });
}

/**
 * Generate error log table
 */
export function generateErrorTable(
  errors: Array<{
    message: string;
    count: number;
    lastSeen: string;
  }>,
  options: TableOptions = {}
): string {
  const { emptyMessage = "No errors recorded", maxRows = 5 } = options;

  if (!errors || errors.length === 0) {
    return `<p class="empty">${emptyMessage}</p>`;
  }

  const columns: TableColumn<(typeof errors)[0]>[] = [
    {
      key: "message",
      label: "Error",
      truncate: true,
      render: (e) => escapeHtml(e.message),
    },
    {
      key: "count",
      label: "Count",
      render: (e) => `<span class="tag low">${e.count}</span>`,
    },
    {
      key: "lastSeen",
      label: "Last Seen",
      render: (e) =>
        `<span style="color: var(--muted)">${formatDateTime(e.lastSeen)}</span>`,
    },
  ];

  return generateTable(errors, columns, { ...options, maxRows });
}

/**
 * Generate endpoint stats table
 */
export function generateEndpointTable(
  endpoints: Array<{
    name: string;
    calls: number;
    avgLatency: number;
    errorRate: number;
  }>,
  options: TableOptions = {}
): string {
  const { emptyMessage = "No endpoint data", maxRows = 10 } = options;

  if (!endpoints || endpoints.length === 0) {
    return `<p class="empty">${emptyMessage}</p>`;
  }

  const columns: TableColumn<(typeof endpoints)[0]>[] = [
    { key: "name", label: "Endpoint", render: (e) => escapeHtml(e.name) },
    { key: "calls", label: "Calls", render: (e) => e.calls.toLocaleString() },
    {
      key: "avgLatency",
      label: "Avg Latency",
      render: (e) => `${e.avgLatency.toFixed(0)}ms`,
    },
    {
      key: "errorRate",
      label: "Error Rate",
      render: (e) => {
        const level =
          e.errorRate < 1 ? "high" : e.errorRate < 5 ? "med" : "low";
        return `<span class="tag ${level}">${e.errorRate.toFixed(1)}%</span>`;
      },
    },
  ];

  return generateTable(endpoints, columns, { ...options, maxRows });
}

/**
 * Escape HTML special characters - re-exported for backward compatibility
 * @deprecated Use escapeHtml from ./html-utils instead
 */
export { escapeHtml } from "./html-utils";
