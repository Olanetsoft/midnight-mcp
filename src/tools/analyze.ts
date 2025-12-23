import { z } from "zod";
import { parseCompactFile, CodeUnit } from "../pipeline/index.js";
import { logger } from "../utils/index.js";
import type { ExtendedToolDefinition, OutputSchema } from "../types/index.js";

// Schema definitions
export const AnalyzeContractInputSchema = z.object({
  code: z.string().describe("Compact contract source code"),
  checkSecurity: z
    .boolean()
    .optional()
    .default(true)
    .describe("Run security analysis"),
});

export const ExplainCircuitInputSchema = z.object({
  circuitCode: z.string().describe("Circuit definition from Compact"),
});

export type AnalyzeContractInput = z.infer<typeof AnalyzeContractInputSchema>;
export type ExplainCircuitInput = z.infer<typeof ExplainCircuitInputSchema>;

interface SecurityFinding {
  severity: "info" | "warning" | "error";
  message: string;
  line?: number;
  suggestion?: string;
}

/**
 * Analyze a Compact smart contract for structure, patterns, and potential issues
 */
export async function analyzeContract(input: AnalyzeContractInput) {
  logger.debug("Analyzing Compact contract");

  const parsed = parseCompactFile("contract.compact", input.code);
  const findings: SecurityFinding[] = [];

  // Extract structured information
  const ledgerFields = parsed.codeUnits.filter((u) => u.type === "ledger");
  const circuits = parsed.codeUnits.filter((u) => u.type === "circuit");
  const witnesses = parsed.codeUnits.filter((u) => u.type === "witness");
  const types = parsed.codeUnits.filter((u) => u.type === "type");

  // Security analysis
  if (input.checkSecurity) {
    // Check for private state exposure
    const privateFields = ledgerFields.filter((f) => f.isPrivate);
    for (const field of privateFields) {
      // Check if private field is used in a public circuit without proper protection
      for (const circuit of circuits) {
        if (circuit.isPublic && circuit.code.includes(field.name)) {
          if (
            !circuit.code.includes("disclose") &&
            !circuit.code.includes("commit")
          ) {
            findings.push({
              severity: "warning",
              message: `Private field '${field.name}' used in public circuit '${circuit.name}' without disclose/commit`,
              suggestion:
                "Consider using disclose() or commit() to properly handle private data",
            });
          }
        }
      }
    }

    // Check for missing access control on state-modifying circuits
    for (const circuit of circuits) {
      if (circuit.isPublic) {
        const modifiesState =
          circuit.code.includes(".insert") ||
          circuit.code.includes(".increment") ||
          circuit.code.includes(".decrement") ||
          circuit.code.includes("=");

        if (modifiesState && !circuit.code.includes("assert")) {
          findings.push({
            severity: "info",
            message: `Public circuit '${circuit.name}' modifies state without assertions`,
            suggestion:
              "Consider adding assertions to validate inputs and permissions",
          });
        }
      }
    }

    // Check for unused witnesses
    for (const witness of witnesses) {
      let isUsed = false;
      for (const circuit of circuits) {
        if (circuit.code.includes(witness.name)) {
          isUsed = true;
          break;
        }
      }
      if (!isUsed) {
        findings.push({
          severity: "info",
          message: `Witness '${witness.name}' is defined but not used in any circuit`,
          suggestion: "Remove unused witnesses or implement their usage",
        });
      }
    }

    // Check for common patterns
    if (!parsed.imports.includes("std")) {
      findings.push({
        severity: "info",
        message: "Standard library not imported",
        suggestion: "Consider adding 'include \"std\";' for common utilities",
      });
    }
  }

  // Generate summary
  const summary = {
    hasLedger: parsed.metadata.hasLedger,
    hasCircuits: parsed.metadata.hasCircuits,
    hasWitnesses: parsed.metadata.hasWitnesses,
    totalLines: parsed.metadata.lineCount,
    publicCircuits: circuits.filter((c) => c.isPublic).length,
    privateCircuits: circuits.filter((c) => !c.isPublic).length,
    publicState: ledgerFields.filter((f) => !f.isPrivate).length,
    privateState: ledgerFields.filter((f) => f.isPrivate).length,
  };

  return {
    summary,
    structure: {
      imports: parsed.imports,
      exports: parsed.exports,
      ledger: ledgerFields.map((f) => ({
        name: f.name,
        type: f.returnType,
        isPrivate: f.isPrivate,
      })),
      circuits: circuits.map((c) => ({
        name: c.name,
        isPublic: c.isPublic,
        parameters: c.parameters,
        returnType: c.returnType,
      })),
      witnesses: witnesses.map((w) => ({
        name: w.name,
        parameters: w.parameters,
        returnType: w.returnType,
      })),
      types: types.map((t) => ({
        name: t.name,
        definition: t.returnType,
      })),
    },
    securityFindings: findings,
    recommendations:
      findings.length === 0
        ? ["Contract structure looks good! No issues found."]
        : findings.map((f) => f.suggestion).filter(Boolean),
  };
}

