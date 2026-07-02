import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListResourceTemplatesRequestSchema,
  SubscribeRequestSchema,
  UnsubscribeRequestSchema,
  SetLevelRequestSchema,
  LoggingLevel,
  CompleteRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import express, { type Request, type Response } from "express";
import { randomUUID } from "crypto";

import {
  logger,
  formatErrorResponse,
  setMCPLogCallback,
  trackToolCall,
  serialize,
} from "./utils/index.js";
import { vectorStore } from "./db/index.js";
import { allTools } from "./tools/index.js";
import {
  allResources,
  getDocumentation,
  getCode,
  getSchema,
} from "./resources/index.js";
import { promptDefinitions, generatePrompt } from "./prompts/index.js";
import { registerSamplingCallback } from "./services/index.js";
import type {
  ResourceTemplate,
  SamplingRequest,
  SamplingResponse,
} from "./types/index.js";

import { CURRENT_VERSION } from "./utils/version.js";
const SERVER_INFO = {
  name: "midnight-mcp",
  version: CURRENT_VERSION,
  description: "MCP Server for Midnight Blockchain Development",
};

// Version check state. midnight-mcp is deprecated, so it stays at the initial
// "not outdated" value — see checkForUpdates below.
const versionCheckResult: {
  isOutdated: boolean;
  latestVersion: string;
  updateMessage: string | null;
  lastChecked: number;
} = {
  isOutdated: false,
  latestVersion: CURRENT_VERSION,
  updateMessage: null,
  lastChecked: 0,
};

// Tool call counter for periodic version checks
let toolCallCount = 0;
const VERSION_CHECK_INTERVAL = 10; // Re-check every 10 tool calls

/**
 * Version-update check — disabled.
 *
 * midnight-mcp is deprecated, so it does not nag users to update to a
 * retired npm package. The deprecation notice on every tool description and
 * the midnight-new-mcp tool are the only "what to use instead" signal. Kept as
 * a no-op so existing callers (startup + periodic) don't need to change.
 */
async function checkForUpdates(): Promise<void> {
  return;
}

/**
 * Periodic version check - runs every N tool calls
 */
