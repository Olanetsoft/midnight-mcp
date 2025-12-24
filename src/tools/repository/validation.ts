/**
 * Contract validation handlers
 * Pre-compilation validation for Compact contracts using the Compact CLI
 */

import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, mkdir, readFile, rm } from "fs/promises";
import { join, basename, resolve, isAbsolute } from "path";
import { tmpdir } from "os";
import { platform } from "process";
import { logger } from "../../utils/index.js";
import type {
  ValidateContractInput,
  ExtractContractStructureInput,
} from "./schemas.js";

const execAsync = promisify(exec);

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
  if (normalized !== filePath && filePath.includes("..")) {
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

/**
 * Detect local includes that won't work in temp directory
 */
function detectLocalIncludes(code: string): string[] {
  const localIncludes: string[] = [];

  // Pattern: include "something.compact" or include "./path"
  const includePattern = /include\s+"([^"]+)"/g;
  let match;

  while ((match = includePattern.exec(code)) !== null) {
    const includePath = match[1];
    // Skip standard library includes
    if (
      includePath === "std" ||
      includePath.startsWith("CompactStandardLibrary")
    ) {
      continue;
    }
    // Local file reference
    if (
      includePath.endsWith(".compact") ||
      includePath.startsWith("./") ||
      includePath.startsWith("../")
    ) {
      localIncludes.push(includePath);
    }
  }

  return localIncludes;
}

// ============================================================================
// VALIDATION HANDLERS
// ============================================================================

/**
 * Validate a Compact contract by running the compiler
 * This provides pre-compilation validation with detailed error diagnostics
 */