/**
 * Explain what a specific circuit does in plain language
 */
export async function explainCircuit(input: ExplainCircuitInput) {
  logger.debug("Explaining circuit");

  const parsed = parseCompactFile("circuit.compact", input.circuitCode);
  const circuit = parsed.codeUnits.find((u) => u.type === "circuit");

  if (!circuit) {
    return {
      error: "No circuit definition found in the provided code",
      suggestion:
        "Make sure to provide a complete circuit definition including 'circuit' keyword",
    };
  }

  // Analyze the circuit
  const operations: string[] = [];
  const zkImplications: string[] = [];

  // Detect common operations
  if (circuit.code.includes("disclose")) {
    operations.push("Reveals private data selectively (disclose)");
    zkImplications.push(
      "Data revealed via disclose() will be visible on-chain while proving possession of private data"
    );
  }

  if (circuit.code.includes("commit")) {
    operations.push("Creates cryptographic commitments (commit)");
    zkImplications.push(
      "Commitments allow hiding data while proving properties about it"
    );
  }

  if (circuit.code.includes("hash")) {
    operations.push("Computes cryptographic hashes (hash)");
    zkImplications.push(
      "Hashes are computed in-circuit and can be verified without revealing preimages"
    );
  }

  if (circuit.code.includes("assert")) {
    operations.push("Validates constraints (assert)");
    zkImplications.push(
      "Assertions create ZK constraints - the proof will fail if any assertion fails"
    );
  }

  if (circuit.code.includes(".insert")) {
    operations.push("Inserts data into ledger storage");
  }

  if (circuit.code.includes(".increment")) {
    operations.push("Increments a counter value");
  }

  if (circuit.code.includes(".decrement")) {
    operations.push("Decrements a counter value");
  }

  // Build explanation
  const explanation = buildCircuitExplanation(circuit, operations);

  return {
    circuitName: circuit.name,
    isPublic: circuit.isPublic,
    parameters: circuit.parameters,
    returnType: circuit.returnType,
    explanation,
    operations,
    zkImplications:
      zkImplications.length > 0
        ? zkImplications
        : [
            "This circuit generates a zero-knowledge proof that the computation was performed correctly",
          ],
    privacyConsiderations: getPrivacyConsiderations(circuit),
  };
}

function buildCircuitExplanation(
  circuit: CodeUnit,
  operations: string[]
): string {
  let explanation = `The circuit '${circuit.name}' is a `;

  if (circuit.isPublic) {
    explanation += "public (exported) function that can be called by anyone. ";
  } else {
    explanation += "private (internal) function used by other circuits. ";
  }

  if (circuit.parameters && circuit.parameters.length > 0) {
    explanation += `It takes ${circuit.parameters.length} parameter(s): `;
    explanation += circuit.parameters
      .map((p) => `${p.name} (${p.type})`)
      .join(", ");
    explanation += ". ";
  }

  if (circuit.returnType && circuit.returnType !== "Void") {
    explanation += `It returns a value of type ${circuit.returnType}. `;
  }

  if (operations.length > 0) {
    explanation += `\n\nKey operations performed:\n`;
    operations.forEach((op, i) => {
      explanation += `${i + 1}. ${op}\n`;
    });
  }

  return explanation;
}

function getPrivacyConsiderations(circuit: CodeUnit): string[] {
  const considerations: string[] = [];

  if (circuit.code.includes("disclose")) {
    considerations.push(
      "Uses disclose() - some private data will be revealed on-chain"
    );
  }

  if (circuit.isPublic) {
    considerations.push(
      "Public circuit - anyone can call this and generate proofs"
    );
  }

  if (circuit.code.includes("@private") || circuit.code.includes("witness")) {
    considerations.push(
      "Accesses private state or witnesses - ensure sensitive data is handled correctly"
    );
  }

  if (considerations.length === 0) {
    considerations.push(
      "No specific privacy concerns identified in this circuit"
    );
  }

  return considerations;
}

