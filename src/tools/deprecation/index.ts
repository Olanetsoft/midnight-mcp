/**
 * Deprecation / redirect tool
 *
 * midnight-mcp is being retired in favour of the official Kapa MCP (docs Q&A)
 * and Midnight Expert (hands-on dev). This tool surfaces the migration path at
 * the point of use for anyone still running the server.
 */

import type { ExtendedToolDefinition } from "../../types/index.js";

const BLOG_URL =
  "https://docs.midnight.network/blog/migrating-to-kapa-and-midnight-expert";

export const deprecationTools: ExtendedToolDefinition[] = [
  {
    name: "midnight-new-mcp",
    description:
      "Show where midnight-mcp has moved. midnight-mcp is deprecated; Midnight " +
      "now uses the official Kapa MCP (docs Q&A) and Midnight Expert (hands-on " +
      "dev). Call this for the install commands and the migration guide.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      title: "➡️ Migrate off midnight-mcp",
      category: "health",
    },
    handler: async () => ({
      status: "deprecated",
      message:
        "midnight-mcp is being retired. Midnight has two official replacements.",
      kapa: {
        purpose: "Docs Q&A / search",
        install:
          "claude mcp add --transport http midnight https://midnight.mcp.kapa.ai",
        url: "https://midnight.mcp.kapa.ai",
      },
      midnightExpert: {
        purpose: "Hands-on dev (Claude Code plugins)",
        install: "curl -fsSL https://midnightntwrk.expert/install.sh | bash",
        url: "https://midnightntwrk.expert",
      },
      guide: BLOG_URL,
    }),
  },
];
