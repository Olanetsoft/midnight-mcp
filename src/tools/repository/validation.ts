/**
 * Contract validation handlers
 * Static analysis for Compact contracts
 */

import { readFile } from "fs/promises";
import { basename, isAbsolute, resolve } from "path";
import { platform } from "process";
import { logger } from "../../utils/index.js";
import type { ExtractContractStructureInput } from "./schemas.js";

// ============================================================================
// SECURITY & VALIDATION HELPERS
// ============================================================================

/**
 * Validate file path for security - prevent path traversal attacks
 */
function validateFilePath(filePath: string): {
  valid: boolean;
  error?: string;
  normalizedPath?: string;
} {
  // Must be absolute path
  if (!isAbsolute(filePath)) {
    return {
      valid: false,
      error: "File path must be absolute (e.g., /Users/you/contract.compact)",
    };
  }

  // Resolve to catch ../ traversal
  const normalized = resolve(filePath);

  // Check for path traversal attempts
  // Simply check for ".." in the path - this is always suspicious in absolute paths
  if (filePath.includes("..")) {
    return {
      valid: false,
      error: "Path traversal detected - use absolute paths without ../",
    };
  }

  // Must end with .compact
  if (!normalized.endsWith(".compact")) {
    return {
      valid: false,
      error: "File must have .compact extension",
    };
  }

  // Block sensitive paths (Unix and Windows)
  const blockedPathsUnix = ["/etc", "/var", "/usr", "/bin", "/sbin", "/root"];
  const blockedPathsWindows = [
    "C:\\Windows",
    "C:\\Program Files",
    "C:\\Program Files (x86)",
    "C:\\System32",
    "C:\\ProgramData",
  ];
  const blockedPaths =
    platform === "win32" ? blockedPathsWindows : blockedPathsUnix;

  const normalizedLower = normalized.toLowerCase();
  if (
    blockedPaths.some((blocked) =>
      normalizedLower.startsWith(blocked.toLowerCase())
    )
  ) {
    return {
      valid: false,
      error: "Cannot access system directories",
    };
  }

  return { valid: true, normalizedPath: normalized };
}

/**
 * Check if content is valid UTF-8 text (not binary)
 */
function isValidUtf8Text(content: string): boolean {
  // Check for null bytes (common in binary files)
  if (content.includes("\x00")) {
    return false;
  }

  // Check for excessive non-printable characters
  const nonPrintable = content.match(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g);
  if (nonPrintable && nonPrintable.length > content.length * 0.01) {
    return false;
  }

  return true;
}

// ============================================================================
// CONTRACT STRUCTURE EXTRACTION
// ============================================================================

/**
 * Extract the structure of a Compact contract (circuits, witnesses, ledger, etc.)
 * This helps agents understand what a contract does without parsing it themselves
 */
