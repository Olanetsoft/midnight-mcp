/**
 * Compact Compiler Service (opt-in)
 *
 * Integrates with a Compact compiler HTTP API for real-time contract
 * compilation and validation.
 *
 * Privacy: there is NO default compiler endpoint. Contract source is only ever
 * sent to whatever COMPACT_COMPILER_URL points at, so with it unset nothing
 * leaves the machine and the analyze tool falls back to local static analysis.
 * Point COMPACT_COMPILER_URL at a compiler you run yourself to enable real
 * compilation.
 */

import { logger } from "../utils/logger.js";

// =============================================================================
// Configuration
// =============================================================================

/**
 * Resolve the configured compiler endpoint at call time. Opt-in only: returns
 * undefined when COMPACT_COMPILER_URL is unset, which keeps contract source on
 * the local machine by default.
 */
function getConfiguredCompilerUrl(): string | undefined {
  const url = process.env.COMPACT_COMPILER_URL?.trim();
  return url ? url : undefined;
}

const COMPILER_TIMEOUT = 30000; // 30 seconds
const MAX_CODE_SIZE = 100 * 1024; // 100 KB

// =============================================================================
// Types
// =============================================================================

export interface CompileOptions {
  /** Auto-wrap code snippets with default pragma if missing */
  wrapWithDefaults?: boolean;
  /** Skip ZK circuit generation for faster syntax checking */
  skipZk?: boolean;
}

export interface CompileRequest {
  code: string;
  options?: CompileOptions;
}

export interface CompileSuccessResponse {
  success: true;
  compilerVersion?: string;
  output?:
    | {
        circuits?: string[];
        ledgerFields?: string[];
        exports?: string[];
      }
    | string; // API may return string "Compilation successful"
  warnings?: string[];
  compiledAt?: string;
  executionTime?: number;
}

export interface CompileError {
  file?: string;
  line?: number;
  column?: number;
  severity?: string;
  message: string;
}

export interface CompileErrorResponse {
  success: false;
  error?: string;
  errors?: CompileError[];
  message?: string;
  output?: string;
  details?: {
    line?: number;
    column?: number;
    errorType?: string;
  };
  compiledAt?: string;
  executionTime?: number;
}

export type CompileResponse = CompileSuccessResponse | CompileErrorResponse;

export interface CompilationResult {
  success: boolean;
  compilerVersion?: string;
  message: string;
  circuits?: string[];
  ledgerFields?: string[];
  exports?: string[];
  warnings?: string[];
  error?: string;
  errors?: CompileError[];
  errorDetails?: {
    line?: number;
    column?: number;
    errorType?: string;
  };
  serviceAvailable: boolean;
}

// =============================================================================
// Compiler Service
// =============================================================================

/**
 * Check if the compiler service is available
 */
