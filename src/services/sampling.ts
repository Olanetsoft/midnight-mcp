/**
 * Sampling service for agentic workflows
 *
 * Enables the MCP server to request LLM completions from the client,
 * allowing for sophisticated multi-step workflows like:
 * - Auto-generating contracts from examples
 * - Code review with suggested fixes
 * - Documentation generation
 */

import { logger } from "../utils/index.js";
import type {
  SamplingRequest,
  SamplingResponse,
  ModelPreferences,
} from "../types/index.js";

// Type for the sampling callback
type SamplingCallback = (request: SamplingRequest) => Promise<SamplingResponse>;

// Store for the sampling callback
let samplingCallback: SamplingCallback | null = null;

// Track if sampling has permanently failed (client doesn't support it)
let samplingFailedPermanently = false;

/**
 * Check if sampling is available
 * Returns false if client doesn't support sampling (detected on first failed call)
 */
export function isSamplingAvailable(): boolean {
  if (samplingFailedPermanently) return false;
  return samplingCallback !== null;
}

/**
 * Mark sampling as permanently failed (client doesn't support it)
 */
export function markSamplingFailed(): void {
  samplingFailedPermanently = true;
  logger.warn("Sampling marked as permanently unavailable for this session");
}

/**
 * Register the sampling callback from the client
 * This is called during server initialization when client supports sampling
 */
export function registerSamplingCallback(callback: SamplingCallback): void {
  samplingCallback = callback;
  samplingFailedPermanently = false;
  logger.info("Sampling capability registered");
}

/**
 * Request a completion from the LLM via the client
 */
export async function requestCompletion(
  messages: { role: "user" | "assistant"; content: string }[],
  options: {
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
    modelPreferences?: ModelPreferences;
  } = {}
): Promise<string> {
  if (!samplingCallback || samplingFailedPermanently) {
    throw new Error(
      "Sampling not available - client does not support this capability"
    );
  }

  const request: SamplingRequest = {
    messages: messages.map((m) => ({
      role: m.role,
      content: { type: "text" as const, text: m.content },
    })),
    systemPrompt: options.systemPrompt,
    maxTokens: options.maxTokens ?? 2048,
    temperature: options.temperature ?? 0.7,
    modelPreferences: options.modelPreferences ?? {
      hints: [{ name: "claude-3-sonnet" }, { name: "gpt-4" }],
      intelligencePriority: 0.8,
      speedPriority: 0.5,
    },
  };

  logger.debug("Requesting LLM completion", {
    messageCount: messages.length,
    maxTokens: request.maxTokens,
  });

  try {
    const response = await samplingCallback(request);

    if (response.content.type !== "text") {
      throw new Error("Unexpected response content type");
    }

    return response.content.text;
  } catch (error: unknown) {
    const errorStr = String(error);

    // Check for "Method not found" error which indicates client doesn't support sampling
    if (
      errorStr.includes("-32601") ||
      errorStr.includes("Method not found") ||
      errorStr.includes("not supported")
    ) {
      logger.warn(
        "Client does not support sampling/createMessage, disabling sampling for this session"
      );
      markSamplingFailed();
      throw new Error(
        "Sampling not supported by this client - use Claude Desktop for this feature",
        { cause: error }
      );
    }

    throw error;
  }
}

/**
 * Generate a Compact contract based on requirements
 */
export async function generateContract(
  requirements: string,
  options: {
    baseExample?: string;
    contractType?: "counter" | "token" | "voting" | "custom";
  } = {}
): Promise<{
  code: string;
  explanation: string;
  warnings: string[];
}> {
  if (!isSamplingAvailable()) {
    return {
      code: "",
      explanation:
        "Sampling not available - this feature requires a client that supports the sampling capability (like Claude Desktop)",
      warnings: ["Feature unavailable without sampling support"],
    };
  }

  const systemPrompt = `You are an expert Compact smart contract developer for the Midnight blockchain.
Your task is to generate secure, well-documented Compact contracts based on user requirements.

Key Compact syntax (REQUIRED):
- \`export ledger field: Type;\` - Individual ledger declarations (NOT ledger { } blocks)
- \`export circuit fn(): []\` - Public functions return empty tuple [] (NOT Void)
- \`witness fn(): T;\` - Declaration only, no body
- \`pragma language_version >= 0.16 && <= 0.23;\` - Version pragma
- \`import CompactStandardLibrary;\` - Standard imports
- \`Counter\`, \`Map<K,V>\`, \`Set<T>\` - Built-in collection types  
- \`Field\`, \`Boolean\`, \`Uint<N>\`, \`Bytes<N>\` - Primitive types
- \`export enum State { a, b }\` - Enums must be exported

Key operations:
- Counter: .read(), .increment(n), .decrement(n)
- Map: .lookup(k), .insert(k,v), .remove(k)
- Set: .member(v), .insert(v), .remove(v)

COMPILER INFO (DO NOT guess package names!):
- Command: \`compact compile src/contract.compact managed/contract\`
- The \`compact\` CLI comes with Midnight toolchain (via create-mn-app or official install)
- Output goes to managed/<name>/ directory
- DO NOT suggest \`npm install -g @midnight-ntwrk/compact-cli\` or similar - that's incorrect

IMPORTANT - Style vs. Requirements:
- Syntax rules above are REQUIRED for compilation
- Style choices (indentation, comment style, line length) are CONVENTIONS, not requirements
- Single-line comments (//) are common in examples; block comments (/* */) may also work
- The docs don't specify indentation width - use consistent style

Return ONLY the Compact code, no explanations.`;

  const userPrompt = options.baseExample
    ? `Based on this example contract:
\`\`\`compact
${options.baseExample}
\`\`\`

Generate a new contract with these requirements:
${requirements}`
    : `Generate a Compact smart contract with these requirements:
${requirements}

Contract type: ${options.contractType || "custom"}`;

  try {
    const code = await requestCompletion(
      [{ role: "user", content: userPrompt }],
      {
        systemPrompt,
        maxTokens: 4096,
        temperature: 0.3, // Lower temperature for code generation
        modelPreferences: {
          hints: [{ name: "claude-3-sonnet" }],
          intelligencePriority: 0.9,
          speedPriority: 0.3,
        },
      }
    );

    // Extract code from markdown if wrapped
    const extractedCode = code.includes("```")
      ? code
          .replace(/```compact?\n?/g, "")
          .replace(/```/g, "")
          .trim()
      : code.trim();

    // Generate explanation
    const explanation = await requestCompletion(
      [
        {
          role: "user",
          content: `Briefly explain what this Compact contract does (2-3 sentences):
\`\`\`compact
${extractedCode}
\`\`\``,
        },
      ],
      {
        systemPrompt:
          "You are a Compact contract documentation expert. Be concise.",
        maxTokens: 256,
        temperature: 0.5,
      }
    );

    return {
      code: extractedCode,
      explanation: explanation.trim(),
      warnings: [],
    };
  } catch (error: unknown) {
    logger.error("Contract generation failed", { error: String(error) });
    return {
      code: "",
      explanation: `Contract generation failed: ${String(error)}`,
      warnings: ["Generation failed - check logs for details"],
    };
  }
}

