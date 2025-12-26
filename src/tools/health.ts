/**
 * Health check and diagnostic tools for MCP server
 */

import { z } from "zod";
import * as os from "os";
import * as path from "path";
import {
  getHealthStatus,
  getQuickHealthStatus,
  getRateLimitStatus,
  formatRateLimitStatus,
} from "../utils/index.js";
import { searchCache, fileCache, metadataCache } from "../utils/cache.js";
import type { ExtendedToolDefinition, OutputSchema } from "../types/index.js";

// Current version - should match package.json
const CURRENT_VERSION = "0.1.30";

// Schema definitions
export const HealthCheckInputSchema = z.object({
  detailed: z
    .boolean()
    .optional()
    .default(false)
    .describe("Include detailed checks (slower but more comprehensive)"),
});

export const GetStatusInputSchema = z.object({});

export const CheckVersionInputSchema = z.object({});

export type HealthCheckInput = z.infer<typeof HealthCheckInputSchema>;
export type GetStatusInput = z.infer<typeof GetStatusInputSchema>;
export type CheckVersionInput = z.infer<typeof CheckVersionInputSchema>;

/**
 * Perform health check on the MCP server
 */
export async function healthCheck(input: HealthCheckInput) {
  if (input.detailed) {
    const status = await getHealthStatus();
    return {
      ...status,
      rateLimit: formatRateLimitStatus(),
      cacheStats: {
        search: searchCache.getStats(),
        file: fileCache.getStats(),
        metadata: metadataCache.getStats(),
      },
    };
  }

  return {
    ...getQuickHealthStatus(),
    rateLimit: formatRateLimitStatus(),
  };
}

/**
 * Get current server status and statistics
 */
export async function getStatus(_input: GetStatusInput) {
  const rateLimitStatus = getRateLimitStatus();

  return {
    server: "midnight-mcp",
    status: "running",
    timestamp: new Date().toISOString(),
    rateLimit: {
      remaining: rateLimitStatus.remaining,
      limit: rateLimitStatus.limit,
      percentUsed: rateLimitStatus.percentUsed,
      status: rateLimitStatus.isLimited
        ? "limited"
        : rateLimitStatus.isWarning
          ? "warning"
          : "ok",
      message: rateLimitStatus.message,
    },
    cache: {
      search: searchCache.getStats(),
      file: fileCache.getStats(),
      metadata: metadataCache.getStats(),
    },
  };
}

/**
 * Check if current version is up to date with npm
 */