export async function validateContract(input: ValidateContractInput) {
  logger.debug("Validating contract", {
    filename: input.filename,
    hasCode: !!input.code,
    filePath: input.filePath,
  });

  // ============================================================================
  // RESOLVE CODE SOURCE - Either from code string or file path
  // ============================================================================

  let code: string;
  let filename: string;
  let sourceDir: string | null = null; // Track source directory for local includes

  if (input.filePath) {
    // SECURITY: Validate file path first
    const pathValidation = validateFilePath(input.filePath);
    if (!pathValidation.valid) {
      return {
        success: false,
        errorType: "security_error",
        error: "Invalid file path",
        message: `❌ ${pathValidation.error}`,
        userAction: {
          problem: pathValidation.error,
          solution:
            "Provide an absolute path to a .compact file in your project directory",
          example: { filePath: "/Users/you/projects/myapp/contract.compact" },
          isUserFault: true,
        },
      };
    }

    const safePath = pathValidation.normalizedPath!;
    sourceDir = join(safePath, "..");

    // Read code from file
    try {
      code = await readFile(safePath, "utf-8");
      filename = basename(safePath);

      // SECURITY: Check for binary/non-UTF8 content
      if (!isValidUtf8Text(code)) {
        return {
          success: false,
          errorType: "user_error",
          error: "Invalid file content",
          message:
            "❌ File appears to be binary or contains invalid characters",
          userAction: {
            problem: "The file is not a valid UTF-8 text file",
            solution:
              "Ensure you're pointing to a Compact source file (.compact), not a compiled binary",
            isUserFault: true,
          },
        };
      }
    } catch (fsError: unknown) {
      const err = fsError as { code?: string; message?: string };
      return {
        success: false,
        errorType: "user_error",
        error: "Failed to read file",
        message: `❌ Cannot read file: ${input.filePath}`,
        userAction: {
          problem:
            err.code === "ENOENT"
              ? "File does not exist"
              : err.code === "EACCES"
                ? "Permission denied"
                : "Cannot read file",
          solution:
            err.code === "ENOENT"
              ? "Check that the file path is correct"
              : "Check file permissions",
          details: err.message,
          isUserFault: true,
        },
      };
    }
  } else if (input.code) {
    code = input.code;
    // Sanitize filename to prevent command injection
    const rawFilename = input.filename || "contract.compact";
    filename = rawFilename.replace(/[^a-zA-Z0-9._-]/g, "_");
    if (!filename.endsWith(".compact")) {
      filename = "contract.compact";
    }

    // Check for binary content in provided code
    if (!isValidUtf8Text(code)) {
      return {
        success: false,
        errorType: "user_error",
        error: "Invalid code content",
        message: "❌ Code contains invalid characters",
        userAction: {
          problem:
            "The provided code contains binary or non-printable characters",
          solution: "Provide valid UTF-8 Compact source code",
          isUserFault: true,
        },
      };
    }
  } else {
    // Neither code nor filePath provided
    return {
      success: false,
      errorType: "user_error",
      error: "No contract provided",
      message: "❌ Must provide either 'code' or 'filePath'",
      userAction: {
        problem: "Neither code string nor file path was provided",
        solution:
          "Provide the contract source code OR a path to a .compact file",
        example: {
          withCode: { code: "pragma language_version >= 0.16; ..." },
          withFile: { filePath: "/path/to/contract.compact" },
        },
        isUserFault: true,
      },
    };
  }

  // ============================================================================
  // INPUT VALIDATION - Check for user errors before attempting compilation
  // ============================================================================

  // Check for local includes that won't work in temp directory
  const localIncludes = detectLocalIncludes(code);
  if (localIncludes.length > 0 && !sourceDir) {
    // Code was provided directly (not from file) and has local includes
    return {
      success: false,
      errorType: "user_error",
      error: "Local includes detected",
      message: "❌ Contract has local file includes that cannot be resolved",
      userAction: {
        problem: `Contract includes local files: ${localIncludes.join(", ")}`,
        solution:
          "Use filePath instead of code when your contract has local includes, so we can resolve relative paths",
        detectedIncludes: localIncludes,
        example: {
          instead: '{ code: "include \\"utils.compact\\"; ..." }',
          use: '{ filePath: "/path/to/your/contract.compact" }',
        },
        isUserFault: true,
      },
    };
  }

  // Warn about local includes (they may fail during compilation)
  const localIncludeWarning =
    localIncludes.length > 0
      ? {
          warning: "Contract has local includes",
          includes: localIncludes,
          note: "Local includes may fail if files are not in the expected location relative to the contract",
        }
      : null;

  // Check for empty input
  if (!code || code.trim().length === 0) {
    return {
      success: false,
      errorType: "user_error",
      error: "Empty contract code provided",
      message: "❌ No contract code to validate",
      userAction: {
        problem: "The contract code is empty or contains only whitespace",
        solution: "Provide valid Compact contract source code",
        example: `pragma language_version >= 0.16;

import CompactStandardLibrary;

export ledger counter: Counter;

export circuit increment(): [] {
  counter.increment(1);
}`,
      },
    };
  }

  // Check for excessively large input (potential abuse or mistake)
  const MAX_CODE_SIZE = 1024 * 1024; // 1MB
  if (code.length > MAX_CODE_SIZE) {
    return {
      success: false,
      errorType: "user_error",
      error: "Contract code too large",
      message: "❌ Contract code exceeds maximum size",
      userAction: {
        problem: `Contract is ${(code.length / 1024).toFixed(1)}KB, maximum is ${MAX_CODE_SIZE / 1024}KB`,
        solution: "Reduce contract size or split into multiple files",
      },
    };
  }

  // Check for missing pragma (common user mistake)
  if (!code.includes("pragma language_version")) {
    return {
      success: false,
      errorType: "user_error",
      error: "Missing pragma directive",
      message: "❌ Contract is missing required pragma directive",
      userAction: {
        problem:
          "All Compact contracts must start with a pragma language_version directive",
        solution: "Add pragma directive at the beginning of your contract",
        fix: "Add: pragma language_version >= 0.16;",
        example: `pragma language_version >= 0.16;

import CompactStandardLibrary;

// ... rest of your contract`,
      },
      detectedIssues: ["Missing pragma language_version directive"],
    };
  }

  // Check for missing import (common for Counter, Map, etc.)
  // Use word boundaries to avoid false positives in comments/strings
  const usesStdLib =
    /\bCounter\b/.test(code) ||
    /\bMap\s*</.test(code) ||
    /\bSet\s*</.test(code) ||
    /\bOpaque\s*</.test(code);
  const hasImport =
    /\bimport\s+CompactStandardLibrary\b/.test(code) ||
    /\binclude\s+"std"/.test(code);

  if (usesStdLib && !hasImport) {
    return {
      success: false,
      errorType: "user_error",
      error: "Missing standard library import",
      message: "❌ Contract uses standard library types without importing them",
      userAction: {
        problem:
          "You're using types like Counter, Map, Set, or Opaque without importing the standard library",
        solution: "Add the import statement after your pragma directive",
        fix: "Add: import CompactStandardLibrary;",
        example: `pragma language_version >= 0.16;

import CompactStandardLibrary;

export ledger counter: Counter;
// ...`,
      },
      detectedIssues: [
        "Uses standard library types (Counter, Map, Set, Opaque)",
        "Missing: import CompactStandardLibrary;",
      ],
    };
  }

  // ============================================================================
  // COMPILER CHECK - Verify compiler is available
  // ============================================================================

  let compactPath = "";
  let compilerVersion = "";

  try {
    if (platform === "win32") {
      // On Windows, avoid the built-in NTFS 'compact.exe' from System32
      // by iterating through all candidates and verifying each one
      const { stdout: whereOutput } = await execAsync("where compact.exe");
      const candidates = whereOutput
        .trim()
        .split(/\r?\n/)
        .filter((line) => line.trim().length > 0);

      let found = false;
      for (const candidate of candidates) {
        try {
          const candidatePath = candidate.trim();
          // Skip Windows System32 compact.exe (NTFS compression utility)
          if (candidatePath.toLowerCase().includes("system32")) {
            continue;
          }
          const { stdout: versionOutput } = await execAsync(
            `"${candidatePath}" compile --version`
          );
          compactPath = candidatePath;
          compilerVersion = versionOutput.trim();
          found = true;
          break;
        } catch {
          // Try next candidate
        }
      }
      if (!found) {
        throw new Error("Compact compiler not found in PATH");
      }
    } else {
      // Unix: use which to find compact
      const { stdout: whichOutput } = await execAsync("which compact");
      compactPath = whichOutput.trim().split(/\r?\n/)[0];
      const { stdout: versionOutput } = await execAsync(
        `"${compactPath}" compile --version`
      );
      compilerVersion = versionOutput.trim();
    }
  } catch {
    return {
      success: false,
      errorType: "environment_error",
      compilerInstalled: false,
      error: "Compact compiler not found",
      message: "❌ Compact compiler is not installed",
      installation: {
        message:
          "The Compact compiler is required for contract validation. Install it with:",
        command: `curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh`,
        postInstall: [
          "After installation, run: compact update",
          "Then verify with: compact compile --version",
        ],
        docs: "https://docs.midnight.network/develop/tutorial/building",
      },
      userAction: {
        problem: "The Compact compiler is not installed on this system",
        solution:
          "Install the compiler using the command above, then retry validation",
        isUserFault: false,
      },
    };
  }

  // Check compiler version compatibility
  const versionMatch = compilerVersion.match(/(\d+)\.(\d+)/);
  if (versionMatch) {
    const major = parseInt(versionMatch[1], 10);
    const minor = parseInt(versionMatch[2], 10);
    if (major === 0 && minor < 16) {
      return {
        success: false,
        errorType: "environment_error",
        compilerInstalled: true,
        compilerVersion,
        error: "Compiler version too old",
        message: `❌ Compact compiler ${compilerVersion} is outdated`,
        userAction: {
          problem: `Your compiler version (${compilerVersion}) may not support current syntax`,
          solution: "Update to the latest compiler version",
          command: "compact update",
          isUserFault: false,
        },
      };
    }
  }

  // ============================================================================
  // COMPILATION - Create temp files and run compiler
  // ============================================================================

  const tempDir = join(tmpdir(), `midnight-validate-${Date.now()}`);
  const contractPath = join(tempDir, filename);
  const outputDir = join(tempDir, "output");

  try {
    // Create temp directory
    try {
      await mkdir(tempDir, { recursive: true });
      await mkdir(outputDir, { recursive: true });
    } catch (fsError: unknown) {
      const err = fsError as { code?: string; message?: string };
      return {
        success: false,
        errorType: "system_error",
        error: "Failed to create temporary directory",
        message: "❌ System error: Cannot create temp files",
        systemError: {
          code: err.code,
          details: err.message,
          problem:
            err.code === "ENOSPC"
              ? "Disk is full"
              : err.code === "EACCES"
                ? "Permission denied"
                : "File system error",
          solution:
            err.code === "ENOSPC"
              ? "Free up disk space and retry"
              : err.code === "EACCES"
                ? "Check file system permissions"
                : "Check system resources",
          isUserFault: false,
        },
      };
    }

    // Write contract file
    try {
      await writeFile(contractPath, code, "utf-8");
    } catch (writeError: unknown) {
      const err = writeError as { code?: string; message?: string };
      return {
        success: false,
        errorType: "system_error",
        error: "Failed to write contract file",
        message: "❌ System error: Cannot write temp file",
        systemError: {
          code: err.code,
          details: err.message,
          isUserFault: false,
        },
      };
    }

    // Run compilation
    // When sourceDir is available (file path provided), run from source directory
    // to resolve local includes. Otherwise run from temp directory.
    try {
      const execOptions = {
        timeout: 60000, // 60 second timeout
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        cwd: sourceDir || tempDir, // Use source directory for include resolution
      };

      const { stdout, stderr } = await execAsync(
        `compact compile "${contractPath}" "${outputDir}"`,
        execOptions
      );

      // Compilation succeeded!
      const allWarnings = stderr ? parseWarnings(stderr) : [];

      // Add local include warning if applicable
      if (localIncludeWarning) {
        allWarnings.push(
          `Note: Contract has local includes (${localIncludes.join(", ")}) - ensure these files exist relative to your contract`
        );
      }

      return {
        success: true,
        errorType: null,
        compilerInstalled: true,
        compilerVersion,
        compilerPath: compactPath,
        message: "✅ Contract compiled successfully!",
        output: stdout || "Compilation completed without errors",
        warnings: allWarnings,
        localIncludes: localIncludes.length > 0 ? localIncludes : undefined,
        contractInfo: {
          filename,
          codeLength: code.length,
          lineCount: code.split("\n").length,
        },
        nextSteps: [
          "The contract syntax is valid and compiles",
          "Generated files would be in the output directory",
          "You can proceed with deployment or further development",
        ],
      };
    } catch (compileError: unknown) {
      // Compilation failed - parse and categorize the error
      const error = compileError as {
        stdout?: string;
        stderr?: string;
        message?: string;
        killed?: boolean;
        signal?: string;
        code?: number;
      };

      // Check for timeout
      if (error.killed || error.signal === "SIGTERM") {
        return {
          success: false,
          errorType: "timeout_error",
          compilerInstalled: true,
          compilerVersion,
          error: "Compilation timed out",
          message: "❌ Compilation timed out after 60 seconds",
          userAction: {
            problem: "The contract took too long to compile",
            solution:
              "Simplify the contract or check for infinite loops in circuit logic",
            possibleCauses: [
              "Very complex contract with many circuits",
              "Recursive or deeply nested structures",
              "Large number of constraints",
            ],
            isUserFault: true,
          },
        };
      }

      const errorOutput = error.stderr || error.stdout || error.message || "";
      const diagnostics = parseCompilerErrors(errorOutput, code);

      // Categorize the error for better user feedback
      const errorCategory = categorizeCompilerError(errorOutput);

      return {
        success: false,
        errorType: "compilation_error",
        errorCategory,
        compilerInstalled: true,
        compilerVersion,
        compilerPath: compactPath,
        message: `❌ ${errorCategory.title}`,
        errors: diagnostics.errors,
        errorCount: diagnostics.errors.length,
        rawOutput: errorOutput.slice(0, 2000),
        contractInfo: {
          filename,
          codeLength: code.length,
          lineCount: code.split("\n").length,
        },
        userAction: {
          problem: errorCategory.explanation,
          solution: errorCategory.solution,
          isUserFault: true,
        },
        suggestions: diagnostics.suggestions,
        commonFixes: getCommonFixes(diagnostics.errors),
      };
    }
  } finally {
    // Cleanup temp files (cross-platform)
    try {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    } catch {
      // Ignore cleanup errors
    }
  }
}