function maybeCheckForUpdates(): void {
  toolCallCount++;
  if (toolCallCount >= VERSION_CHECK_INTERVAL) {
    toolCallCount = 0;
    // Only re-check if last check was > 5 minutes ago
    const fiveMinutes = 5 * 60 * 1000;
    if (Date.now() - versionCheckResult.lastChecked > fiveMinutes) {
      checkForUpdates().catch((error: unknown) => {
        logger.debug("Periodic version check failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
  }
}

/**
 * Get update warning if outdated (to include in responses)
 */
export function getUpdateWarning(): string | null {
  return versionCheckResult.updateMessage;
}

// Resource subscriptions tracking
const resourceSubscriptions = new Set<string>();

/**
 * Clear all subscriptions (useful for server restart/testing)
 */
export function clearSubscriptions(): void {
  resourceSubscriptions.clear();
  logger.debug("Subscriptions cleared");
}

// Resource templates for parameterized resources (RFC 6570 URI Templates)
const resourceTemplates: ResourceTemplate[] = [
  {
    uriTemplate: "midnight://code/{owner}/{repo}/{path}",
    name: "Repository Code",
    title: "📄 Repository Code Files",
    description:
      "Access code files from any Midnight repository by specifying owner, repo, and file path",
    mimeType: "text/plain",
  },
  {
    uriTemplate: "midnight://docs/{section}/{topic}",
    name: "Documentation",
    title: "📚 Documentation Sections",
    description:
      "Access documentation by section (guides, api, concepts) and topic",
    mimeType: "text/markdown",
  },
  {
    uriTemplate: "midnight://examples/{category}/{name}",
    name: "Example Contracts",
    title: "📝 Example Contracts",
    description:
      "Access example contracts by category (counter, bboard, token, voting) and name",
    mimeType: "text/x-compact",
  },
  {
    uriTemplate: "midnight://schema/{type}",
    name: "Schema Definitions",
    title: "🔧 Schema Definitions",
    description:
      "Access JSON schemas for contract AST, transactions, and proofs",
    mimeType: "application/json",
  },
];

/**
 * Create and configure the MCP server
 */
// Current MCP logging level (controlled by client)
let mcpLogLevel: LoggingLevel = "info";

// Server instance for sending notifications
let serverInstance: Server | null = null;

// Track if server is connected (can send notifications)
let isConnected = false;

/**
 * Mark server as connected (safe to send notifications)
 */
export function setServerConnected(connected: boolean): void {
  isConnected = connected;
}

/**
 * Send a log message to the MCP client
 * This allows clients to see server logs for debugging
 */
export function sendLogToClient(
  level: LoggingLevel,
  loggerName: string,
  data: unknown
): void {
  // Only send if server exists AND is connected
  if (!serverInstance || !isConnected) return;

  // Map levels to numeric values for comparison
  const levelValues: Record<LoggingLevel, number> = {
    debug: 0,
    info: 1,
    notice: 2,
    warning: 3,
    error: 4,
    critical: 5,
    alert: 6,
    emergency: 7,
  };

  // Only send if level meets threshold
  if (levelValues[level] < levelValues[mcpLogLevel]) return;

  try {
    serverInstance.notification({
      method: "notifications/message",
      params: {
        level,
        logger: loggerName,
        data,
      },
    });
  } catch (error: unknown) {
    logger.debug("Failed to send log notification to client", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Send a progress notification to the MCP client
 * Used for long-running operations like compound tools
 */
export function sendProgressNotification(
  progressToken: string | number,
  progress: number,
  total?: number,
  message?: string
): void {
  if (!serverInstance) return;

  try {
    serverInstance.notification({
      method: "notifications/progress",
      params: {
        progressToken,
        progress,
        ...(total !== undefined && { total }),
        ...(message && { message }),
      },
    });
  } catch (error: unknown) {
    logger.debug("Failed to send progress notification", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function createServer(): Server {
  const server = new Server(SERVER_INFO, {
    capabilities: {
      tools: {
        listChanged: true,
      },
      resources: {
        subscribe: true,
        listChanged: true,
      },
      prompts: {
        listChanged: true,
      },
      logging: {},
      completions: {},
    },
  });

  // Store server instance for logging notifications
  serverInstance = server;

  // Wire up MCP logging - send logger output to client
  setMCPLogCallback((level, loggerName, data) => {
    sendLogToClient(level as LoggingLevel, loggerName, data);
  });

  // Register tool handlers
  registerToolHandlers(server);

  // Register resource handlers
  registerResourceHandlers(server);

  // Register prompt handlers
  registerPromptHandlers(server);

  // Register subscription handlers
  registerSubscriptionHandlers(server);

  // Register logging handler
  registerLoggingHandler(server);

  // Register completions handler
  registerCompletionsHandler(server);

  // Setup sampling callback if available
  setupSampling(server);

  return server;
}

/**
 * Register logging handler for MCP logging capability
 */
function registerLoggingHandler(server: Server): void {
  server.setRequestHandler(SetLevelRequestSchema, async (request) => {
    const { level } = request.params;
    mcpLogLevel = level;
    logger.info(`MCP log level set to: ${level}`);
    sendLogToClient("info", "midnight-mcp", {
      message: `Log level changed to ${level}`,
    });
    return {};
  });
}

// Completion suggestions for prompt arguments
const COMPLETION_VALUES: Record<string, Record<string, string[]>> = {
  "midnight:create-contract": {
    contractType: [
      "token",
      "voting",
      "credential",
      "auction",
      "escrow",
      "custom",
    ],
    privacyLevel: ["full", "partial", "public"],
    complexity: ["beginner", "intermediate", "advanced"],
  },
  "midnight:review-contract": {
    focusAreas: [
      "security",
      "performance",
      "privacy",
      "readability",
      "gas-optimization",
    ],
  },
  "midnight:explain-concept": {
    concept: [
      "zk-proofs",
      "circuits",
      "witnesses",
      "ledger",
      "state-management",
      "privacy-model",
      "token-transfers",
      "merkle-trees",
    ],
    level: ["beginner", "intermediate", "advanced"],
  },
  "midnight:compare-approaches": {
    approaches: [
      "token-standards",
      "state-management",
      "privacy-patterns",
      "circuit-design",
    ],
  },
  "midnight:debug-contract": {
    errorType: [
      "compilation",
      "runtime",
      "logic",
      "privacy-leak",
      "state-corruption",
    ],
  },
};

/**
 * Register completions handler for argument autocompletion
 */
function registerCompletionsHandler(server: Server): void {
  server.setRequestHandler(CompleteRequestSchema, async (request) => {
    const { ref, argument } = request.params;

    if (ref.type !== "ref/prompt") {
      return { completion: { values: [], hasMore: false } };
    }

    const promptName = ref.name;
    const argName = argument.name;
    const currentValue = argument.value?.toLowerCase() || "";

    // Get completion values for this prompt/argument
    const promptCompletions = COMPLETION_VALUES[promptName];
    if (!promptCompletions) {
      return { completion: { values: [], hasMore: false } };
    }

    const argValues = promptCompletions[argName];
    if (!argValues) {
      return { completion: { values: [], hasMore: false } };
    }

    // Filter by current input
    const filtered = argValues.filter((v) =>
      v.toLowerCase().includes(currentValue)
    );

    return {
      completion: {
        values: filtered.slice(0, 20),
        total: filtered.length,
        hasMore: filtered.length > 20,
      },
    };
  });
}

/**
 * Prepended to every tool description so any client still using this MCP is
 * redirected to the official replacements (Kapa + Midnight Expert) at the point
 * of use. See the migration guide for details.
 */
const DEPRECATION_PREFIX =
  "[DEPRECATED] midnight-mcp is being retired — use Kapa (docs Q&A) + " +
  "Midnight Expert (dev): " +
  "https://docs.midnight.network/blog/migrating-to-kapa-and-midnight-expert — ";

/**
 * Register tool handlers
 */
function registerToolHandlers(server: Server): void {
  // List available tools with annotations and output schemas
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    logger.debug("Listing tools");
    return {
      tools: allTools.map((tool) => ({
        name: tool.name,
        description: DEPRECATION_PREFIX + tool.description,
        inputSchema: tool.inputSchema,
        // Include output schema if defined
        ...(tool.outputSchema && { outputSchema: tool.outputSchema }),
        // Include annotations if defined
        ...(tool.annotations && { annotations: tool.annotations }),
      })),
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    logger.info(`Tool called: ${name}`, { args });
    const startTime = Date.now();

    const tool = allTools.find((t) => t.name === name);
    if (!tool) {
      const availableTools = allTools
        .map((t) => t.name)
        .slice(0, 5)
        .join(", ");

      // Track failed tool call (unknown tool)
      trackToolCall(name, false, Date.now() - startTime, CURRENT_VERSION);

      return {
        content: [
          {
            type: "text",
            text: serialize({
              error: `Unknown tool: ${name}`,
              suggestion: `Available tools include: ${availableTools}...`,
              hint: "Use ListTools to see all available tools",
            }),
          },
        ],
        isError: true,
      };
    }

    try {
      const result = await tool.handler(args as never);
      const durationMs = Date.now() - startTime;

      // Track successful tool call (fire-and-forget, won't block response)
      trackToolCall(name, true, durationMs, CURRENT_VERSION);

      // Periodic version check (every N tool calls)
      maybeCheckForUpdates();

      // Include prominent update prompt in ALL responses when outdated
      const updateWarning = getUpdateWarning();

      if (updateWarning && versionCheckResult.isOutdated) {
        // Improved update notice with clear, actionable steps
        const updatePrompt = {
          "🚨 UPDATE REQUIRED": {
            current: `v${CURRENT_VERSION}`,
            latest: `v${versionCheckResult.latestVersion}`,
            quickFix: {
              description: "Most users just need these 2 steps:",
              step1: "Run in terminal: rm -rf ~/.npm/_npx",
              step2: "Restart editor completely (Cmd+Q / Alt+F4, then reopen)",
            },
            ifStillOld: {
              description: "If still showing old version after restart:",
              action: "Edit your MCP config file to use @latest:",
              change: 'Change "midnight-mcp" to "midnight-mcp@latest" in args',
              configFiles: {
                "Claude Desktop (Mac)":
                  "~/Library/Application Support/Claude/claude_desktop_config.json",
                "Claude Desktop (Win)":
                  "%APPDATA%/Claude/claude_desktop_config.json",
                Cursor: ".cursor/mcp.json",
                "VS Code": ".vscode/mcp.json",
                Windsurf: "~/.codeium/windsurf/mcp_config.json",
              },
            },
            tip: "Use 'midnight-get-update-instructions' tool for detailed platform-specific steps.",
          },
          result,
        };

        return {
          content: [
            {
              type: "text",
              text: serialize(updatePrompt),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: serialize(result),
          },
        ],
        // Include structured content for machine-readable responses
        // This allows clients to parse results without JSON.parse()
        structuredContent: result,
      };
    } catch (error: unknown) {
      const durationMs = Date.now() - startTime;
      logger.error(`Tool error: ${name}`, { error: String(error) });

      // Track failed tool call
      trackToolCall(name, false, durationMs, CURRENT_VERSION);

      const errorResponse = formatErrorResponse(error, `tool:${name}`);
      return {
        content: [
          {
            type: "text",
            text: serialize(errorResponse),
          },
        ],
        isError: true,
      };
    }
  });
}

/**
 * Register resource handlers
 */
function registerResourceHandlers(server: Server): void {
  // List available resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    logger.debug("Listing resources");
    return {
      resources: allResources.map((resource) => ({
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType,
      })),
    };
  });

  // List resource templates (RFC 6570 URI Templates)
  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
    logger.debug("Listing resource templates");
    return {
      resourceTemplates: resourceTemplates.map((template) => ({
        uriTemplate: template.uriTemplate,
        name: template.name,
        title: template.title,
        description: template.description,
        mimeType: template.mimeType,
      })),
    };
  });

  // Read resource content
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    logger.info(`Resource requested: ${uri}`);

    try {
      let content: string | null = null;
      let mimeType = "text/plain";

      if (uri.startsWith("midnight://docs/")) {
        content = await getDocumentation(uri);
        mimeType = "text/markdown";
      } else if (uri.startsWith("midnight://code/")) {
        content = await getCode(uri);
        mimeType = "text/x-compact";
      } else if (uri.startsWith("midnight://schema/")) {
        const schema = getSchema(uri);
        content = schema ? JSON.stringify(schema, null, 2) : null;
        mimeType = "application/json";
      }

      if (!content) {
        const resourceTypes = [
          "midnight://docs/",
          "midnight://code/",
          "midnight://schema/",
        ];
        const validPrefix = resourceTypes.find((p) => uri.startsWith(p));

        // Try to suggest correct URI for common mistakes
        let suggestion = validPrefix
          ? `Check the resource path after '${validPrefix}'`
          : `Valid resource prefixes: ${resourceTypes.join(", ")}`;

        // Handle common URI mistakes
        if (uri.includes("://resources/")) {
          const resourceName = uri.split("://resources/").pop() || "";
          // Suggest the correct prefix based on content type
          if (
            resourceName.includes("template") ||
            resourceName.includes("pattern") ||
            resourceName.includes("example")
          ) {
            suggestion = `Try: midnight://code/templates/${resourceName} or midnight://code/examples/${resourceName} or midnight://code/patterns/${resourceName}`;
          } else if (
            resourceName.includes("doc") ||
            resourceName.includes("reference") ||
            resourceName.includes("guide")
          ) {
            suggestion = `Try: midnight://docs/${resourceName}`;
          } else {
            suggestion = `'midnight://resources/' is not valid. Use: midnight://docs/, midnight://code/, or midnight://schema/`;
          }
        }

        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: serialize({
                error: `Resource not found: ${uri}`,
                suggestion,
                hint: "Use ListResources to see all available resources",
                validPrefixes: resourceTypes,
              }),
            },
          ],
        };
      }

      return {
        contents: [
          {
            uri,
            mimeType,
            text: content,
          },
        ],
      };
    } catch (error: unknown) {
      logger.error(`Resource error: ${uri}`, { error: String(error) });
      const errorResponse = formatErrorResponse(error, `resource:${uri}`);
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: serialize(errorResponse),
          },
        ],
      };
    }
  });
}