/**
 * Review contract code and suggest improvements
 */
export async function reviewContract(code: string): Promise<{
  summary: string;
  issues: Array<{
    severity: "error" | "warning" | "info";
    line?: number;
    message: string;
    suggestion?: string;
  }>;
  improvedCode?: string;
}> {
  if (!isSamplingAvailable()) {
    return {
      summary: "Code review requires sampling capability",
      issues: [
        {
          severity: "info",
          message:
            "This feature requires a client that supports the sampling capability",
        },
      ],
    };
  }

  const systemPrompt = `You are a Compact smart contract security auditor.
Review the provided contract for:
1. Security vulnerabilities
2. Privacy concerns (improper handling of shielded state)
3. Logic errors
4. Syntax errors (use "error" severity)
5. Performance issues

IMPORTANT - Distinguish between:
- ERRORS: Actual syntax/compilation issues (e.g., using Void instead of [], ledger {} blocks)
- WARNINGS: Potential bugs or security issues
- INFO: Style suggestions and best practices (these are CONVENTIONS, not requirements)

Do NOT claim style choices as "violations" - the Compact docs don't specify:
- Indentation width (2 vs 4 spaces)
- Comment style preferences (//, /* */)
- Line length limits
- Naming conventions

These are project-specific style choices, not language requirements.

Respond in JSON format:
{
  "summary": "Brief summary of the contract and overall quality",
  "issues": [
    {
      "severity": "error|warning|info",
      "line": optional_line_number,
      "message": "Description of the issue",
      "suggestion": "How to fix it"
    }
  ],
  "improvedCode": "Full improved contract code if changes are needed"
}`;

  try {
    const response = await requestCompletion(
      [
        {
          role: "user",
          content: `Review this Compact contract:\n\`\`\`compact\n${code}\n\`\`\``,
        },
      ],
      {
        systemPrompt,
        maxTokens: 4096,
        temperature: 0.2,
      }
    );

    // Parse JSON response with error handling
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        // Validate expected structure
        return {
          summary:
            typeof parsed.summary === "string"
              ? parsed.summary
              : "Review complete",
          issues: Array.isArray(parsed.issues) ? parsed.issues : [],
          improvedCode:
            typeof parsed.improvedCode === "string"
              ? parsed.improvedCode
              : undefined,
        };
      } catch (parseError) {
        logger.warn("Failed to parse JSON from LLM response", {
          error: String(parseError),
        });
        return {
          summary: response,
          issues: [],
        };
      }
    }

    return {
      summary: response,
      issues: [],
    };
  } catch (error: unknown) {
    logger.error("Contract review failed", { error: String(error) });
    return {
      summary: `Review failed: ${String(error)}`,
      issues: [
        {
          severity: "error",
          message: "Review failed - check logs for details",
        },
      ],
    };
  }
}

/**
 * Generate documentation for a contract
 */
export async function generateDocumentation(
  code: string,
  format: "markdown" | "jsdoc" = "markdown"
): Promise<string> {
  if (!isSamplingAvailable()) {
    return "Documentation generation requires sampling capability";
  }

  const systemPrompt =
    format === "markdown"
      ? `Generate comprehensive Markdown documentation for this Compact contract.
Include:
- Overview and purpose
- State variables (with privacy annotations)
- Circuit functions with parameters and effects
- Witness functions
- Usage examples
- Security considerations`
      : `Generate JSDoc-style documentation comments for this Compact contract.
Add documentation comments above each:
- Ledger field
- Circuit function
- Witness function
- Type definition`;

  try {
    return await requestCompletion(
      [
        {
          role: "user",
          content: `Generate ${format} documentation for:\n\`\`\`compact\n${code}\n\`\`\``,
        },
      ],
      {
        systemPrompt,
        maxTokens: 4096,
        temperature: 0.5,
      }
    );
  } catch (error: unknown) {
    logger.error("Documentation generation failed", { error: String(error) });
    return `Documentation generation failed: ${String(error)}`;
  }
}