// ============================================================================
// ERROR PARSING HELPERS
// ============================================================================

/**
 * Categorize compiler errors for better user feedback
 */
function categorizeCompilerError(output: string): {
  category: string;
  title: string;
  explanation: string;
  solution: string;
} {
  const lowerOutput = output.toLowerCase();

  if (
    lowerOutput.includes("parse error") ||
    lowerOutput.includes("looking for")
  ) {
    return {
      category: "syntax_error",
      title: "Syntax Error",
      explanation:
        "The contract has invalid syntax that the parser cannot understand",
      solution:
        "Check for missing semicolons, brackets, or typos near the indicated line",
    };
  }

  if (
    lowerOutput.includes("type") &&
    (lowerOutput.includes("mismatch") || lowerOutput.includes("expected"))
  ) {
    return {
      category: "type_error",
      title: "Type Error",
      explanation: "There is a type mismatch in your contract",
      solution: "Ensure variable types match expected types in operations",
    };
  }

  if (
    lowerOutput.includes("undefined") ||
    lowerOutput.includes("not found") ||
    lowerOutput.includes("unknown")
  ) {
    return {
      category: "reference_error",
      title: "Reference Error",
      explanation: "The contract references something that doesn't exist",
      solution:
        "Check that all variables, types, and functions are properly defined or imported",
    };
  }

  if (
    lowerOutput.includes("import") ||
    lowerOutput.includes("include") ||
    lowerOutput.includes("module")
  ) {
    return {
      category: "import_error",
      title: "Import Error",
      explanation: "There is a problem with an import or include statement",
      solution:
        "Verify import paths and ensure required libraries are available",
    };
  }

  if (
    lowerOutput.includes("circuit") ||
    lowerOutput.includes("witness") ||
    lowerOutput.includes("ledger")
  ) {
    return {
      category: "structure_error",
      title: "Contract Structure Error",
      explanation:
        "There is an issue with the contract structure (circuits, witnesses, or ledger)",
      solution: "Review the contract structure against Compact documentation",
    };
  }

  return {
    category: "unknown_error",
    title: "Compilation Failed",
    explanation: "The compiler encountered an error",
    solution: "Review the error message and check Compact documentation",
  };
}

