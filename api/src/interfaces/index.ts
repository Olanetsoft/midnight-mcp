/**
 * Shared type definitions for the Midnight MCP API
 */

// ============== Cloudflare Bindings ==============

export type Bindings = {
  VECTORIZE: VectorizeIndex;
  OPENAI_API_KEY: string;
  ENVIRONMENT: string;
  METRICS: KVNamespace;
  DASHBOARD_PASSWORD?: string;
  // Optional bearer token for private/self-hosted deployments. When set, all
  // routes except the health probes require `Authorization: Bearer <token>`.
  API_AUTH_TOKEN?: string;
};

// ============== Metrics Types ==============

export interface QueryLog {
  query: string;
  endpoint: string;
  timestamp: string;
  resultsCount: number;
  avgScore: number;
  topScore: number;
  language?: string;
}

export interface ToolCall {
  tool: string;
  timestamp: string;
  success: boolean;
  durationMs?: number;
  version?: string;
}

export interface Metrics {
  totalQueries: number;
  queriesByEndpoint: Record<string, number>;
  queriesByLanguage: Record<string, number>;
  avgRelevanceScore: number;
  scoreDistribution: { high: number; medium: number; low: number };
  recentQueries: QueryLog[];
  documentsByRepo: Record<string, number>;
  lastUpdated: string;
  // Tool tracking
  totalToolCalls: number;
  toolCallsByName: Record<string, number>;
  recentToolCalls: ToolCall[];
}

// ============== Search Types ==============

export interface SearchRequestBody {
  query: string;
  limit?: number;
  filter?: { language?: string };
}

export interface SearchResult {
  content: string;
  relevanceScore: number;
  source: {
    repository: string;
    filePath: string;
    lines?: string;
  };
  codeType?: string;
}

export interface SearchResponse {
  results: SearchResult[];
  query: string;
  totalResults: number;
}

// ============== OpenAI Types ==============

export interface EmbeddingResponse {
  data: Array<{ embedding: number[] }>;
}