/**
 * Register prompt handlers
 */
function registerPromptHandlers(server: Server): void {
  // List available prompts
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    logger.debug("Listing prompts");
    return {
      prompts: promptDefinitions.map((prompt) => ({
        name: prompt.name,
        description: prompt.description,
        arguments: prompt.arguments,
      })),
    };
  });

  // Get prompt content
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    logger.info(`Prompt requested: ${name}`, { args });

    const prompt = promptDefinitions.find((p) => p.name === name);
    if (!prompt) {
      return {
        description: `Unknown prompt: ${name}`,
        messages: [],
      };
    }

    const messages = generatePrompt(name, args || {});

    return {
      description: prompt.description,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    };
  });
}

/**
 * Register resource subscription handlers
 */
function registerSubscriptionHandlers(server: Server): void {
  // Handle subscribe requests
  server.setRequestHandler(SubscribeRequestSchema, async (request) => {
    const { uri } = request.params;
    logger.info(`Subscribing to resource: ${uri}`);

    // Validate that the URI is a valid resource
    const validPrefixes = [
      "midnight://docs/",
      "midnight://code/",
      "midnight://schema/",
    ];
    const isValid = validPrefixes.some((prefix) => uri.startsWith(prefix));

    if (!isValid) {
      logger.warn(`Invalid subscription URI: ${uri}`);
      throw new Error(
        `Invalid subscription URI: ${uri}. Valid prefixes: ${validPrefixes.join(", ")}`
      );
    }

    resourceSubscriptions.add(uri);
    logger.debug(`Active subscriptions: ${resourceSubscriptions.size}`);

    return {};
  });

  // Handle unsubscribe requests
  server.setRequestHandler(UnsubscribeRequestSchema, async (request) => {
    const { uri } = request.params;
    logger.info(`Unsubscribing from resource: ${uri}`);

    resourceSubscriptions.delete(uri);
    logger.debug(`Active subscriptions: ${resourceSubscriptions.size}`);

    return {};
  });
}

