/**
 * Contract generation tool using sampling capability
 *
 * Enables AI-assisted generation and review of Compact smart contracts
 */

import { z } from "zod";
import {
  generateContract,
  reviewContract,
  generateDocumentation,
  isSamplingAvailable,
} from "../services/index.js";
import type { ExtendedToolDefinition, OutputSchema } from "../types/index.js";

// Input schemas
const generateContractSchema = z.object({
  requirements: z
    .string()
    .describe("Natural language description of the contract requirements"),
  contractType: z
    .enum(["counter", "token", "voting", "custom"])
    .optional()
    .describe("Type of contract to generate"),
  baseExample: z
    .string()
    .optional()
    .describe("Example contract code to use as a base"),
});

const reviewContractSchema = z.object({
  code: z.string().describe("Compact contract code to review"),
});

const documentContractSchema = z.object({
  code: z.string().describe("Compact contract code to document"),
  format: z
    .enum(["markdown", "jsdoc"])
    .optional()
    .describe("Documentation format (default: markdown)"),
});

// Output schemas for structured responses
const generateContractOutputSchema: OutputSchema = {
  type: "object",
  properties: {
    code: {
      type: "string",
      description: "Generated Compact contract code",
    },
    explanation: {
      type: "string",
      description: "Brief explanation of what the contract does",
    },
    warnings: {
      type: "array",
      items: { type: "string" },
      description: "Any warnings or notes about the generated code",
    },
    samplingAvailable: {
      type: "boolean",
      description: "Whether sampling capability was available",
    },
  },
  required: ["code", "explanation", "warnings", "samplingAvailable"],
};

const reviewContractOutputSchema: OutputSchema = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description: "Summary of the contract review",
    },
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          severity: {
            type: "string",
            enum: ["error", "warning", "info"],
          },
          line: { type: "number" },
          message: { type: "string" },
          suggestion: { type: "string" },
        },
      },
      description: "List of issues found",
    },
    improvedCode: {
      type: "string",
      description: "Improved version of the contract if applicable",
    },
    samplingAvailable: {
      type: "boolean",
      description: "Whether sampling capability was available",
    },
  },
  required: ["summary", "issues", "samplingAvailable"],
};

const documentContractOutputSchema: OutputSchema = {
  type: "object",
  properties: {
    documentation: {
      type: "string",
      description: "Generated documentation",
    },
    format: {
      type: "string",
      description: "Format of the documentation",
    },
    samplingAvailable: {
      type: "boolean",
      description: "Whether sampling capability was available",
    },
  },
  required: ["documentation", "format", "samplingAvailable"],
};

// Handler functions
async function handleGenerateContract(
  args: z.infer<typeof generateContractSchema>
) {
  const result = await generateContract(args.requirements, {
    contractType: args.contractType,
    baseExample: args.baseExample,
  });

  return {
    ...result,
    samplingAvailable: isSamplingAvailable(),
  };
}

async function handleReviewContract(
  args: z.infer<typeof reviewContractSchema>
) {
  const result = await reviewContract(args.code);

  return {
    ...result,
    samplingAvailable: isSamplingAvailable(),
  };
}

async function handleDocumentContract(
  args: z.infer<typeof documentContractSchema>
) {
  const documentation = await generateDocumentation(
    args.code,
    args.format || "markdown"
  );

  return {
    documentation,
    format: args.format || "markdown",
    samplingAvailable: isSamplingAvailable(),
  };
}

// Tool definitions
export const generationTools: ExtendedToolDefinition[] = [
  {
    name: "midnight-generate-contract",
    description: `🔮 AI-POWERED CONTRACT GENERATION

Generates Compact smart contracts from natural language requirements.
Uses the client's LLM through MCP sampling to create contracts.

REQUIREMENTS FORMAT:
- Describe what the contract should do
- Specify state variables needed
- Define access control requirements
- List the operations/circuits needed

CONTRACT TYPES:
• counter - Simple counter with increment/decrement
• token - Token with transfers and balances
• voting - Voting/governance mechanisms
• custom - Free-form custom contract

EXAMPLE USAGE:
"Create a token contract with private balances, mint/burn capabilities for admin, and transfer functionality between users"

⚠️ REQUIRES: Client with sampling capability (e.g., Claude Desktop)`,
    inputSchema: {
      type: "object",
      properties: {
        requirements: {
          type: "string",
          description:
            "Natural language description of the contract requirements",
        },
        contractType: {
          type: "string",
          enum: ["counter", "token", "voting", "custom"],
          description: "Type of contract to generate",
        },
        baseExample: {
          type: "string",
          description: "Example contract code to use as a base",
        },
      },
      required: ["requirements"],
    },
    outputSchema: generateContractOutputSchema,
    annotations: {
      title: "Generate Compact Contract",
      readOnlyHint: false,
      idempotentHint: false,
      openWorldHint: true,
      longRunningHint: true,
      category: "generation",
    },
    handler: handleGenerateContract,
  },
  {
    name: "midnight-review-contract",
    description: `🔍 AI-POWERED CONTRACT REVIEW

Performs security review and analysis of Compact smart contracts.
Uses the client's LLM to identify issues and suggest improvements.

CHECKS PERFORMED:
• Security vulnerabilities
• Privacy concerns (shielded state handling)
• Logic errors
• Best practice violations
• Performance issues

OUTPUT INCLUDES:
• Summary of contract quality
• List of issues with severity levels
• Suggested fixes for each issue
• Improved code version if applicable

⚠️ REQUIRES: Client with sampling capability (e.g., Claude Desktop)`,
    inputSchema: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description: "Compact contract code to review",
        },
      },
      required: ["code"],
    },
    outputSchema: reviewContractOutputSchema,
    annotations: {
      title: "Review Compact Contract",
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      longRunningHint: true,
      category: "generation",
    },
    handler: handleReviewContract,
  },
  {
    name: "midnight-document-contract",
    description: `📝 AI-POWERED DOCUMENTATION GENERATION

Generates comprehensive documentation for Compact smart contracts.
Uses the client's LLM to create detailed, human-readable docs.

FORMATS:
• markdown - Full Markdown documentation with examples
• jsdoc - JSDoc-style inline comments

MARKDOWN INCLUDES:
• Contract overview and purpose
• State variables with privacy annotations
• Circuit function documentation
• Witness function documentation
• Usage examples
• Security considerations

⚠️ REQUIRES: Client with sampling capability (e.g., Claude Desktop)`,
    inputSchema: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description: "Compact contract code to document",
        },
        format: {
          type: "string",
          enum: ["markdown", "jsdoc"],
          description: "Documentation format (default: markdown)",
        },
      },
      required: ["code"],
    },
    outputSchema: documentContractOutputSchema,
    annotations: {
      title: "Generate Contract Documentation",
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      longRunningHint: true,
      category: "generation",
    },
    handler: handleDocumentContract,
  },
];

// Export handler map
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const generationHandlers: Record<string, (args: any) => Promise<any>> = {
  "midnight-generate-contract": handleGenerateContract,
  "midnight-review-contract": handleReviewContract,
  "midnight-document-contract": handleDocumentContract,
};
