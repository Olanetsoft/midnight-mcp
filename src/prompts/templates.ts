export interface PromptDefinition {
  name: string;
  description: string;
  arguments: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
}

export interface PromptMessage {
  role: "user" | "assistant";
  content: {
    type: "text";
    text: string;
  };
}

// Prompt definitions
export const promptDefinitions: PromptDefinition[] = [
  {
    name: "midnight:create-contract",
    description:
      "Guided prompt for creating new Compact contracts with privacy considerations",
    arguments: [
      {
        name: "contractType",
        description: "Type of contract (token, voting, credential, custom)",
        required: true,
      },
      {
        name: "privacyLevel",
        description: "Required privacy features (full, partial, public)",
        required: false,
      },
      {
        name: "complexity",
        description:
          "Expected complexity level (beginner, intermediate, advanced)",
        required: false,
      },
    ],
  },
  {
    name: "midnight:review-contract",
    description:
      "Security and best practices review prompt for existing contracts",
    arguments: [
      {
        name: "contractCode",
        description: "The Compact contract code to review",
        required: true,
      },
      {
        name: "focusAreas",
        description:
          "Specific areas to emphasize (security, performance, privacy, readability)",
        required: false,
      },
    ],
  },
  {
    name: "midnight:explain-concept",
    description:
      "Educational prompt for explaining Midnight concepts at various levels",
    arguments: [
      {
        name: "concept",
        description:
          "The concept to explain (zk-proofs, circuits, witnesses, ledger, etc.)",
        required: true,
      },
      {
        name: "level",
        description: "Expertise level (beginner, intermediate, advanced)",
        required: false,
      },
    ],
  },
  {
    name: "midnight:compare-approaches",
    description:
      "Compare different implementation approaches for a given problem",
    arguments: [
      {
        name: "problem",
        description: "The problem to solve",
        required: true,
      },
      {
        name: "approaches",
        description: "Specific approaches to compare (comma-separated)",
        required: false,
      },
    ],
  },
  {
    name: "midnight:debug-contract",
    description: "Help debug issues with a Compact contract",
    arguments: [
      {
        name: "contractCode",
        description: "The contract code with issues",
        required: true,
      },
      {
        name: "errorMessage",
        description: "Error message or description of the issue",
        required: false,
      },
    ],
  },
];

/**
 * Generate prompt messages based on template and arguments
 */
export function generatePrompt(
  name: string,
  args: Record<string, string>
): PromptMessage[] {
  switch (name) {
    case "midnight:create-contract":
      return generateCreateContractPrompt(args);
    case "midnight:review-contract":
      return generateReviewContractPrompt(args);
    case "midnight:explain-concept":
      return generateExplainConceptPrompt(args);
    case "midnight:compare-approaches":
      return generateCompareApproachesPrompt(args);
    case "midnight:debug-contract":
      return generateDebugContractPrompt(args);
    default:
      return [
        {
          role: "user",
          content: {
            type: "text",
            text: `Unknown prompt: ${name}`,
          },
        },
      ];
  }
}

function generateCreateContractPrompt(
  args: Record<string, string>
): PromptMessage[] {
  const contractType = args.contractType || "custom";
  const privacyLevel = args.privacyLevel || "partial";
  const complexity = args.complexity || "intermediate";

  return [
    {
      role: "user",
      content: {
        type: "text",
        text: `I want to create a new Midnight Compact smart contract with the following requirements:

**Contract Type:** ${contractType}
**Privacy Level:** ${privacyLevel}
**Complexity:** ${complexity}

## ⚠️ MANDATORY WORKFLOW - Follow these steps IN ORDER:

### Step 1: Get Current Syntax
Call \`midnight-get-latest-syntax\` FIRST to get:
- The \`quickStartTemplate\` (use as your base)
- The \`commonMistakes\` array (avoid these errors)
- Current pragma format: \`pragma language_version >= 0.16 && <= 0.18;\`

### Step 2: Generate Contract
Based on syntax reference, generate the contract using:
- Individual ledger declarations: \`export ledger field: Type;\` (NOT \`ledger { }\` blocks)
- Empty tuple return: \`circuit fn(): []\` (NOT \`Void\`)
- Export enums: \`export enum State { ... }\`
- Wrap witness conditionals: \`if (disclose(witness == value))\`

### Step 3: Validate Before Returning
Call \`midnight-extract-contract-structure\` with your generated code to check for:
- deprecated_ledger_block
- invalid_void_type
- invalid_pragma_format
- unexported_enum
- deprecated_cell_wrapper

If ANY errors are found, fix them before returning the code to the user.

---

## Contract Requirements

Please help me design and implement this contract. Consider:

1. **State Design**
   - What should be public vs private (shielded)?
   - What data structures are needed?
   - How should state transitions work?

2. **Circuit Design**
   - What circuits (functions) are needed?
   - What inputs/outputs should they have?
   - What constraints and assertions are required?

3. **Witness Functions**
   - What off-chain data is needed?
   - How should private state be accessed?

4. **Privacy Considerations**
   - How to protect user privacy?
   - When to use disclose() vs commit()?
   - How to prevent information leakage?

5. **Security**
   - Access control mechanisms
   - Input validation
   - Protection against common vulnerabilities

Please provide:
- A complete contract implementation
- Explanation of design decisions
- Example usage scenarios
- Any security considerations`,
      },
    },
  ];
}

