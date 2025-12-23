/**
 * Meta-tools for progressive disclosure and tool discovery
 * These tools help AI agents efficiently discover and use available capabilities
 */

import type {
  ExtendedToolDefinition,
  OutputSchema,
  ToolCategory,
} from "../types/index.js";

// Import all tool arrays to build the index
import { searchTools } from "./search.js";
import { analyzeTools } from "./analyze.js";
import { repositoryTools } from "./repository.js";
import { healthTools } from "./health.js";
import { generationTools } from "./generation.js";

// ============================================================================
// Tool Category Descriptions
// ============================================================================

const CATEGORY_INFO: Record<
  ToolCategory,
  { description: string; useCases: string[] }
> = {
  search: {
    description:
      "Semantic search across Midnight codebase - find code by meaning, not keywords",
    useCases: [
      "Find example implementations",
      "Search for patterns",
      "Discover relevant code",
    ],
  },
  analyze: {
    description:
      "Static analysis of Compact contracts - security, structure, patterns",
    useCases: [
      "Security audit",
      "Code review",
      "Understand contract structure",
    ],
  },
  repository: {
    description: "Access repository files, examples, and recent updates",
    useCases: [
      "Get specific files",
      "List examples",
      "Track repository changes",
    ],
  },
  versioning: {
    description:
      "Version management, breaking changes, and migration assistance",
    useCases: [
      "Check for updates",
      "Plan upgrades",
      "Compare versions",
      "Get migration guides",
    ],
  },
  generation: {
    description:
      "AI-powered code generation, review, and documentation (requires sampling)",
    useCases: ["Generate contracts", "Review code", "Generate documentation"],
  },
  health: {
    description: "Server health checks and status monitoring",
    useCases: ["Check API status", "Monitor rate limits", "Debug connectivity"],
  },
  compound: {
    description:
      "Multi-step operations in a single call - saves tokens and reduces latency",
    useCases: [
      "Full upgrade analysis",
      "Get complete repo context",
      "One-shot operations",
    ],
  },
};

// ============================================================================
// Input/Output Schemas
// ============================================================================

interface ListCategoriesInput {
  includeToolCounts?: boolean;
}

interface ListCategoryToolsInput {
  category: ToolCategory;
  includeSchemas?: boolean;
}

const listCategoriesOutputSchema: OutputSchema = {
  type: "object",
  properties: {
    categories: {
      type: "array",
      description: "Available tool categories",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Category identifier" },
          description: {
            type: "string",
            description: "What the category does",
          },
          toolCount: { type: "number", description: "Number of tools" },
          useCases: {
            type: "array",
            description: "When to use this category",
            items: { type: "string" },
          },
        },
      },
    },
    totalTools: { type: "number", description: "Total tool count" },
    recommendation: {
      type: "string",
      description: "Suggested starting point",
    },
  },
  required: ["categories", "totalTools"],
  description: "Tool categories for progressive discovery",
};

const listCategoryToolsOutputSchema: OutputSchema = {
  type: "object",
  properties: {
    category: { type: "string", description: "Category name" },
    tools: {
      type: "array",
      description: "Tools in this category",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Tool name" },
          description: { type: "string", description: "What the tool does" },
          title: { type: "string", description: "Human-readable title" },
          isCompound: {
            type: "boolean",
            description: "Whether this is a compound tool",
          },
          requiresSampling: {
            type: "boolean",
            description: "Requires client sampling capability",
          },
        },
      },
    },
    suggestion: { type: "string", description: "Usage suggestion" },
  },
  required: ["category", "tools"],
  description: "Tools within a specific category",
};

// ============================================================================
// Handler Functions
// ============================================================================

// Build tool index by category
function getToolsByCategory(): Map<ToolCategory, ExtendedToolDefinition[]> {
  const allTools = [
    ...searchTools,
    ...analyzeTools,
    ...repositoryTools,
    ...healthTools,
    ...generationTools,
  ];

  const byCategory = new Map<ToolCategory, ExtendedToolDefinition[]>();

  for (const tool of allTools) {
    const category = tool.annotations?.category || "repository";
    if (!byCategory.has(category)) {
      byCategory.set(category, []);
    }
    byCategory.get(category)!.push(tool);
  }

  return byCategory;
}

/**
 * List available tool categories
 * Use this first to understand what's available before drilling into specific tools
 */