/**
 * Notify subscribers when a resource changes
 * Call this when re-indexing or when docs are updated
 */
export function notifyResourceUpdate(server: Server, uri: string): void {
  if (resourceSubscriptions.has(uri)) {
    logger.info(`Notifying subscribers of update: ${uri}`);
    // Send notification via the server
    server.notification({
      method: "notifications/resources/updated",
      params: { uri },
    });
  }
}

/**
 * Get the list of active subscriptions
 */
export function getActiveSubscriptions(): string[] {
  return Array.from(resourceSubscriptions);
}

/**
 * Setup sampling capability
 * Registers a callback that allows the server to request LLM completions
 */
function setupSampling(server: Server): void {
  // Create a sampling callback that uses the server's request method
  const samplingCallback = async (
    request: SamplingRequest
  ): Promise<SamplingResponse> => {
    logger.debug("Requesting sampling from client", {
      messageCount: request.messages.length,
      maxTokens: request.maxTokens,
    });

    try {
      // Request completion from the client
      const response = await server.request(
        {
          method: "sampling/createMessage",
          params: {
            messages: request.messages,
            systemPrompt: request.systemPrompt,
            maxTokens: request.maxTokens || 2048,
            temperature: request.temperature,
            modelPreferences: request.modelPreferences,
          },
        },
        // Use a schema that matches the expected response
        {
          parse: (data: unknown) => {
            const response = data as SamplingResponse;
            // Basic validation of expected response structure
            if (!response || typeof response !== "object") {
              throw new Error("Invalid sampling response: expected object");
            }
            if (!response.content || typeof response.content !== "object") {
              throw new Error("Invalid sampling response: missing content");
            }
            return response;
          },
          _def: { typeName: "SamplingResponse" },
        } as never
      );

      return response;
    } catch (error: unknown) {
      logger.error("Sampling request failed", { error: String(error) });
      throw error;
    }
  };

  // Register the callback
  registerSamplingCallback(samplingCallback);
  logger.info("Sampling capability configured");
}

