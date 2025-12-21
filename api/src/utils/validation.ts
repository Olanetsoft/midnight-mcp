/**
 * Validation utilities for API requests
 */

/**
 * Validate and sanitize query string
 */
export function validateQuery(query: unknown): string | null {
  if (typeof query !== "string") return null;
  const trimmed = query.trim();
  if (trimmed.length === 0 || trimmed.length > 1000) return null;
  return trimmed;
}

/**
 * Validate limit parameter (1-50)
 */
export function validateLimit(limit: unknown): number {
  if (typeof limit !== "number") return 10;
  return Math.min(Math.max(1, limit), 50);
}