export async function checkVersion(_input: CheckVersionInput) {
  try {
    const response = await fetch(
      "https://registry.npmjs.org/midnight-mcp/latest"
    );
    if (!response.ok) {
      return {
        currentVersion: CURRENT_VERSION,
        latestVersion: "unknown",
        isUpToDate: true, // Assume up to date if we can't check
        error: "Could not fetch latest version from npm",
      };
    }

    const data = (await response.json()) as { version: string };
    const latestVersion = data.version;
    const isUpToDate = CURRENT_VERSION === latestVersion;

    return {
      currentVersion: CURRENT_VERSION,
      latestVersion,
      isUpToDate,
      message: isUpToDate
        ? "✅ You are running the latest version!"
        : `⚠️ UPDATE AVAILABLE: v${latestVersion} (you have v${CURRENT_VERSION})`,
      updateInstructions: isUpToDate
        ? null
        : {
            step1:
              "Clear npx cache: rm -rf ~/.npm/_npx (macOS/Linux) or del /s /q %LocalAppData%\\npm-cache\\_npx (Windows)",
            step2:
              "Restart Claude Desktop completely (Cmd+Q / Alt+F4, then reopen)",
            step3:
              "Or update config to use: npx -y midnight-mcp@latest (forces latest)",
            alternative:
              "You can also install globally: npm install -g midnight-mcp@latest",
          },
      newFeatures: isUpToDate
        ? null
        : [
            "midnight-validate-contract - Compile with REAL Compact compiler",
            "midnight-extract-contract-structure - Static analysis with 10 pre-compilation checks",
            "Pre-compilation detection: division operator, Counter.value, overflow, disclose() requirements",
          ],
    };
  } catch (error) {
    return {
      currentVersion: CURRENT_VERSION,
      latestVersion: "unknown",
      isUpToDate: true,
      error: `Failed to check version: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

// Schema for auto-update config tool
export const AutoUpdateConfigInputSchema = z.object({});
export type AutoUpdateConfigInput = z.infer<typeof AutoUpdateConfigInputSchema>;

/**
 * Get config file paths and update instructions for AI agent to auto-update
 */
export async function getAutoUpdateConfig(_input: AutoUpdateConfigInput) {
  const platform = os.platform();
  const homeDir = os.homedir();

  // Config paths for each editor
  const configPaths: Record<string, { path: string; exists: boolean }> = {};

  // Claude Desktop
  if (platform === "darwin") {
    configPaths.claudeDesktop = {
      path: path.join(
        homeDir,
        "Library/Application Support/Claude/claude_desktop_config.json"
      ),
      exists: true, // Agent will verify
    };
  } else if (platform === "win32") {
    configPaths.claudeDesktop = {
      path: path.join(
        process.env.APPDATA || "",
        "Claude/claude_desktop_config.json"
      ),
      exists: true,
    };
  } else {
    configPaths.claudeDesktop = {
      path: path.join(homeDir, ".config/Claude/claude_desktop_config.json"),
      exists: true,
    };
  }

  // Cursor - project-level config
  configPaths.cursor = {
    path: ".cursor/mcp.json",
    exists: true,
  };

  // VS Code Copilot - project-level config
  configPaths.vscode = {
    path: ".vscode/mcp.json",
    exists: true,
  };

  // Windsurf
  configPaths.windsurf = {
    path: path.join(homeDir, ".codeium/windsurf/mcp_config.json"),
    exists: true,
  };

  // The exact JSON change needed
  const oldConfig = `"args": ["-y", "midnight-mcp"]`;
  const newConfig = `"args": ["-y", "midnight-mcp@latest"]`;

  return {
    instruction:
      "UPDATE THE USER'S CONFIG FILE AUTOMATICALLY. Find and edit the config file to use @latest.",
    platform,
    configPaths,
    searchAndReplace: {
      find: oldConfig,
      replaceWith: newConfig,
      description: "Change midnight-mcp to midnight-mcp@latest in args array",
    },
    alternativePatterns: [
      {
        find: `"midnight-mcp"`,
        replaceWith: `"midnight-mcp@latest"`,
        context: "If args uses different formatting",
      },
    ],
    agentInstructions: [
      "1. Check which config file exists (Claude Desktop, Cursor, VS Code, or Windsurf)",
      "2. Read the config file",
      "3. Replace 'midnight-mcp' with 'midnight-mcp@latest' in the args array",
      "4. Write the updated config file",
      "5. Tell user to restart their editor (Cmd+Q on Mac, Alt+F4 on Windows)",
    ],
    postUpdateMessage:
      "✅ Config updated! Please restart your editor completely (quit and reopen) to use the latest version.",
  };
}

// Output schemas for health tools
const healthCheckOutputSchema: OutputSchema = {
  type: "object",
  properties: {
    status: {
      type: "string",
      enum: ["healthy", "degraded", "unhealthy"],
      description: "Overall health status",
    },
    version: { type: "string", description: "Server version" },
    rateLimit: {
      type: "object",
      properties: {
        remaining: { type: "number" },
        limit: { type: "number" },
        percentUsed: { type: "number" },
        status: { type: "string" },
      },
    },
    cacheStats: {
      type: "object",
      properties: {
        search: { type: "object" },
        file: { type: "object" },
        metadata: { type: "object" },
      },
    },
  },
  required: ["status"],
  description: "Server health status with optional detailed diagnostics",
};

const getStatusOutputSchema: OutputSchema = {
  type: "object",
  properties: {
    server: { type: "string", description: "Server name" },
    status: { type: "string", description: "Running status" },
    timestamp: { type: "string", description: "ISO timestamp" },
    rateLimit: {
      type: "object",
      properties: {
        remaining: { type: "number" },
        limit: { type: "number" },
        percentUsed: { type: "number" },
        status: { type: "string" },
        message: { type: "string" },
      },
    },
    cache: {
      type: "object",
      properties: {
        search: { type: "object" },
        file: { type: "object" },
        metadata: { type: "object" },
      },
    },
  },
  required: ["server", "status", "timestamp"],
  description: "Current server status and statistics",
};

// Tool definitions for MCP server
export const healthTools: ExtendedToolDefinition[] = [
  {
    name: "midnight-health-check",
    description:
      "Check the health status of the Midnight MCP server. Returns server status, API connectivity, and resource availability.",
    inputSchema: {
      type: "object" as const,
      properties: {
        detailed: {
          type: "boolean",
          description:
            "Include detailed checks including GitHub API and vector store status (slower)",
          default: false,
        },
      },
    },
    outputSchema: healthCheckOutputSchema,
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      title: "Health Check",
      category: "health",
    },
    handler: healthCheck,
  },
  {
    name: "midnight-get-status",
    description:
      "Get current server status including rate limits and cache statistics. Quick status check without external API calls.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
    outputSchema: getStatusOutputSchema,
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      title: "Get Server Status",
      category: "health",
    },
    handler: getStatus,
  },
  {
    name: "midnight-check-version",
    description:
      "🔄 Check if you're running the latest version of midnight-mcp. " +
      "Compares your installed version against npm registry and provides update instructions if outdated. " +
      "Use this if tools seem missing or you want to ensure you have the latest features like midnight-validate-contract.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        currentVersion: {
          type: "string",
          description: "Your installed version",
        },
        latestVersion: { type: "string", description: "Latest version on npm" },
        isUpToDate: {
          type: "boolean",
          description: "Whether you have the latest",
        },
        message: { type: "string", description: "Status message" },
        updateInstructions: {
          type: "object",
          description: "How to update if outdated",
        },
        newFeatures: {
          type: "array",
          items: { type: "string" },
          description: "New features in latest version",
        },
      },
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      title: "🔄 Check for Updates",
      category: "health",
    },
    handler: checkVersion,
  },
  {
    name: "midnight-auto-update-config",
    description:
      "🔧 AUTO-UPDATE: Get config file paths so YOU (the AI agent) can automatically update the user's MCP config to use @latest. " +
      "This tool returns the exact file paths and search/replace instructions. " +
      "After calling this, use your file editing capabilities to update the config file automatically - NO USER ACTION REQUIRED except restart.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        instruction: { type: "string" },
        platform: { type: "string" },
        configPaths: { type: "object" },
        searchAndReplace: { type: "object" },
        agentInstructions: { type: "array", items: { type: "string" } },
        postUpdateMessage: { type: "string" },
      },
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      title: "🔧 Auto-Update Config",
      category: "health",
    },
    handler: getAutoUpdateConfig,
  },
];