function generateReviewContractPrompt(
  args: Record<string, string>
): PromptMessage[] {
  const contractCode = args.contractCode || "// No code provided";
  const focusAreas = args.focusAreas || "security, privacy, best practices";

  return [
    {
      role: "user",
      content: {
        type: "text",
        text: `Please review this Midnight Compact smart contract:

\`\`\`compact
${contractCode}
\`\`\`

**Focus Areas:** ${focusAreas}

## ⚠️ MANDATORY WORKFLOW:

### Step 1: Validate Syntax
Call \`midnight-extract-contract-structure\` with the contract code to check for:
- deprecated_ledger_block (should use \`export ledger field: Type;\`)
- invalid_void_type (should use \`[]\` not \`Void\`)
- invalid_pragma_format (should use \`>= 0.16 && <= 0.18\`)
- unexported_enum (enums need \`export\`)
- deprecated_cell_wrapper

Report ALL static analysis findings first.

### Step 2: Get Latest Syntax Reference
If syntax errors are found, call \`midnight-get-latest-syntax\` to get:
- The \`commonMistakes\` array showing correct patterns
- Current syntax reference

---

Please analyze:

1. **Static Analysis Results** (from midnight-extract-contract-structure)
   - Syntax errors found
   - Deprecated patterns detected
   - Required fixes

2. **Security Analysis**
   - Input validation
   - Access control
   - State manipulation vulnerabilities
   - Assertion coverage

3. **Privacy Assessment**
   - Proper use of @private state
   - Information leakage risks
   - Correct use of disclose() and commit()
   - Privacy guarantees provided

4. **Best Practices**
   - Code organization
   - Naming conventions
   - Documentation
   - Error messages

5. **Performance**
   - Circuit complexity
   - State access patterns
   - Optimization opportunities

6. **Recommendations**
   - Critical issues to fix (start with P0 syntax errors)
   - Improvements to consider
   - Alternative approaches

Please provide specific line references and code suggestions where applicable.`,
      },
    },
  ];
}

function generateExplainConceptPrompt(
  args: Record<string, string>
): PromptMessage[] {
  const concept = args.concept || "zero-knowledge proofs";
  const level = args.level || "intermediate";

  const levelDescriptions: Record<string, string> = {
    beginner:
      "Explain like I'm new to blockchain and cryptography. Use analogies and avoid jargon.",
    intermediate:
      "I understand blockchain basics and some cryptography. Focus on practical applications.",
    advanced:
      "I have deep technical knowledge. Include implementation details and edge cases.",
  };

  return [
    {
      role: "user",
      content: {
        type: "text",
        text: `Please explain the concept of **${concept}** in the context of Midnight blockchain.

**My Level:** ${level}
${levelDescriptions[level] || levelDescriptions.intermediate}

Please cover:

1. **What it is**
   - Clear definition
   - How it works in Midnight

2. **Why it matters**
   - Benefits and use cases
   - Real-world applications

3. **How to use it**
   - Code examples in Compact
   - Best practices

4. **Common pitfalls**
   - Mistakes to avoid
   - Debugging tips

5. **Further learning**
   - Related concepts
   - Resources for deeper understanding`,
      },
    },
  ];
}

function generateCompareApproachesPrompt(
  args: Record<string, string>
): PromptMessage[] {
  const problem = args.problem || "implementing a token contract";
  const approaches = args.approaches || "";

  return [
    {
      role: "user",
      content: {
        type: "text",
        text: `I need to solve the following problem in Midnight:

**Problem:** ${problem}

${approaches ? `**Approaches to compare:** ${approaches}` : "Please suggest different implementation approaches."}

Please compare:

1. **Approach Overview**
   - Brief description of each approach
   - Key differences

2. **Privacy Implications**
   - What data is exposed?
   - Privacy guarantees

3. **Performance**
   - Proof generation time
   - State storage requirements
   - Transaction costs

4. **Security**
   - Attack surface
   - Trust assumptions

5. **Code Complexity**
   - Implementation difficulty
   - Maintenance burden

6. **Recommendation**
   - Best approach for different scenarios
   - Trade-offs to consider

Please include code examples for each approach.`,
      },
    },
  ];
}

function generateDebugContractPrompt(
  args: Record<string, string>
): PromptMessage[] {
  const contractCode = args.contractCode || "// No code provided";
  const errorMessage = args.errorMessage || "Not specified";

  return [
    {
      role: "user",
      content: {
        type: "text",
        text: `I'm having issues with this Midnight Compact contract:

\`\`\`compact
${contractCode}
\`\`\`

**Error/Issue:** ${errorMessage}

## ⚠️ MANDATORY WORKFLOW:

### Step 1: Run Static Analysis
Call \`midnight-extract-contract-structure\` FIRST to check for common syntax errors:
- deprecated_ledger_block → should use \`export ledger field: Type;\`
- invalid_void_type → should use \`[]\` not \`Void\`
- invalid_pragma_format → should use \`>= 0.16 && <= 0.18\`
- unexported_enum → enums need \`export\` keyword

### Step 2: Get Correct Syntax
If syntax errors found, call \`midnight-get-latest-syntax\` to get:
- The \`commonMistakes\` array with correct patterns
- Current \`quickStartTemplate\` for reference

---

Please help me debug by:

1. **Static Analysis Results**
   - Run midnight-extract-contract-structure
   - List all P0 syntax errors found
   - Show the correct syntax for each error

2. **Identifying the Problem**
   - What's causing the error?
   - Which line(s) are problematic?

3. **Explaining Why**
   - Root cause analysis
   - How Compact/ZK constraints work

4. **Providing a Fix**
   - Corrected code (validated against static analysis)
   - Explanation of changes

5. **Preventing Future Issues**
   - Related pitfalls to watch for
   - Testing strategies

6. **Additional Improvements**
   - Code quality suggestions
   - Best practices`,
      },
    },
  ];
}

/**
 * List all available prompts
 */
export function listPrompts(): PromptDefinition[] {
  return promptDefinitions;
}
