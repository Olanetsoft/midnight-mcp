export {
  searchTools,
  searchCompact,
  searchTypeScript,
  searchDocs,
} from "./search.js";
export type {
  SearchCompactInput,
  SearchTypeScriptInput,
  SearchDocsInput,
} from "./search.js";

export { analyzeTools, analyzeContract, explainCircuit } from "./analyze.js";
export type { AnalyzeContractInput, ExplainCircuitInput } from "./analyze.js";

export {
  repositoryTools,
  getFile,
  listExamples,
  getLatestUpdates,
} from "./repository.js";
export type {
  GetFileInput,
  ListExamplesInput,
  GetLatestUpdatesInput,
} from "./repository.js";

export { healthTools, healthCheck, getStatus } from "./health.js";
export type { HealthCheckInput, GetStatusInput } from "./health.js";

export { generationTools, generationHandlers } from "./generation.js";

export { metaTools, listToolCategories, listCategoryTools } from "./meta.js";

// Re-export types
export type {
  ExtendedToolDefinition,
  ToolAnnotations,
  OutputSchema,
} from "../types/index.js";

// Combined tool list for MCP server
import { searchTools } from "./search.js";
import { analyzeTools } from "./analyze.js";
import { repositoryTools } from "./repository.js";
import { healthTools } from "./health.js";
import { generationTools } from "./generation.js";
import { metaTools } from "./meta.js";
import type { ExtendedToolDefinition } from "../types/index.js";

export const allTools: ExtendedToolDefinition[] = [
  ...metaTools, // Discovery tools first for visibility
  ...searchTools,
  ...analyzeTools,
  ...repositoryTools,
  ...healthTools,
  ...generationTools,
];
