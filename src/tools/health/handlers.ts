/**
 * Health handler functions
 * Business logic for health-related MCP tools
 */

import * as os from "os";
import * as path from "path";
import {
  getHealthStatus,
  getQuickHealthStatus,
  getRateLimitStatus,
} from "../../utils/index.js";
import { searchCache, fileCache, metadataCache } from "../../utils/cache.js";
import type {
  HealthCheckInput,
  GetStatusInput,
  CheckVersionInput,
  AutoUpdateConfigInput,
  GetUpdateInstructionsInput,
} from "./schemas.js";

import { CURRENT_VERSION } from "../../utils/version.js";

/**
 * Perform health check on the MCP server
 */
export async function healthCheck(input: HealthCheckInput) {
  if (input.detailed) {
    const status = await getHealthStatus();
    return {
      ...status,
      // Return the structured object (not a formatted string) so the value
      // conforms to the tool's outputSchema, which declares rateLimit as an object.
      rateLimit: getRateLimitStatus(),
      cacheStats: {
        search: searchCache.getStats(),
        file: fileCache.getStats(),
        metadata: metadataCache.getStats(),
      },
    };
  }

  return {
    ...getQuickHealthStatus(),
    rateLimit: getRateLimitStatus(),
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
 * True if `candidate` is a strictly newer semver than `base` (major.minor.patch).
 */
function isNewerVersion(candidate: string, base: string): boolean {
  const a = candidate.split(".").map((n) => parseInt(n, 10) || 0);
  const b = base.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
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
    // Up to date unless npm has a STRICTLY newer version. Prevents a local
    // build that is ahead of the last publish (e.g. an unpublished version
    // bump) from being wrongly reported as outdated.
    const isUpToDate = !isNewerVersion(latestVersion, CURRENT_VERSION);

    // Only include updateInstructions/newFeatures when actually outdated.
    // Omitting them (rather than returning null) keeps the result conformant
    // with the tool's outputSchema, which declares them as object/array.
    const result: {
      currentVersion: string;
      latestVersion: string;
      isUpToDate: boolean;
      message: string;
      updateInstructions?: Record<string, string>;
      newFeatures?: string[];
    } = {
      currentVersion: CURRENT_VERSION,
      latestVersion,
      isUpToDate,
      message: isUpToDate
        ? "✅ You are running the latest published version. Note: midnight-mcp is deprecated — migrate to Kapa (docs Q&A) + Midnight Expert (dev): https://docs.midnight.network/blog/migrating-to-kapa-and-midnight-expert"
        : `⚠️ A newer version (v${latestVersion}) exists, but midnight-mcp is deprecated — migrate to Kapa (docs Q&A) + Midnight Expert (dev): https://docs.midnight.network/blog/migrating-to-kapa-and-midnight-expert`,
    };

    if (!isUpToDate) {
      result.updateInstructions = {
        note: "midnight-mcp is deprecated; updating is not recommended.",
        kapa:
          "claude mcp add --transport http midnight https://midnight.mcp.kapa.ai",
        midnightExpert:
          "curl -fsSL https://midnightntwrk.expert/install.sh | bash",
        guide:
          "https://docs.midnight.network/blog/migrating-to-kapa-and-midnight-expert",
      };
      result.newFeatures = [
        "midnight-mcp is deprecated — see the migration guide for the official replacements.",
      ];
    }

    return result;
  } catch (error: unknown) {
    return {
      currentVersion: CURRENT_VERSION,
      latestVersion: "unknown",
      isUpToDate: true,
      error: `Failed to check version: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

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

/**
 * Supported editors list
 */
const SUPPORTED_EDITORS = [
  "claude-desktop",
  "cursor",
  "vscode",
  "windsurf",
] as const;

/**
 * Get platform-specific npm cache clear command
 */
function getNpmCacheClearCommand(platform: string): string {
  if (platform === "windows") {
    return 'Remove-Item -Recurse -Force "$env:USERPROFILE\\.npm\\_npx" -ErrorAction SilentlyContinue';
  }
  return "rm -rf ~/.npm/_npx";
}

/**
 * Get detailed, platform-specific update instructions
 */
export async function getUpdateInstructions(
  input: GetUpdateInstructionsInput
): Promise<object> {
  const platform =
    input.platform === "auto" ? detectPlatform() : input.platform;

  // If editor is "auto", return instructions for ALL supported editors
  if (input.editor === "auto") {
    return getMultiEditorInstructions(platform);
  }

  // Single editor mode
  const editor = input.editor;
  const configPaths = getConfigPaths(platform, editor);
  const restartCommand = getRestartCommand(platform, editor);
  const cacheCommand = getNpmCacheClearCommand(platform);

  return {
    title: "🔄 How to Update Midnight MCP",
    currentSetup: {
      detectedPlatform: platform,
      targetEditor: editor,
    },
    steps: [
      {
        step: 1,
        title: "Clear npm cache",
        command: cacheCommand,
        windowsNote:
          platform === "windows"
            ? "Run in PowerShell. For cmd.exe use: rd /s /q %USERPROFILE%\\.npm\\_npx"
            : undefined,
        explanation:
          "This removes cached npx packages so the latest version will be downloaded",
        required: true,
      },
      {
        step: 2,
        title: "Restart your editor completely",
        action: restartCommand,
        explanation:
          "A full restart is needed - just reloading the window is not enough",
        required: true,
      },
      {
        step: 3,
        title: "If still outdated, update config file",
        configPath: configPaths.primary,
        alternativePaths: configPaths.alternatives,
        change: {
          find: '"midnight-mcp"',
          replaceWith: '"midnight-mcp@latest"',
          location: 'In the "args" array for the midnight server',
        },
        explanation: "Adding @latest ensures you always get the newest version",
        required: false,
      },
    ],
    troubleshooting: getTroubleshootingSection(platform, configPaths),
    exampleConfig: generateExampleConfig(editor),
    helpfulLinks: {
      documentation: "https://github.com/Olanetsoft/midnight-mcp#readme",
      issues: "https://github.com/Olanetsoft/midnight-mcp/issues",
    },
  };
}

/**
 * Get instructions for all supported editors
 */
function getMultiEditorInstructions(platform: string): object {
  const cacheCommand = getNpmCacheClearCommand(platform);

  const editorConfigs = SUPPORTED_EDITORS.map((editor) => {
    const paths = getConfigPaths(platform, editor);
    const restart = getRestartCommand(platform, editor);
    return {
      editor,
      displayName: getEditorDisplayName(editor),
      configPath: paths.primary,
      alternativePaths: paths.alternatives,
      restartCommand: restart,
    };
  });

  return {
    title: "🔄 How to Update Midnight MCP",
    currentSetup: {
      detectedPlatform: platform,
      targetEditor: "all (auto mode)",
    },
    commonSteps: [
      {
        step: 1,
        title: "Clear npm cache",
        command: cacheCommand,
        windowsNote:
          platform === "windows"
            ? "Run in PowerShell. For cmd.exe use: rd /s /q %USERPROFILE%\\.npm\\_npx"
            : undefined,
        explanation:
          "This removes cached npx packages so the latest version will be downloaded",
        required: true,
      },
      {
        step: 2,
        title: "Restart your editor completely",
        explanation:
          "A full restart is needed - just reloading the window is not enough",
        required: true,
      },
    ],
    editorSpecificPaths: editorConfigs,
    configChange: {
      find: '"midnight-mcp"',
      replaceWith: '"midnight-mcp@latest"',
      location: 'In the "args" array for the midnight server',
    },
    troubleshooting: [
      {
        issue: "Still seeing old version after restart",
        solutions: [
          platform === "mac"
            ? "Make sure you quit the editor completely (Cmd+Q)"
            : platform === "windows"
              ? "Make sure you quit the editor completely (Alt+F4)"
              : "Make sure you quit the editor completely",
          "Check if multiple editor instances are running",
          platform === "windows"
            ? 'Try: Remove-Item -Recurse -Force "$env:USERPROFILE\\.npm\\_npx", "$env:LOCALAPPDATA\\midnight-mcp"'
            : "Try: rm -rf ~/.npm/_npx && rm -rf ~/.cache/midnight-mcp",
        ],
      },
      {
        issue: "Config file not found",
        solutions: [
          "Check the editor-specific paths listed above",
          "Create the config file if it doesn't exist",
          "See docs: https://github.com/Olanetsoft/midnight-mcp",
        ],
      },
    ],
    exampleConfig: {
      mcpServers: {
        midnight: {
          command: "npx",
          args: ["-y", "midnight-mcp@latest"],
        },
      },
    },
    helpfulLinks: {
      documentation: "https://github.com/Olanetsoft/midnight-mcp#readme",
      issues: "https://github.com/Olanetsoft/midnight-mcp/issues",
    },
  };
}

function getEditorDisplayName(editor: string): string {
  const names: Record<string, string> = {
    "claude-desktop": "Claude Desktop",
    cursor: "Cursor",
    vscode: "VS Code",
    windsurf: "Windsurf",
  };
  return names[editor] || editor;
}

function getTroubleshootingSection(
  platform: string,
  configPaths: { primary: string; alternatives: string[] }
): object[] {
  const quitCommand =
    platform === "mac"
      ? "Cmd+Q"
      : platform === "windows"
        ? "Alt+F4"
        : "close completely";
  const cacheCleanup =
    platform === "windows"
      ? 'Remove-Item -Recurse -Force "$env:USERPROFILE\\.npm\\_npx", "$env:LOCALAPPDATA\\midnight-mcp"'
      : "rm -rf ~/.npm/_npx && rm -rf ~/.cache/midnight-mcp";

  return [
    {
      issue: "Still seeing old version after restart",
      solutions: [
        `Make sure you quit the editor completely (${quitCommand})`,
        "Check if multiple editor instances are running",
        `Try: ${cacheCleanup}`,
      ],
    },
    {
      issue: "Config file not found",
      solutions: [
        `Primary location: ${configPaths.primary}`,
        "Create it if it doesn't exist",
        "See docs: https://github.com/Olanetsoft/midnight-mcp",
      ],
    },
    {
      issue: "Permission denied errors",
      solutions:
        platform === "windows"
          ? [
              "Run editor as administrator",
              "Check file permissions in Windows Security settings",
            ]
          : [
              "Check file permissions with ls -la",
              "Ensure your user owns the config file",
            ],
    },
  ];
}

function detectPlatform(): "mac" | "windows" | "linux" {
  const p = process.platform;
  if (p === "darwin") return "mac";
  if (p === "win32") return "windows";
  return "linux";
}

function getConfigPaths(
  platform: string,
  editor: string
): { primary: string; alternatives: string[] } {
  const home = process.env.HOME || process.env.USERPROFILE || "~";

  const paths: Record<
    string,
    Record<string, { primary: string; alternatives: string[] }>
  > = {
    mac: {
      "claude-desktop": {
        primary: `${home}/Library/Application Support/Claude/claude_desktop_config.json`,
        alternatives: [],
      },
      cursor: {
        primary: `${home}/.cursor/mcp.json`,
        alternatives: [`${home}/Library/Application Support/Cursor/mcp.json`],
      },
      vscode: {
        primary: `${home}/.vscode/mcp.json`,
        alternatives: [
          `${home}/Library/Application Support/Code/User/settings.json`,
        ],
      },
      windsurf: {
        primary: `${home}/.codeium/windsurf/mcp_config.json`,
        alternatives: [],
      },
    },
    windows: {
      "claude-desktop": {
        primary: `%APPDATA%\\Claude\\claude_desktop_config.json`,
        alternatives: [],
      },
      cursor: {
        primary: `%USERPROFILE%\\.cursor\\mcp.json`,
        alternatives: [`%APPDATA%\\Cursor\\mcp.json`],
      },
      vscode: {
        primary: `%USERPROFILE%\\.vscode\\mcp.json`,
        alternatives: [`%APPDATA%\\Code\\User\\settings.json`],
      },
      windsurf: {
        primary: `%USERPROFILE%\\.codeium\\windsurf\\mcp_config.json`,
        alternatives: [],
      },
    },
    linux: {
      "claude-desktop": {
        primary: `${home}/.config/Claude/claude_desktop_config.json`,
        alternatives: [],
      },
      cursor: {
        primary: `${home}/.cursor/mcp.json`,
        alternatives: [`${home}/.config/Cursor/mcp.json`],
      },
      vscode: {
        primary: `${home}/.vscode/mcp.json`,
        alternatives: [`${home}/.config/Code/User/settings.json`],
      },
      windsurf: {
        primary: `${home}/.codeium/windsurf/mcp_config.json`,
        alternatives: [],
      },
    },
  };

  return paths[platform]?.[editor] || paths.mac["claude-desktop"];
}

function getRestartCommand(platform: string, editor: string): string {
  const editorNames: Record<string, string> = {
    "claude-desktop": "Claude Desktop",
    cursor: "Cursor",
    vscode: "VS Code",
    windsurf: "Windsurf",
  };

  const name = editorNames[editor] || editor;

  if (platform === "mac") {
    return `Quit ${name} completely (Cmd+Q), then reopen`;
  } else if (platform === "windows") {
    return `Close ${name} completely (Alt+F4 or File > Exit), then reopen`;
  } else {
    return `Close ${name} completely, then reopen`;
  }
}

function generateExampleConfig(editor: string): object {
  const baseConfig = {
    mcpServers: {
      midnight: {
        command: "npx",
        args: ["-y", "midnight-mcp@latest"],
      },
    },
  };

  if (editor === "vscode") {
    return {
      note: "For VS Code, add to settings.json or mcp.json",
      config: baseConfig,
    };
  }

  return baseConfig;
}