/**
 * Parse compiler error output into structured diagnostics
 */
function parseCompilerErrors(
  output: string,
  sourceCode: string
): {
  errors: Array<{
    line?: number;
    column?: number;
    message: string;
    severity: "error" | "warning";
    context?: string;
  }>;
  suggestions: string[];
} {
  const errors: Array<{
    line?: number;
    column?: number;
    message: string;
    severity: "error" | "warning";
    context?: string;
  }> = [];
  const suggestions: string[] = [];
  const lines = sourceCode.split("\n");

  // Common patterns in Compact compiler output
  // Pattern: "error: <message>" or "Error: <message>"
  const errorLinePattern = /(?:error|Error):\s*(.+)/gi;
  // Pattern: "line <n>:" or "at line <n>" or "<filename>:<line>:<col>"
  const lineNumberPattern = /(?:line\s*(\d+)|at\s+line\s+(\d+)|:(\d+):(\d+))/i;
  // Pattern: "expected <x>, found <y>"
  const expectedPattern =
    /expected\s+['"`]?([^'"`]+)['"`]?,?\s*(?:found|got)\s+['"`]?([^'"`]+)['"`]?/i;

  // Split output into logical segments
  const segments = output.split(/(?=error:|Error:)/i);

  for (const segment of segments) {
    if (!segment.trim()) continue;

    const errorMatch = segment.match(errorLinePattern);
    if (errorMatch) {
      const message = errorMatch[0].replace(/^(?:error|Error):\s*/i, "").trim();

      // Try to extract line number
      const lineMatch = segment.match(lineNumberPattern);
      const line = lineMatch
        ? parseInt(lineMatch[1] || lineMatch[2] || lineMatch[3], 10)
        : undefined;
      const column =
        lineMatch && lineMatch[4] ? parseInt(lineMatch[4], 10) : undefined;

      // Get source context if we have a line number
      let context: string | undefined;
      if (line && line > 0 && line <= lines.length) {
        const start = Math.max(0, line - 2);
        const end = Math.min(lines.length, line + 1);
        context = lines
          .slice(start, end)
          .map((l, i) => `${start + i + 1}: ${l}`)
          .join("\n");
      }

      errors.push({
        line,
        column,
        message,
        severity: "error",
        context,
      });

      // Generate suggestions based on error type
      const expectedMatch = message.match(expectedPattern);
      if (expectedMatch) {
        suggestions.push(
          `Expected "${expectedMatch[1]}" but found "${expectedMatch[2]}". Check your syntax.`
        );
      }
    }
  }

  // If no structured errors found, add the raw output as an error
  if (errors.length === 0 && output.trim()) {
    errors.push({
      message: output.trim().slice(0, 500),
      severity: "error",
    });
  }

  // Add general suggestions based on common issues
  if (output.includes("Cell")) {
    suggestions.push(
      "Remember to use .value to access Cell<T> contents (e.g., state.value)"
    );
  }
  if (output.includes("Opaque")) {
    suggestions.push(
      'Opaque<"string"> is a type, not a type alias. Use it directly in signatures.'
    );
  }
  if (output.includes("disclose")) {
    suggestions.push(
      "In conditionals, use: const x = disclose(expr); if (x) { ... } instead of if (disclose(expr))"
    );
  }
  if (output.includes("Counter")) {
    suggestions.push(
      "Counter type requires initialization: counter = Counter.increment(counter, 1)"
    );
  }

  return { errors, suggestions };
}

/**
 * Parse warnings from compiler output
 */
function parseWarnings(output: string): string[] {
  const warnings: string[] = [];
  const warningPattern = /(?:warning|Warning):\s*(.+)/gi;

  let match;
  while ((match = warningPattern.exec(output)) !== null) {
    warnings.push(match[1].trim());
  }

  return warnings;
}

/**
 * Get common fixes based on error patterns
 */
function getCommonFixes(
  errors: Array<{ message: string }>
): Array<{ pattern: string; fix: string }> {
  const fixes: Array<{ pattern: string; fix: string }> = [];
  const messages = errors.map((e) => e.message.toLowerCase()).join(" ");

  if (messages.includes("cell") || messages.includes("value")) {
    fixes.push({
      pattern: "Cell<T> access error",
      fix: "Use `state.value` instead of just `state` when accessing Cell contents",
    });
  }

  if (messages.includes("opaque") || messages.includes("string type")) {
    fixes.push({
      pattern: "Opaque string type error",
      fix: 'Use `Opaque<"your_type_name">` directly - it cannot be aliased with type keyword',
    });
  }

  if (messages.includes("boolean") || messages.includes("witness")) {
    fixes.push({
      pattern: "Boolean witness error",
      fix: "Witnesses return `Uint<1>` not `Boolean` - use `x != 0` to convert to Boolean",
    });
  }

  if (messages.includes("disclose") || messages.includes("conditional")) {
    fixes.push({
      pattern: "Disclosure in conditional error",
      fix: "Store disclose() result in const before using in if: `const revealed = disclose(x); if (revealed) { ... }`",
    });
  }

  if (messages.includes("counter") || messages.includes("increment")) {
    fixes.push({
      pattern: "Counter initialization error",
      fix: "Initialize counters with: `counter = Counter.increment(counter, 1)`",
    });
  }

  if (
    messages.includes("map") ||
    messages.includes("key") ||
    messages.includes("insert")
  ) {
    fixes.push({
      pattern: "Map operation error",
      fix: "Maps require aligned access: insert at key before reading, or use default values",
    });
  }

  return fixes;
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

  // Extract pragma version (handles >=, >, <=, <, ==, ~ operators)
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

  // Helper to split parameters handling nested angle brackets (e.g., Map<A, B>)
  const splitParams = (paramsStr: string): string[] => {
    const result: string[] = [];
    let current = "";
    let angleDepth = 0;
    let squareDepth = 0;

    for (let i = 0; i < paramsStr.length; i++) {
      const ch = paramsStr[i];
      if (ch === "<") angleDepth++;
      else if (ch === ">") angleDepth = Math.max(0, angleDepth - 1);
      else if (ch === "[") squareDepth++;
      else if (ch === "]") squareDepth = Math.max(0, squareDepth - 1);

      if (ch === "," && angleDepth === 0 && squareDepth === 0) {
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
  const circuitPattern =
    /(?:(export)\s+)?circuit\s+(\w+)\s*\(([^)]*)\)\s*:\s*([^{\n;]+)/g;
  const lines = code.split("\n");

  let circuitMatch;
  while ((circuitMatch = circuitPattern.exec(code)) !== null) {
    const lineNum = code.substring(0, circuitMatch.index).split("\n").length;
    const params = splitParams(circuitMatch[3]);

    circuits.push({
      name: circuitMatch[2],
      params,
      returnType: circuitMatch[4].trim(),
      isExport: circuitMatch[1] === "export",
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
    const lineNum = code.substring(0, witnessMatch.index).split("\n").length;
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
    const lineNum = code.substring(0, ledgerMatch.index).split("\n").length;
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
    const lineNum = code.substring(0, typeMatch.index).split("\n").length;
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
  const structPattern = /struct\s+(\w+)\s*\{([^}]+)\}/g;

  let structMatch;
  while ((structMatch = structPattern.exec(code)) !== null) {
    const lineNum = code.substring(0, structMatch.index).split("\n").length;
    const fields = structMatch[2]
      .split(",")
      .map((f) => f.trim())
      .filter((f) => f);
    structs.push({
      name: structMatch[1],
      fields,
      line: lineNum,
    });
  }

  // Extract enum definitions
  const enums: Array<{
    name: string;
    variants: string[];
    line: number;
  }> = [];
  const enumPattern = /enum\s+(\w+)\s*\{([^}]+)\}/g;

  let enumMatch;
  while ((enumMatch = enumPattern.exec(code)) !== null) {
    const lineNum = code.substring(0, enumMatch.index).split("\n").length;
    const variants = enumMatch[2]
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
    summary: summary.length > 0 ? summary.join(", ") : "Empty contract",
    message: `📋 Contract contains: ${summary.join(", ") || "no definitions found"}`,
  };
}
