/**
 * Common utility functions
 */

import { createHash } from "crypto";

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Hash content using SHA-256 (truncated to 16 chars)
 */
export function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex").substring(0, 16);
}