export async function checkCompilerHealth(): Promise<{
  available: boolean;
  version?: string;
  error?: string;
}> {
  const url = getConfiguredCompilerUrl();
  if (!url) {
    return {
      available: false,
      error:
        "No compiler configured. Set COMPACT_COMPILER_URL to a compiler you run yourself; contract source is never sent to a third-party compiler by default.",
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`${url}/health`, {
      method: "GET",
      signal: controller.signal,
    });

    if (response.ok) {
      const rawData: unknown = await response.json();
      const data =
        typeof rawData === "object" && rawData !== null
          ? (rawData as { compilerVersion?: string; version?: string })
          : {};
      return {
        available: true,
        version: data.compilerVersion || data.version,
      };
    }

    return {
      available: false,
      error: `Health check failed: ${response.status}`,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger.warn("Compiler service health check failed", {
      error: errorMessage,
    });
    return {
      available: false,
      error: errorMessage,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Compile Compact source code using the hosted compiler service
 */
export async function compileContract(
  code: string,
  options: CompileOptions = {},
): Promise<CompilationResult> {
  // Validate input
  if (!code || typeof code !== "string") {
    return {
      success: false,
      message: "No code provided",
      error: "INVALID_INPUT",
      serviceAvailable: true,
    };
  }

  if (code.length > MAX_CODE_SIZE) {
    return {
      success: false,
      message: `Code exceeds maximum size of ${MAX_CODE_SIZE / 1024}KB`,
      error: "CODE_TOO_LARGE",
      serviceAvailable: true,
    };
  }

  const url = getConfiguredCompilerUrl();
  if (!url) {
    // No compiler configured — never send source off-box. The analyze tool
    // treats serviceAvailable=false as "fall back to local static analysis".
    return {
      success: false,
      message:
        "No compiler service configured. Set COMPACT_COMPILER_URL to a compiler you run yourself to enable compilation; contract source is not sent to any third-party by default.",
      error: "COMPILER_NOT_CONFIGURED",
      serviceAvailable: false,
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), COMPILER_TIMEOUT);

  try {
    const requestBody: CompileRequest = {
      code,
      options: {
        wrapWithDefaults: options.wrapWithDefaults ?? true,
        skipZk: options.skipZk ?? true, // Default to fast syntax-only validation
      },
    };

    logger.info("Sending code to compiler service", {
      codeLength: code.length,
      options: requestBody.options,
    });

    const response = await fetch(`${url}/compile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (!response.ok) {
      // Server error (5xx) or client error (4xx)
      const errorText = await response.text().catch(() => "Unknown error");
      logger.error("Compiler API returned error status", {
        status: response.status,
        error: errorText,
      });

      return {
        success: false,
        message: `Compiler service error: ${response.status}`,
        error: "API_ERROR",
        serviceAvailable: response.status < 500,
      };
    }

    const rawResult: unknown = await response.json();

    // Runtime validation of compiler response
    if (
      typeof rawResult !== "object" ||
      rawResult === null ||
      !("success" in rawResult)
    ) {
      logger.error("Compiler API returned unexpected response format", {
        response: JSON.stringify(rawResult).slice(0, 200),
      });
      return {
        success: false,
        message: "Compiler service returned an unexpected response format",
        error: "INVALID_RESPONSE",
        serviceAvailable: true,
      };
    }

    const result = rawResult as CompileResponse;

    if (result.success) {
      // Handle both detailed output object and simple string output
      const outputInfo =
        typeof result.output === "object" && result.output !== null
          ? result.output
          : {};

      logger.info("Compilation successful", {
        compilerVersion: result.compilerVersion,
        executionTime: result.executionTime,
        circuits: (outputInfo as { circuits?: string[] }).circuits?.length || 0,
        warnings: result.warnings?.length || 0,
      });

      const version = result.compilerVersion || "unknown";
      const execTime = result.executionTime
        ? ` in ${result.executionTime}ms`
        : "";

      return {
        success: true,
        compilerVersion: version,
        message: `✅ Compilation successful (Compiler v${version})${execTime}`,
        circuits: (outputInfo as { circuits?: string[] }).circuits || [],
        ledgerFields:
          (outputInfo as { ledgerFields?: string[] }).ledgerFields || [],
        exports: (outputInfo as { exports?: string[] }).exports || [],
        warnings: result.warnings || [],
        serviceAvailable: true,
      };
    } else {
      // Handle error response with detailed errors array
      const errors = result.errors || [];
      const firstError = errors[0];

      logger.info("Compilation failed", {
        error: result.error,
        errorCount: errors.length,
        output: result.output,
        firstError,
      });

      // Build a readable error message
      let errorMessage =
        result.output || result.message || result.error || "Compilation failed";

      if (firstError) {
        errorMessage = `Line ${firstError.line}:${firstError.column} - ${firstError.message}`;
      }

      return {
        success: false,
        message: errorMessage,
        error: result.error || "COMPILE_ERROR",
        errors: errors,
        errorDetails: firstError
          ? {
              line: firstError.line,
              column: firstError.column,
              errorType: firstError.severity,
            }
          : result.details,
        serviceAvailable: true,
      };
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Check if it was a timeout/abort
    if (error instanceof Error && error.name === "AbortError") {
      logger.warn("Compiler request timed out");
      return {
        success: false,
        message: "Compilation timed out - the contract may be too complex",
        error: "TIMEOUT",
        serviceAvailable: true,
      };
    }

    // Network or other error
    logger.error("Compiler service request failed", { error: errorMessage });
    return {
      success: false,
      message: `Failed to connect to compiler service: ${errorMessage}`,
      error: "CONNECTION_FAILED",
      serviceAvailable: false,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Quick syntax validation (skips ZK generation for faster response)
 */
export async function validateSyntax(code: string): Promise<CompilationResult> {
  return compileContract(code, {
    wrapWithDefaults: true,
    skipZk: true,
  });
}

/**
 * Full compilation with ZK circuit generation
 */
export async function fullCompile(code: string): Promise<CompilationResult> {
  return compileContract(code, {
    wrapWithDefaults: true,
    skipZk: false,
  });
}

/**
 * Get compiler service URL (for diagnostics)
 */
export function getCompilerUrl(): string | undefined {
  return getConfiguredCompilerUrl();
}