// Output schemas for analysis tools - aligned with actual function return types
const analyzeContractOutputSchema: OutputSchema = {
  type: "object",
  properties: {
    summary: {
      type: "object",
      description: "Summary statistics of the contract",
      properties: {
        hasLedger: { type: "boolean" },
        hasCircuits: { type: "boolean" },
        hasWitnesses: { type: "boolean" },
        totalLines: { type: "number" },
        publicCircuits: { type: "number" },
        privateCircuits: { type: "number" },
        publicState: { type: "number" },
        privateState: { type: "number" },
      },
    },
    structure: {
      type: "object",
      description: "Contract structure breakdown",
      properties: {
        imports: { type: "array", items: { type: "string" } },
        exports: { type: "array", items: { type: "string" } },
        ledger: {
          type: "array",
          description: "Ledger state fields",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              type: { type: "string" },
              isPrivate: { type: "boolean" },
            },
          },
        },
        circuits: {
          type: "array",
          description: "Circuit definitions",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              isPublic: { type: "boolean" },
              parameters: { type: "array", items: { type: "object" } },
              returnType: { type: "string" },
            },
          },
        },
        witnesses: {
          type: "array",
          description: "Witness functions",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              parameters: { type: "array", items: { type: "object" } },
              returnType: { type: "string" },
            },
          },
        },
        types: {
          type: "array",
          description: "Type definitions",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              definition: { type: "string" },
            },
          },
        },
      },
    },
    securityFindings: {
      type: "array",
      description: "Security analysis findings",
      items: {
        type: "object",
        properties: {
          severity: {
            type: "string",
            enum: ["info", "warning", "error"],
          },
          message: { type: "string" },
          suggestion: { type: "string" },
        },
      },
    },
    recommendations: {
      type: "array",
      items: { type: "string" },
      description: "Recommendations for improvement",
    },
  },
  required: ["summary", "structure", "securityFindings", "recommendations"],
  description: "Detailed contract analysis with security findings",
};

const explainCircuitOutputSchema: OutputSchema = {
  type: "object",
  properties: {
    circuitName: { type: "string", description: "Circuit name" },
    isPublic: { type: "boolean", description: "Whether it's exported" },
    parameters: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          type: { type: "string" },
        },
      },
      description: "Circuit parameters",
    },
    returnType: { type: "string", description: "Return type" },
    explanation: {
      type: "string",
      description: "Plain language explanation",
    },
    operations: {
      type: "array",
      items: { type: "string" },
      description: "Operations performed by the circuit",
    },
    zkImplications: {
      type: "array",
      items: { type: "string" },
      description: "Zero-knowledge proof implications",
    },
    privacyConsiderations: {
      type: "array",
      items: { type: "string" },
      description: "Privacy-related considerations",
    },
  },
  required: [
    "circuitName",
    "explanation",
    "zkImplications",
    "privacyConsiderations",
  ],
  description: "Detailed circuit explanation with privacy analysis",
};

// Tool definitions for MCP
export const analyzeTools: ExtendedToolDefinition[] = [
  {
    name: "midnight-analyze-contract",
    description:
      "Analyze a Compact smart contract for structure, patterns, and potential security issues. Returns detailed breakdown of circuits, witnesses, ledger state, and recommendations.",
    inputSchema: {
      type: "object" as const,
      properties: {
        code: {
          type: "string",
          description: "Compact contract source code to analyze",
        },
        checkSecurity: {
          type: "boolean",
          description: "Run security analysis (default: true)",
        },
      },
      required: ["code"],
    },
    outputSchema: analyzeContractOutputSchema,
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      title: "Analyze Compact Contract",
      category: "analyze",
    },
    handler: analyzeContract,
  },
  {
    name: "midnight-explain-circuit",
    description:
      "Explain what a specific Compact circuit does in plain language, including its zero-knowledge proof implications and privacy considerations.",
    inputSchema: {
      type: "object" as const,
      properties: {
        circuitCode: {
          type: "string",
          description: "Circuit definition from Compact to explain",
        },
      },
      required: ["circuitCode"],
    },
    outputSchema: explainCircuitOutputSchema,
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      title: "Explain Circuit",
      category: "analyze",
    },
    handler: explainCircuit,
  },
];