/**
 * Initialize the server and vector store
 */
export async function initializeServer(): Promise<Server> {
  logger.info("Initializing Midnight MCP Server...");

  // Check for updates in background (non-blocking)
  checkForUpdates().catch((error: unknown) => {
    logger.debug("Startup version check failed (non-blocking)", {
      error: error instanceof Error ? error.message : String(error),
    });
  });

  // Initialize vector store
  try {
    await vectorStore.initialize();
    logger.info("Vector store initialized");
  } catch (error: unknown) {
    logger.warn("Vector store initialization failed, continuing without it", {
      error: String(error),
    });
  }

  // Create and return server
  const server = createServer();
  logger.info(`Server v${CURRENT_VERSION} created successfully`);

  return server;
}

/**
 * Start the server with stdio transport
 */
export async function startServer(): Promise<void> {
  const server = await initializeServer();

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Now safe to send notifications
  setServerConnected(true);

  logger.info("Midnight MCP Server running on stdio");
}

// HTTP transport state
const transports = {
  streamable: {} as Record<string, StreamableHTTPServerTransport>,
  sse: {} as Record<string, SSEServerTransport>,
};

/**
 * Build the DNS-rebinding allowlist for a given port.
 *
 * The HTTP server binds to 127.0.0.1, so only loopback hosts are ever valid.
 * Derived from the actual port (not hardcoded) so non-default ports still work.
 * Host/Origin matching in the SDK is an exact string compare, so we list both
 * the `127.0.0.1` and `localhost` forms.
 */
