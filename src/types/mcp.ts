/**
 * Extended MCP types for advanced features
 * Includes tool annotations, output schemas, and resource templates
 */

// ============================================================================
// Tool Annotations (MCP Spec 2025-06-18)
// ============================================================================

/**
 * Tool annotations provide hints about tool behavior
 * These help clients make better decisions about tool usage
 */
export interface ToolAnnotations {
  /**
   * If true, the tool does not modify any state
   * Clients can safely retry or parallelize read-only tools
   */
  readOnlyHint?: boolean;

  /**
   * If true, calling the tool multiple times with the same input
   * produces the same result (safe to retry)
   */
  idempotentHint?: boolean;

  /**
   * If true, the tool may return results from external sources
   * that could change over time
   */
  openWorldHint?: boolean;

  /**
   * If true, the tool may take a long time to complete
   * Clients should show progress indicators
   */
  longRunningHint?: boolean;

  /**
   * Human-readable title for display in UIs
   */
  title?: string;

  /**
   * If true, this tool performs destructive or irreversible actions
   * Clients should require human confirmation before execution
   */
  destructiveHint?: boolean;

  /**
   * If true, this tool requires explicit human confirmation
   * before execution (e.g., financial transactions, deletions)
   */
  requiresConfirmation?: boolean;

  /**
   * Tool category for progressive disclosure
   * Allows clients to group/filter tools by domain
   */
  category?: ToolCategory;
}

/**
 * Tool categories for progressive disclosure
 * Clients can initially show categories, then expand to individual tools
 */
export type ToolCategory =
  | "search" // Semantic search tools
  | "analyze" // Code analysis tools
  | "repository" // Repository operations
  | "versioning" // Version and migration tools
  | "generation" // AI-powered generation (requires sampling)
  | "health" // Health and status checks
  | "compound" // Multi-step compound operations
  | "validation"; // Contract validation tools

// ============================================================================
// Output Schemas
// ============================================================================

/**
 * JSON Schema for structured tool outputs
 * Enables better LLM parsing and IDE integration
 */
export interface OutputSchema {
  type: "object" | "array" | "string" | "number" | "boolean";
  properties?: Record<string, PropertySchema>;
  items?: PropertySchema;
  required?: string[];
  description?: string;
}

export interface PropertySchema {
  type: "string" | "number" | "boolean" | "array" | "object";
  description?: string;
  items?: PropertySchema;
  properties?: Record<string, PropertySchema>;
  enum?: string[];
}

// ============================================================================
// Extended Tool Definition
// ============================================================================

export interface ExtendedToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  outputSchema?: OutputSchema;
  annotations?: ToolAnnotations;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (input: any) => Promise<any>;
}

// ============================================================================
// Resource Templates (RFC 6570 URI Templates)
// ============================================================================

export interface ResourceTemplate {
  /**
   * URI template following RFC 6570
   * e.g., "midnight://code/{owner}/{repo}/{path}"
   */
  uriTemplate: string;

  /**
   * Human-readable name
   */
  name: string;

  /**
   * Human-readable title for display
   */
  title?: string;

  /**
   * Description of what resources this template provides
   */
  description: string;

  /**
   * MIME type of resources matching this template
   */
  mimeType: string;
}

// ============================================================================
// Resource Annotations
// ============================================================================

export interface ResourceAnnotations {
  /**
   * Intended audience for the resource
   * "user" = for human consumption
   * "assistant" = for LLM context
   */
  audience?: ("user" | "assistant")[];

  /**
   * Priority from 0.0 (optional) to 1.0 (required)
   */
  priority?: number;

  /**
   * ISO 8601 timestamp of last modification
   */
  lastModified?: string;
}

// ============================================================================
// Sampling Types
// ============================================================================

export interface SamplingRequest {
  messages: SamplingMessage[];
  systemPrompt?: string;
  modelPreferences?: ModelPreferences;
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
}

export interface SamplingMessage {
  role: "user" | "assistant";
  content: TextContent | ImageContent;
}

export interface TextContent {
  type: "text";
  text: string;
}

export interface ImageContent {
  type: "image";
  data: string;
  mimeType: string;
}

export interface ModelPreferences {
  hints?: { name: string }[];
  costPriority?: number;
  speedPriority?: number;
  intelligencePriority?: number;
}

export interface SamplingResponse {
  role: "assistant";
  content: TextContent;
  model: string;
  stopReason: "endTurn" | "maxTokens" | "stopSequence";
}

// ============================================================================
// Search Result Types (for output schemas)
// ============================================================================

export interface SearchResult {
  content: string;
  relevanceScore: number;
  source: {
    repository: string;
    filePath: string;
    lines: string;
  };
  codeType: string;
}

export interface SearchResponse {
  results: SearchResult[];
  totalResults: number;
  query: string;
  warnings?: string[];
}

export interface AnalysisResponse {
  name: string;
  type: string;
  summary: string;
  components: {
    name: string;
    type: string;
    description: string;
  }[];
  securityNotes: string[];
  recommendations: string[];
}
