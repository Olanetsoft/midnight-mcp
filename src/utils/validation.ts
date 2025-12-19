/**
 * Input validation and sanitization utilities
 * Protects against injection attacks and malformed inputs
 */

// Maximum allowed lengths for different input types
const MAX_LENGTHS = {
  query: 1000,
  path: 500,
  repository: 100,
  ref: 100,
  generic: 500,
} as const;

// Patterns that could indicate injection attempts
const DANGEROUS_PATTERNS = [
  /[<>]/g, // HTML/XML injection
  /javascript:/gi, // JS protocol
  /data:/gi, // Data URLs
  /\0/g, // Null bytes
  /[\x00-\x08\x0B\x0C\x0E-\x1F]/g, // Control characters (except newline, tab)
];

// Valid characters for different input types
const VALID_PATTERNS = {
  // Repository names: alphanumeric, hyphens, underscores, slashes
  repository: /^[a-zA-Z0-9_\-./]+$/,
  // Git refs: alphanumeric, hyphens, underscores, dots, slashes
  ref: /^[a-zA-Z0-9_\-./]+$/,
  // File paths: most characters except dangerous ones
  path: /^[a-zA-Z0-9_\-./\s]+$/,
};

export interface ValidationResult {
  isValid: boolean;
  sanitized: string;
  warnings: string[];
  errors: string[];
}

/**
 * Sanitize a string by removing dangerous patterns
 */
export function sanitizeString(
  input: string,
  maxLength: number = MAX_LENGTHS.generic
): string {
  if (!input || typeof input !== "string") {
    return "";
  }

  let sanitized = input;

  // Remove dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    sanitized = sanitized.replace(pattern, "");
  }

  // Trim whitespace
  sanitized = sanitized.trim();

  // Truncate to max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Validate and sanitize a search query
 */
export function validateQuery(query: unknown): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (query === null || query === undefined) {
    return {
      isValid: false,
      sanitized: "",
      warnings,
      errors: ["Query is required"],
    };
  }

  if (typeof query !== "string") {
    return {
      isValid: false,
      sanitized: "",
      warnings,
      errors: ["Query must be a string"],
    };
  }

  const sanitized = sanitizeString(query, MAX_LENGTHS.query);

  if (sanitized.length === 0) {
    errors.push("Query cannot be empty after sanitization");
  }

  if (sanitized.length < 2) {
    warnings.push("Query is very short, results may be limited");
  }

  if (query.length !== sanitized.length) {
    warnings.push(
      "Query was sanitized to remove potentially dangerous characters"
    );
  }

  return {
    isValid: errors.length === 0,
    sanitized,
    warnings,
    errors,
  };
}

/**
 * Validate and sanitize a repository name
 */
export function validateRepository(repo: unknown): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (repo === null || repo === undefined) {
    return {
      isValid: false,
      sanitized: "",
      warnings,
      errors: ["Repository name is required"],
    };
  }

  if (typeof repo !== "string") {
    return {
      isValid: false,
      sanitized: "",
      warnings,
      errors: ["Repository name must be a string"],
    };
  }

  const sanitized = sanitizeString(repo, MAX_LENGTHS.repository);

  if (!VALID_PATTERNS.repository.test(sanitized)) {
    errors.push("Repository name contains invalid characters");
  }

  // Check for path traversal attempts
  if (sanitized.includes("..")) {
    errors.push("Repository name cannot contain path traversal sequences");
  }

  return {
    isValid: errors.length === 0,
    sanitized,
    warnings,
    errors,
  };
}

/**
 * Validate and sanitize a file path
 */
export function validatePath(path: unknown): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (path === null || path === undefined) {
    return {
      isValid: false,
      sanitized: "",
      warnings,
      errors: ["Path is required"],
    };
  }

  if (typeof path !== "string") {
    return {
      isValid: false,
      sanitized: "",
      warnings,
      errors: ["Path must be a string"],
    };
  }

  let sanitized = sanitizeString(path, MAX_LENGTHS.path);

  // Normalize path separators
  sanitized = sanitized.replace(/\\/g, "/");

  // Remove leading slashes
  sanitized = sanitized.replace(/^\/+/, "");

  // Check for path traversal attempts
  if (sanitized.includes("..")) {
    errors.push("Path cannot contain traversal sequences (..)");
  }

  // Check for absolute paths
  if (path.startsWith("/") || /^[a-zA-Z]:/.test(path)) {
    warnings.push("Absolute paths are converted to relative paths");
  }

  return {
    isValid: errors.length === 0,
    sanitized,
    warnings,
    errors,
  };
}

/**
 * Validate and sanitize a git ref (branch, tag, or commit)
 */
export function validateRef(ref: unknown): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Ref is optional, so null/undefined is valid
  if (ref === null || ref === undefined) {
    return {
      isValid: true,
      sanitized: "",
      warnings,
      errors,
    };
  }

  if (typeof ref !== "string") {
    return {
      isValid: false,
      sanitized: "",
      warnings,
      errors: ["Ref must be a string"],
    };
  }

  const sanitized = sanitizeString(ref, MAX_LENGTHS.ref);

  if (!VALID_PATTERNS.ref.test(sanitized)) {
    errors.push("Ref contains invalid characters");
  }

  // Check for path traversal
  if (sanitized.includes("..")) {
    errors.push("Ref cannot contain path traversal sequences");
  }

  return {
    isValid: errors.length === 0,
    sanitized,
    warnings,
    errors,
  };
}

/**
 * Validate a numeric input within bounds
 */
export function validateNumber(
  value: unknown,
  options: { min?: number; max?: number; defaultValue: number }
): { isValid: boolean; value: number; error?: string } {
  const { min = 1, max = 100, defaultValue } = options;

  if (value === null || value === undefined) {
    return { isValid: true, value: defaultValue };
  }

  const num = typeof value === "string" ? parseInt(value, 10) : value;

  if (typeof num !== "number" || isNaN(num)) {
    return {
      isValid: false,
      value: defaultValue,
      error: "Must be a valid number",
    };
  }

  if (num < min) {
    return { isValid: true, value: min };
  }

  if (num > max) {
    return { isValid: true, value: max };
  }

  return { isValid: true, value: num };
}

/**
 * Validate tool arguments with automatic sanitization
 */
export function validateToolArgs<T extends Record<string, unknown>>(
  args: T,
  validators: Partial<Record<keyof T, (value: unknown) => ValidationResult>>
): {
  isValid: boolean;
  sanitized: Partial<T>;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const sanitized: Partial<T> = { ...args };

  for (const [key, validator] of Object.entries(validators)) {
    if (validator && key in args) {
      const result = (validator as (value: unknown) => ValidationResult)(
        args[key]
      );

      if (!result.isValid) {
        errors.push(`${key}: ${result.errors.join(", ")}`);
      }

      warnings.push(...result.warnings.map((w) => `${key}: ${w}`));
      (sanitized as Record<string, unknown>)[key] =
        result.sanitized || args[key];
    }
  }

  return {
    isValid: errors.length === 0,
    sanitized,
    errors,
    warnings,
  };
}