export function buildAllowlist(port: number): {
  allowedHosts: string[];
  allowedOrigins: string[];
} {
  const hosts = [`127.0.0.1:${port}`, `localhost:${port}`];
  const origins = hosts.flatMap((host) => [
    `http://${host}`,
    `https://${host}`,
  ]);
  return { allowedHosts: hosts, allowedOrigins: origins };
}

/**
 * Decide whether a request's Host/Origin should be rejected as a possible
 * DNS-rebinding attempt. A present Host/Origin that is not in the allowlist is
 * blocked; an absent header (e.g. non-browser CLI clients) is allowed through,
 * matching the SDK's own behavior. Exported for testing.
 */
export function isRebindingBlocked(
  host: string | undefined,
  origin: string | undefined,
  allowedHosts: string[],
  allowedOrigins: string[]
): boolean {
  if (host && !allowedHosts.includes(host)) return true;
  if (origin && !allowedOrigins.includes(origin)) return true;
  return false;
}

/**
 * Close all active transports
 */
async function closeTransports(
  transportMap: Record<
    string,
    StreamableHTTPServerTransport | SSEServerTransport
  >
): Promise<void> {
  const closePromises = Object.values(transportMap).map((transport) =>
    transport.close?.().catch(() => {})
  );
  await Promise.all(closePromises);
}

/**
 * Start the server with HTTP transport (SSE + Streamable HTTP)
 */
