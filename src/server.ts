import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
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
} from "@modelcontextprotocol/sdk/types.js";

import { logger, formatErrorResponse } from "./utils/index.js";
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

// Server information - version should match package.json
const SERVER_INFO = {
  name: "midnight-mcp",
  version: "0.1.4",
  description: "MCP Server for Midnight Blockchain Development",
};

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
    },
  });

  // Register tool handlers
  registerToolHandlers(server);

  // Register resource handlers
  registerResourceHandlers(server);

  // Register prompt handlers
  registerPromptHandlers(server);

  // Register subscription handlers
  registerSubscriptionHandlers(server);

  // Setup sampling callback if available
  setupSampling(server);

  return server;
}

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
        description: tool.description,
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

    const tool = allTools.find((t) => t.name === name);
    if (!tool) {
      const availableTools = allTools
        .map((t) => t.name)
        .slice(0, 5)
        .join(", ");
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: `Unknown tool: ${name}`,
                suggestion: `Available tools include: ${availableTools}...`,
                hint: "Use ListTools to see all available tools",
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }

    try {
      const result = await tool.handler(args as never);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error(`Tool error: ${name}`, { error: String(error) });
      const errorResponse = formatErrorResponse(error, `tool:${name}`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(errorResponse, null, 2),
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
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(
                {
                  error: `Resource not found: ${uri}`,
                  suggestion: validPrefix
                    ? `Check the resource path after '${validPrefix}'`
                    : `Valid resource prefixes: ${resourceTypes.join(", ")}`,
                  hint: "Use ListResources to see all available resources",
                },
                null,
                2
              ),
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
    } catch (error) {
      logger.error(`Resource error: ${uri}`, { error: String(error) });
      const errorResponse = formatErrorResponse(error, `resource:${uri}`);
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(errorResponse, null, 2),
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
    } catch (error) {
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

  // Initialize vector store
  try {
    await vectorStore.initialize();
    logger.info("Vector store initialized");
  } catch (error) {
    logger.warn("Vector store initialization failed, continuing without it", {
      error: String(error),
    });
  }

  // Create and return server
  const server = createServer();
  logger.info("Server created successfully");

  return server;
}

/**
 * Start the server with stdio transport
 */
export async function startServer(): Promise<void> {
  const server = await initializeServer();

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info("Midnight MCP Server running on stdio");
}