export async function extractContractStructure(
  input: ExtractContractStructureInput
) {
  logger.debug("Extracting contract structure", {
    hasCode: !!input.code,
    filePath: input.filePath,
  });

  // Resolve code source
  let code: string;
  let filename: string;

  if (input.filePath) {
    // SECURITY: Validate file path
    const pathValidation = validateFilePath(input.filePath);
    if (!pathValidation.valid) {
      return {
        success: false,
        error: "Invalid file path",
        message: pathValidation.error,
      };
    }

    try {
      code = await readFile(pathValidation.normalizedPath!, "utf-8");
      filename = basename(pathValidation.normalizedPath!);

      // Check for binary content
      if (!isValidUtf8Text(code)) {
        return {
          success: false,
          error: "Invalid file content",
          message: "File appears to be binary or contains invalid characters",
        };
      }
    } catch (fsError: unknown) {
      const err = fsError as { code?: string; message?: string };
      return {
        success: false,
        error: "Failed to read file",
        message: `Cannot read file: ${input.filePath}`,
        details: err.code === "ENOENT" ? "File does not exist" : err.message,
      };
    }
  } else if (input.code) {
    code = input.code;
    filename = "contract.compact";

    // Check for binary content
    if (!isValidUtf8Text(code)) {
      return {
        success: false,
        error: "Invalid code content",
        message: "Code contains invalid characters",
      };
    }
  } else {
    return {
      success: false,
      error: "No contract provided",
      message: "Must provide either 'code' or 'filePath'",
    };
  }

  // Extract pragma version (supports >=, >, <=, <, ==, ~; >=? and <=? are ordered
  // so that >= and <= are matched before > and <)
  const pragmaMatch = code.match(
    /pragma\s+language_version\s*(?:>=?|<=?|==|~)\s*([\d.]+)/
  );
  const languageVersion = pragmaMatch ? pragmaMatch[1] : null;

  // Extract imports
  const imports: string[] = [];
  const importMatches = code.matchAll(/import\s+(\w+)|include\s+"([^"]+)"/g);
  for (const match of importMatches) {
    imports.push(match[1] || match[2]);
  }

  // Extract exported circuits
  const circuits: Array<{
    name: string;
    params: string[];
    returnType: string;
    isExport: boolean;
    line: number;
  }> = [];

  // Helper to split parameters handling nested angle brackets, square brackets, parentheses,
  // and string literals (e.g., Map<A, B>, [Field, Boolean], (x: Field) => Boolean, Opaque<"a, b">)
  const splitParams = (paramsStr: string): string[] => {
    const result: string[] = [];
    let current = "";
    let angleDepth = 0;
    let squareDepth = 0;
    let parenDepth = 0;
    let inString = false;
    let stringChar = "";

    for (let i = 0; i < paramsStr.length; i++) {
      const ch = paramsStr[i];

      // Handle string literals
      if (
        (ch === '"' || ch === "'") &&
        (i === 0 || paramsStr[i - 1] !== "\\")
      ) {
        if (!inString) {
          inString = true;
          stringChar = ch;
        } else if (ch === stringChar) {
          inString = false;
          stringChar = "";
        }
      }

      // Only track depth when not inside a string
      if (!inString) {
        if (ch === "<") angleDepth++;
        else if (ch === ">") angleDepth = Math.max(0, angleDepth - 1);
        else if (ch === "[") squareDepth++;
        else if (ch === "]") squareDepth = Math.max(0, squareDepth - 1);
        else if (ch === "(") parenDepth++;
        else if (ch === ")") parenDepth = Math.max(0, parenDepth - 1);
      }

      if (
        ch === "," &&
        !inString &&
        angleDepth === 0 &&
        squareDepth === 0 &&
        parenDepth === 0
      ) {
        if (current.trim()) result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    if (current.trim()) result.push(current.trim());
    return result;
  };

  // Use a more permissive pattern for return types to handle complex nested types
  // Note: [^)]* doesn't work for nested parens, so we use a manual extraction approach
  const circuitStartPattern = /(?:(export)\s+)?circuit\s+(\w+)\s*\(/g;
  const lines = code.split("\n");

  // Precompute a mapping from character index to 1-based line number to avoid
  // repeatedly scanning from the start of the string for each match.
  const lineByIndex: number[] = new Array(code.length);
  {
    let currentLine = 1;
    for (let i = 0; i < code.length; i++) {
      lineByIndex[i] = currentLine;
      if (code[i] === "\n") {
        currentLine++;
      }
    }
  }

  let circuitMatch;
  while ((circuitMatch = circuitStartPattern.exec(code)) !== null) {
    const lineNum = lineByIndex[circuitMatch.index];
    const isExport = circuitMatch[1] === "export";
    const name = circuitMatch[2];

    // Manually extract params by finding matching closing parenthesis
    const startIdx = circuitMatch.index + circuitMatch[0].length;
    let depth = 1;
    let endIdx = startIdx;
    while (endIdx < code.length && depth > 0) {
      if (code[endIdx] === "(") depth++;
      else if (code[endIdx] === ")") depth--;
      endIdx++;
    }
    const paramsStr = code.substring(startIdx, endIdx - 1);
    const params = splitParams(paramsStr);

    // Extract return type after ): until { or newline or ;
    const afterParams = code.substring(endIdx);
    const returnTypeMatch = afterParams.match(/^\s*:\s*([^{\n;]+)/);
    const returnType = returnTypeMatch ? returnTypeMatch[1].trim() : "[]";

    circuits.push({
      name,
      params,
      returnType,
      isExport,
      line: lineNum,
    });
  }

  // Extract witnesses
  const witnesses: Array<{
    name: string;
    type: string;
    isExport: boolean;
    line: number;
  }> = [];
  const witnessPattern = /(?:(export)\s+)?witness\s+(\w+)\s*:\s*([^;]+)/g;

  let witnessMatch;
  while ((witnessMatch = witnessPattern.exec(code)) !== null) {
    const lineNum = lineByIndex[witnessMatch.index];
    witnesses.push({
      name: witnessMatch[2],
      type: witnessMatch[3].trim(),
      isExport: witnessMatch[1] === "export",
      line: lineNum,
    });
  }

  // Extract ledger items
  const ledgerItems: Array<{
    name: string;
    type: string;
    isExport: boolean;
    line: number;
  }> = [];
  const ledgerPattern = /(?:(export)\s+)?ledger\s+(\w+)\s*:\s*([^;]+)/g;

  let ledgerMatch;
  while ((ledgerMatch = ledgerPattern.exec(code)) !== null) {
    const lineNum = lineByIndex[ledgerMatch.index];
    ledgerItems.push({
      name: ledgerMatch[2],
      type: ledgerMatch[3].trim(),
      isExport: ledgerMatch[1] === "export",
      line: lineNum,
    });
  }

  // Extract type definitions
  const types: Array<{
    name: string;
    definition: string;
    line: number;
  }> = [];
  const typePattern = /type\s+(\w+)\s*=\s*([^;]+)/g;

  let typeMatch;
  while ((typeMatch = typePattern.exec(code)) !== null) {
    const lineNum = lineByIndex[typeMatch.index];
    types.push({
      name: typeMatch[1],
      definition: typeMatch[2].trim(),
      line: lineNum,
    });
  }

  // Extract struct definitions
  const structs: Array<{
    name: string;
    fields: string[];
    line: number;
  }> = [];

  /**
   * Extract the contents of a balanced brace block starting at `startIndex`,
   * handling nested braces and skipping over comments and string literals.
   */
  function extractBalancedBlock(
    source: string,
    startIndex: number
  ): { body: string; endIndex: number } | null {
    let depth = 0;
    const length = source.length;
    let i = startIndex;

    if (source[i] !== "{") {
      return null;
    }

    depth = 1;
    i++;
    const bodyStart = i;

    while (i < length && depth > 0) {
      const ch = source[i];
      const next = i + 1 < length ? source[i + 1] : "";

      // Handle string literals and template literals
      if (ch === '"' || ch === "'" || ch === "`") {
        const quote = ch;
        i++;
        while (i < length) {
          const c = source[i];
          if (c === "\\" && i + 1 < length) {
            // Skip escaped character
            i += 2;
            continue;
          }
          if (c === quote) {
            i++;
            break;
          }
          i++;
        }
        continue;
      }

      // Handle line comments
      if (ch === "/" && next === "/") {
        i += 2;
        while (i < length && source[i] !== "\n") {
          i++;
        }
        continue;
      }

      // Handle block comments
      if (ch === "/" && next === "*") {
        i += 2;
        while (
          i < length &&
          !(source[i] === "*" && i + 1 < length && source[i + 1] === "/")
        ) {
          i++;
        }
        if (i < length) {
          i += 2; // Skip closing */
        }
        continue;
      }

      if (ch === "{") {
        depth++;
        i++;
        continue;
      }

      if (ch === "}") {
        depth--;
        i++;
        if (depth === 0) {
          const body = source.slice(bodyStart, i - 1);
          return { body, endIndex: i - 1 };
        }
        continue;
      }

      i++;
    }

    return null;
  }

  const structPattern = /struct\s+(\w+)\s*\{/g;

  let structMatch;
  while ((structMatch = structPattern.exec(code)) !== null) {
    const lineNum = lineByIndex[structMatch.index];
    const openingBraceIndex = code.indexOf("{", structMatch.index);
    if (openingBraceIndex === -1) {
      continue;
    }

    const block = extractBalancedBlock(code, openingBraceIndex);
    if (!block) {
      continue;
    }

    const fields = block.body
      .split(",")
      .map((f) => f.trim())
      .filter((f) => f);
    structs.push({
      name: structMatch[1],
      fields,
      line: lineNum,
    });
  }

  // Extract enum definitions using balanced block extraction
  // (handles nested braces in comments/strings)
  const enums: Array<{
    name: string;
    variants: string[];
    line: number;
  }> = [];
  const enumStartPattern = /enum\s+(\w+)\s*\{/g;

  let enumMatch;
  while ((enumMatch = enumStartPattern.exec(code)) !== null) {
    const lineNum = lineByIndex[enumMatch.index];
    const openingBraceIndex = code.indexOf("{", enumMatch.index);
    if (openingBraceIndex === -1) {
      continue;
    }

    const block = extractBalancedBlock(code, openingBraceIndex);
    if (!block) {
      continue;
    }

    const variants = block.body
      .split(",")
      .map((v) => v.trim())
      .filter((v) => v);
    enums.push({
      name: enumMatch[1],
      variants,
      line: lineNum,
    });
  }

  // Generate summary
  const exports = {
    circuits: circuits.filter((c) => c.isExport).map((c) => c.name),
    witnesses: witnesses.filter((w) => w.isExport).map((w) => w.name),
    ledger: ledgerItems.filter((l) => l.isExport).map((l) => l.name),
  };

  // ============================================================================
  // PRE-COMPILATION ISSUE DETECTION
  // Catch common mistakes before hitting the compiler
  // ============================================================================

  const potentialIssues: Array<{
    type: string;
    line?: number;
    message: string;
    suggestion: string;
    severity: "error" | "warning";
  }> = [];

  // Known CompactStandardLibrary exports that shouldn't be redefined
  const stdlibExports = [
    "burnAddress",
    "ownPublicKey",
    "contractAddress",
    "default",
    "disclose",
    "assert",
    "pad",
    "unpad",
    "Counter",
    "Map",
    "Set",
    "MerkleTree",
    "Opaque",
    "Vector",
  ];

  // ========== CRITICAL SYNTAX CHECKS (P0 - causes immediate compilation failure) ==========

  // P0-1. Detect deprecated ledger block syntax
  const ledgerBlockPattern = /ledger\s*\{/g;
  let ledgerBlockMatch;
  while ((ledgerBlockMatch = ledgerBlockPattern.exec(code)) !== null) {
    const lineNum = lineByIndex[ledgerBlockMatch.index] || 1;
    potentialIssues.push({
      type: "deprecated_ledger_block",
      line: lineNum,
      message: `Deprecated ledger block syntax 'ledger { }' - causes parse error`,
      suggestion: `Use individual declarations: 'export ledger fieldName: Type;'`,
      severity: "error",
    });
  }

  // P0-2. Detect Void return type (doesn't exist in Compact)
  const voidReturnPattern = /circuit\s+\w+\s*\([^)]*\)\s*:\s*Void\b/g;
  let voidMatch;
  while ((voidMatch = voidReturnPattern.exec(code)) !== null) {
    const lineNum = lineByIndex[voidMatch.index] || 1;
    potentialIssues.push({
      type: "invalid_void_type",
      line: lineNum,
      message: `Invalid return type 'Void' - Void does not exist in Compact`,
      suggestion: `Use '[]' (empty tuple) for circuits that return nothing: 'circuit fn(): []'`,
      severity: "error",
    });
  }

  // P0-3. Detect old pragma format with patch version
  const oldPragmaPattern = /pragma\s+language_version\s*>=?\s*\d+\.\d+\.\d+/g;
  let oldPragmaMatch;
  while ((oldPragmaMatch = oldPragmaPattern.exec(code)) !== null) {
    const lineNum = lineByIndex[oldPragmaMatch.index] || 1;
    potentialIssues.push({
      type: "invalid_pragma_format",
      line: lineNum,
      message: `Pragma includes patch version which may cause parse errors`,
      suggestion: `Use bounded range format: 'pragma language_version >= 0.16 && <= 0.18;'`,
      severity: "error",
    });
  }

  // P0-4. Detect missing export on enums (won't be accessible from TypeScript)
  const unexportedEnumPattern = /(?<!export\s+)enum\s+(\w+)\s*\{/g;
  let unexportedEnumMatch;
  while ((unexportedEnumMatch = unexportedEnumPattern.exec(code)) !== null) {
    // Double check it's not preceded by export
    const before = code.substring(
      Math.max(0, unexportedEnumMatch.index - 10),
      unexportedEnumMatch.index
    );
    if (!before.includes("export")) {
      const lineNum = lineByIndex[unexportedEnumMatch.index] || 1;
      potentialIssues.push({
        type: "unexported_enum",
        line: lineNum,
        message: `Enum '${unexportedEnumMatch[1]}' is not exported - won't be accessible from TypeScript`,
        suggestion: `Add 'export' keyword: 'export enum ${unexportedEnumMatch[1]} { ... }'`,
        severity: "warning",
      });
    }
  }

  // P0-5. Detect Cell<T> wrapper (deprecated since 0.15)
  const cellPattern = /Cell\s*<\s*\w+\s*>/g;
  let cellMatch;
  while ((cellMatch = cellPattern.exec(code)) !== null) {
    const lineNum = lineByIndex[cellMatch.index] || 1;
    potentialIssues.push({
      type: "deprecated_cell_wrapper",
      line: lineNum,
      message: `'Cell<T>' wrapper is deprecated since Compact 0.15`,
      suggestion: `Use the type directly: 'Field' instead of 'Cell<Field>'`,
      severity: "error",
    });
  }

  // ========== EXISTING CHECKS ==========

  // 1. Detect module-level const (not supported in Compact)
  const constPattern = /^const\s+(\w+)\s*:/gm;
  let constMatch;
  while ((constMatch = constPattern.exec(code)) !== null) {
    // Check if this const is inside a circuit block by looking for preceding circuit/constructor
    const beforeConst = code.substring(0, constMatch.index);
    const lastCircuitStart = Math.max(
      beforeConst.lastIndexOf("circuit "),
      beforeConst.lastIndexOf("constructor {")
    );
    const lastCloseBrace = beforeConst.lastIndexOf("}");

    // If no circuit before, or the last } is after the last circuit start, it's module-level
    if (lastCircuitStart === -1 || lastCloseBrace > lastCircuitStart) {
      const lineNum = lineByIndex[constMatch.index] || 1;
      potentialIssues.push({
        type: "module_level_const",
        line: lineNum,
        message: `Module-level 'const ${constMatch[1]}' is not supported in Compact`,
        suggestion: `Use 'pure circuit ${constMatch[1]}(): <type> { return <value>; }' instead`,
        severity: "error",
      });
    }
  }

  // 2. Detect standard library name collisions
  const hasStdlibImport =
    imports.includes("CompactStandardLibrary") ||
    code.includes('include "std"');

  if (hasStdlibImport) {
    // Check circuits for name collisions
    for (const circuit of circuits) {
      if (stdlibExports.includes(circuit.name)) {
        potentialIssues.push({
          type: "stdlib_name_collision",
          line: circuit.line,
          message: `Circuit '${circuit.name}' conflicts with CompactStandardLibrary.${circuit.name}()`,
          suggestion: `Rename to avoid ambiguity, or remove to use the standard library version`,
          severity: "error",
        });
      }
    }
  }

  // 3. Detect sealed + export conflicts
  const sealedFields: Array<{ name: string; line: number }> = [];
  const sealedPattern = /sealed\s+ledger\s+(\w+)\s*:/g;
  let sealedMatch;
  while ((sealedMatch = sealedPattern.exec(code)) !== null) {
    const lineNum = lineByIndex[sealedMatch.index] || 1;
    sealedFields.push({ name: sealedMatch[1], line: lineNum });
  }

  if (sealedFields.length > 0) {
    // Check if any exported circuit writes to sealed fields
    for (const circuit of circuits) {
      if (circuit.isExport) {
        // Find the circuit body and check for assignments to sealed fields
        const circuitBodyMatch = code.match(
          new RegExp(
            `(?:export\\s+)?circuit\\s+${circuit.name}\\s*\\([^)]*\\)\\s*:[^{]*\\{([\\s\\S]*?)\\n\\}`,
            "m"
          )
        );
        if (circuitBodyMatch) {
          const body = circuitBodyMatch[1];
          for (const field of sealedFields) {
            // Check for assignment patterns: fieldName = or fieldName.method(
            if (
              new RegExp(`\\b${field.name}\\s*=`).test(body) ||
              new RegExp(`\\b${field.name}\\s*\\.\\s*\\w+\\s*\\(`).test(body)
            ) {
              potentialIssues.push({
                type: "sealed_export_conflict",
                line: circuit.line,
                message: `Exported circuit '${circuit.name}' modifies sealed field '${field.name}'`,
                suggestion: `Move sealed field initialization to a 'constructor { }' block instead`,
                severity: "error",
              });
            }
          }
        }
      }
    }
  }

  // 4. Detect missing constructor when sealed fields exist but no constructor
  if (sealedFields.length > 0) {
    const hasConstructor = /constructor\s*\{/.test(code);
    if (!hasConstructor) {
      // Check if there's an initialize-like circuit trying to set sealed fields
      const initCircuit = circuits.find(
        (c) =>
          c.name.toLowerCase().includes("init") ||
          c.name.toLowerCase() === "setup"
      );
      if (initCircuit && initCircuit.isExport) {
        potentialIssues.push({
          type: "missing_constructor",
          line: initCircuit.line,
          message: `Contract has sealed fields but uses '${initCircuit.name}' instead of constructor`,
          suggestion: `Sealed fields must be initialized in 'constructor { }', not in exported circuits`,
          severity: "warning",
        });
      }
    }
  }

  // 5. Detect potential type mismatches with stdlib functions
  if (hasStdlibImport) {
    // Check for burnAddress() used where ZswapCoinPublicKey is expected
    // burnAddress() returns Either<ZswapCoinPublicKey, ContractAddress>
    const burnAddressUsages = code.matchAll(/burnAddress\s*\(\s*\)/g);
    for (const usage of burnAddressUsages) {
      // Check if it's being passed to a function or assigned
      const afterUsage = code.substring(
        usage.index! + usage[0].length,
        usage.index! + usage[0].length + 50
      );
      const beforeUsage = code.substring(
        Math.max(0, usage.index! - 100),
        usage.index!
      );

      // If used in a context expecting ZswapCoinPublicKey (not .left or .right access)
      if (
        !afterUsage.startsWith(".left") &&
        !afterUsage.startsWith(".right") &&
        !afterUsage.startsWith(".is_left")
      ) {
        // Check if it's in a function call or assignment that likely expects ZswapCoinPublicKey
        if (/\(\s*$/.test(beforeUsage) || /,\s*$/.test(beforeUsage)) {
          const lineNum = lineByIndex[usage.index!] || 1;
          potentialIssues.push({
            type: "stdlib_type_mismatch",
            line: lineNum,
            message: `burnAddress() returns Either<ZswapCoinPublicKey, ContractAddress>, not ZswapCoinPublicKey`,
            suggestion: `Use burnAddress().left for ZswapCoinPublicKey, or define 'pure circuit zeroKey(): ZswapCoinPublicKey { return default<ZswapCoinPublicKey>; }'`,
            severity: "warning",
          });
          break; // Only warn once
        }
      }
    }
  }

  // 6. Detect division operator usage (not supported in Compact)
  const divisionPattern = /[^/]\/[^/*]/g;
  let divMatch;
  while ((divMatch = divisionPattern.exec(code)) !== null) {
    // Skip if inside a comment
    const beforeDiv = code.substring(0, divMatch.index);
    const lastLineStart = beforeDiv.lastIndexOf("\n") + 1;
    const lineContent = beforeDiv.substring(lastLineStart);
    if (lineContent.includes("//")) continue;

    const lineNum = lineByIndex[divMatch.index] || 1;
    potentialIssues.push({
      type: "unsupported_division",
      line: lineNum,
      message: `Division operator '/' is not supported in Compact`,
      suggestion: `Use a witness-based division pattern: 'witness divideWithRemainder(a, b): [quotient, remainder]' with on-chain verification`,
      severity: "error",
    });
    break; // Only warn once
  }

  // 7. Detect Counter.value access (Counter only has .increment())
  const counterValuePattern = /(\w+)\.value\b/g;
  let counterMatch;
  while ((counterMatch = counterValuePattern.exec(code)) !== null) {
    const varName = counterMatch[1];
    // Check if this variable is a Counter type
    const counterLedger = ledgerItems.find(
      (l) => l.name === varName && l.type === "Counter"
    );
    if (counterLedger) {
      const lineNum = lineByIndex[counterMatch.index] || 1;
      potentialIssues.push({
        type: "invalid_counter_access",
        line: lineNum,
        message: `Counter type '${varName}' does not have a '.value' property`,
        suggestion: `Counter only has '.increment(n)'. Use 'Uint<32>' or 'Uint<64>' instead if you need to read the value`,
        severity: "error",
      });
    }
  }

  // 8. Detect potential Uint overflow in multiplication (suggest Field casting)
  const multiplyPattern =
    /(\w+)\s*\*\s*(\w+)(?:\s*\+\s*\w+)?\s*(?:as\s+Uint|==)/g;
  let multMatch;
  while ((multMatch = multiplyPattern.exec(code)) !== null) {
    // Check if operands are likely Uint types and not already cast to Field
    const beforeMult = code.substring(
      Math.max(0, multMatch.index - 200),
      multMatch.index
    );
    const afterMult = code.substring(
      multMatch.index,
      multMatch.index + multMatch[0].length + 50
    );

    // Skip if already casting to Field
    if (afterMult.includes("as Field") || beforeMult.includes("as Field"))
      continue;

    // Check if this looks like a verification pattern (common in witness verification)
    if (/assert|==/.test(afterMult)) {
      const lineNum = lineByIndex[multMatch.index] || 1;
      potentialIssues.push({
        type: "potential_overflow",
        line: lineNum,
        message: `Multiplication '${multMatch[1]} * ${multMatch[2]}' may overflow Uint bounds`,
        suggestion: `Cast operands to Field for safe arithmetic: '(${multMatch[1]} as Field) * (${multMatch[2]} as Field)'`,
        severity: "warning",
      });
      break; // Only warn once
    }
  }

  // 9. Detect witness/private values used in conditionals without disclose()
  // Look for patterns like: if (witnessVar ...) or if (param == privateValue)
  const witnessNames = witnesses.map((w) => w.name);
  const ifPattern = /if\s*\(([^)]+)\)/g;
  let ifMatch;
  while ((ifMatch = ifPattern.exec(code)) !== null) {
    const condition = ifMatch[1];
    // Check if condition uses a witness value without disclose
    for (const witnessName of witnessNames) {
      if (
        condition.includes(witnessName) &&
        !condition.includes(`disclose(${witnessName}`) &&
        !condition.includes("disclose(")
      ) {
        const lineNum = lineByIndex[ifMatch.index] || 1;
        potentialIssues.push({
          type: "undisclosed_witness_conditional",
          line: lineNum,
          message: `Witness value '${witnessName}' used in conditional without disclose()`,
          suggestion: `Wrap witness comparisons in disclose(): 'if (disclose(${witnessName} == expected))'`,
          severity: "warning",
        });
        break;
      }
    }
  }

  // 10. Detect constructor parameters assigned to ledger without disclose()
  // Constructor parameters are treated as witness values and need disclose() when written to ledger
  const constructorMatch = code.match(
    /constructor\s*\(([^)]*)\)\s*\{([\s\S]*?)(?=\n\s*(?:export|circuit|witness|ledger|constructor|\}|$))/
  );
  if (constructorMatch) {
    const paramsStr = constructorMatch[1];
    const constructorBody = constructorMatch[2];

    // Extract constructor parameter names
    const paramPattern = /(\w+)\s*:\s*[^,)]+/g;
    const constructorParams: string[] = [];
    let paramMatch;
    while ((paramMatch = paramPattern.exec(paramsStr)) !== null) {
      constructorParams.push(paramMatch[1]);
    }

    // Check each parameter for direct assignment to ledger without disclose
    for (const param of constructorParams) {
      // Look for direct assignment: ledgerField = param (without disclose)
      const assignmentPattern = new RegExp(
        `(\\w+)\\s*=\\s*(?!disclose\\s*\\()${param}\\b`,
        "g"
      );
      let assignMatch;
      while ((assignMatch = assignmentPattern.exec(constructorBody)) !== null) {
        const fieldName = assignMatch[1];
        // Check if the field is a ledger item
        const isLedgerField = ledgerItems.some((l) => l.name === fieldName);
        if (isLedgerField) {
          // Find the line number
          const beforeAssign = code.substring(
            0,
            constructorMatch.index! +
              constructorMatch[0].indexOf(assignMatch[0])
          );
          const lineNum = (beforeAssign.match(/\n/g) || []).length + 1;
          potentialIssues.push({
            type: "undisclosed_constructor_param",
            line: lineNum,
            message: `Constructor parameter '${param}' assigned to ledger field '${fieldName}' without disclose()`,
            suggestion: `Wrap in disclose(): '${fieldName} = disclose(${param});'`,
            severity: "error",
          });
        }
      }
    }
  }

  // 11. Detect "if" expression used in assignment context (should use ternary)
  // Pattern: const x = if (...) { ... } else { ... }
  const ifAssignmentPattern = /(?:const|let)\s+\w+\s*=\s*if\s*\(/g;
  let ifAssignMatch;
  while ((ifAssignMatch = ifAssignmentPattern.exec(code)) !== null) {
    const lineNum = lineByIndex[ifAssignMatch.index] || 1;
    potentialIssues.push({
      type: "invalid_if_expression",
      line: lineNum,
      message: `'if' cannot be used as an expression in assignments`,
      suggestion: `Use ternary operator instead: 'const x = condition ? valueIfTrue : valueIfFalse;'`,
      severity: "error",
    });
  }

  // 12. (Moved to P0-2 above - Void return type check)

  const summary = [];
  if (circuits.length > 0) {
    summary.push(`${circuits.length} circuit(s)`);
  }
  if (witnesses.length > 0) {
    summary.push(`${witnesses.length} witness(es)`);
  }
  if (ledgerItems.length > 0) {
    summary.push(`${ledgerItems.length} ledger item(s)`);
  }
  if (types.length > 0) {
    summary.push(`${types.length} type alias(es)`);
  }
  if (structs.length > 0) {
    summary.push(`${structs.length} struct(s)`);
  }
  if (enums.length > 0) {
    summary.push(`${enums.length} enum(s)`);
  }

  return {
    success: true,
    filename,
    languageVersion,
    imports,
    structure: {
      circuits,
      witnesses,
      ledgerItems,
      types,
      structs,
      enums,
    },
    exports,
    stats: {
      lineCount: lines.length,
      circuitCount: circuits.length,
      witnessCount: witnesses.length,
      ledgerCount: ledgerItems.length,
      typeCount: types.length,
      structCount: structs.length,
      enumCount: enums.length,
      exportedCircuits: exports.circuits.length,
      exportedWitnesses: exports.witnesses.length,
      exportedLedger: exports.ledger.length,
    },
    potentialIssues: potentialIssues.length > 0 ? potentialIssues : undefined,
    summary: summary.length > 0 ? summary.join(", ") : "Empty contract",
    message:
      potentialIssues.length > 0
        ? `⚠️ Found ${potentialIssues.length} potential issue(s). Contract contains: ${summary.join(", ") || "no definitions found"}`
        : `📋 Contract contains: ${summary.join(", ") || "no definitions found"}`,
  };
}