export async function startHttpServer(port: number = 3000): Promise<void> {
  const mcpServer = await initializeServer();
  const app = express();

  // Allowlist for DNS-rebinding protection (loopback only, port-aware).
  const { allowedHosts, allowedOrigins } = buildAllowlist(port);

  // Parse JSON for the Streamable HTTP endpoint
  app.use("/mcp", express.json());

  // Health check endpoint
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      version: CURRENT_VERSION,
      transport: "http",
    });
  });

  // Streamable HTTP endpoint with session management
  app.post("/mcp", async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports.streamable[sessionId]) {
      // Reuse existing transport
      transport = transports.streamable[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // New session initialization
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        // Block DNS-rebinding attacks from browser pages (loopback allowlist).
        enableDnsRebindingProtection: true,
        allowedHosts,
        allowedOrigins,
        onsessioninitialized: (newSessionId) => {
          transports.streamable[newSessionId] = transport;
          logger.debug(`New streamable session: ${newSessionId}`);
        },
      });
      transport.onclose = () => {
        if (transport.sessionId) {
          delete transports.streamable[transport.sessionId];
          logger.debug(`Streamable session closed: ${transport.sessionId}`);
        }
      };
      try {
        await mcpServer.connect(transport);
      } catch (error: unknown) {
        logger.error("Failed to connect streamable transport", {
          error: String(error),
        });
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal error: connection failed" },
          id: null,
        });
        return;
      }
    } else {
      // Invalid request
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Bad Request: No valid session ID provided",
        },
        id: null,
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
  });

  // SSE endpoint for server-to-client notifications
  app.get("/sse", async (req: Request, res: Response) => {
    // The SDK validates POST /messages, but not the GET /sse stream itself.
    // Add a matching Host/Origin guard here for defense-in-depth.
    const host = req.headers.host;
    const origin = req.headers.origin;
    if (isRebindingBlocked(host, origin, allowedHosts, allowedOrigins)) {
      logger.warn(`Rejected SSE connection`, { host, origin });
      res.status(403).send("Forbidden: invalid Host or Origin");
      return;
    }

    logger.debug("New SSE connection");
    const transport = new SSEServerTransport("/messages", res, {
      enableDnsRebindingProtection: true,
      allowedHosts,
      allowedOrigins,
    });
    transports.sse[transport.sessionId] = transport;

    res.on("close", () => {
      delete transports.sse[transport.sessionId];
      logger.debug(`SSE session closed: ${transport.sessionId}`);
    });

    try {
      await mcpServer.connect(transport);
    } catch (error: unknown) {
      delete transports.sse[transport.sessionId];
      logger.error(`SSE connection failed: ${transport.sessionId}`, {
        error: String(error),
      });
      res.status(500).end();
    }
  });

  // SSE message endpoint
  app.post("/messages", async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;
    const transport = transports.sse[sessionId];

    if (transport) {
      await transport.handlePostMessage(req, res);
    } else {
      res.status(400).send(`No transport found for sessionId ${sessionId}`);
    }
  });

  // Handle GET/DELETE for session management
  const handleSessionRequest = async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports.streamable[sessionId]) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }

    const transport = transports.streamable[sessionId];
    await transport.handleRequest(req, res);
  };

  app.get("/mcp", handleSessionRequest);
  app.delete("/mcp", handleSessionRequest);

  // Start server
  const httpServer = app.listen(port, "127.0.0.1", () => {
    logger.info(`Midnight MCP Server running on HTTP port ${port}`);
    logger.info(`  Streamable HTTP: http://localhost:${port}/mcp`);
    logger.info(`  SSE endpoint:    http://localhost:${port}/sse`);
    logger.info(`  Health check:    http://localhost:${port}/health`);
  });

  // For HTTP mode, notifications are per-session (not global)
  // Don't set isConnected globally as there's no single connection

  // Graceful shutdown
  const shutdown = async () => {
    logger.info("Shutting down HTTP server...");
    await closeTransports(transports.sse);
    await closeTransports(transports.streamable);
    httpServer.close(() => {
      logger.info("Server shutdown complete");
      process.exit(0);
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