export async function listToolCategories(_input: ListCategoriesInput) {
  const toolsByCategory = getToolsByCategory();

  const categories = Object.entries(CATEGORY_INFO).map(([name, info]) => ({
    name,
    description: info.description,
    toolCount: toolsByCategory.get(name as ToolCategory)?.length || 0,
    useCases: info.useCases,
  }));

  // Filter out empty categories
  const nonEmptyCategories = categories.filter((c) => c.toolCount > 0);

  const totalTools = nonEmptyCategories.reduce(
    (sum, c) => sum + c.toolCount,
    0
  );

  return {
    categories: nonEmptyCategories,
    totalTools,
    recommendation:
      "Start with 'compound' category for efficient multi-step operations, or 'search' to find relevant code.",
    tip: "Use midnight-list-category-tools to see tools within a specific category.",
  };
}

/**
 * List tools within a specific category
 * Progressive disclosure: drill into a category to see its tools
 */
export async function listCategoryTools(input: ListCategoryToolsInput) {
  const toolsByCategory = getToolsByCategory();
  const tools = toolsByCategory.get(input.category) || [];

  if (tools.length === 0) {
    return {
      error: `Unknown or empty category: ${input.category}`,
      availableCategories: Object.keys(CATEGORY_INFO),
      suggestion:
        "Use midnight-list-tool-categories to see available categories.",
    };
  }

  const categoryInfo = CATEGORY_INFO[input.category];

  return {
    category: input.category,
    description: categoryInfo.description,
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description.split("\n")[0], // First line only
      title: t.annotations?.title || t.name,
      isCompound: t.annotations?.category === "compound",
      requiresSampling:
        t.annotations?.longRunningHint &&
        t.annotations?.category === "generation",
      ...(input.includeSchemas && {
        inputSchema: t.inputSchema,
        outputSchema: t.outputSchema,
      }),
    })),
    suggestion: generateCategorySuggestion(input.category),
  };
}

function generateCategorySuggestion(category: ToolCategory): string {
  switch (category) {
    case "compound":
      return "🚀 Compound tools save 50-70% tokens. Use midnight-upgrade-check or midnight-get-repo-context for efficient operations.";
    case "search":
      return "💡 Search tools use semantic matching - describe what you want in natural language.";
    case "generation":
      return "⚠️ Generation tools require sampling capability. They use the client's LLM for AI-powered operations.";
    case "versioning":
      return "📦 For version checks, prefer midnight-upgrade-check (compound) over individual version tools.";
    case "analyze":
      return "🔍 Analyze tools work on Compact code. Provide the contract source code directly.";
    default:
      return `Use these tools for ${CATEGORY_INFO[category]?.useCases[0] || "related operations"}.`;
  }
}

// ============================================================================
// Tool Definitions
// ============================================================================

export const metaTools: ExtendedToolDefinition[] = [
  {
    name: "midnight-list-tool-categories",
    description:
      "📋 DISCOVERY TOOL: List available tool categories for progressive exploration. Use this FIRST to understand what capabilities are available, then drill into specific categories with midnight-list-category-tools. Reduces cognitive load by organizing 21 tools into 7 logical groups.",
    inputSchema: {
      type: "object" as const,
      properties: {
        includeToolCounts: {
          type: "boolean",
          description: "Include number of tools per category (default: true)",
        },
      },
      required: [],
    },
    outputSchema: listCategoriesOutputSchema,
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      title: "📋 List Tool Categories",
      category: "health" as ToolCategory,
    },
    handler: listToolCategories,
  },
  {
    name: "midnight-list-category-tools",
    description:
      "📋 DISCOVERY TOOL: List tools within a specific category. Use after midnight-list-tool-categories to see detailed tool information for a category of interest. Supports progressive disclosure pattern.",
    inputSchema: {
      type: "object" as const,
      properties: {
        category: {
          type: "string",
          enum: [
            "search",
            "analyze",
            "repository",
            "versioning",
            "generation",
            "health",
            "compound",
          ],
          description: "Category to list tools for",
        },
        includeSchemas: {
          type: "boolean",
          description: "Include input/output schemas (default: false)",
        },
      },
      required: ["category"],
    },
    outputSchema: listCategoryToolsOutputSchema,
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      title: "📋 List Category Tools",
      category: "health" as ToolCategory,
    },
    handler: listCategoryTools,
  },
];
