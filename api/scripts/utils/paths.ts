/**
 * File path utilities
 */

import { SKIP_DIRS, EXTENSIONS } from "../constants";

/**
 * Check if a path should be skipped based on directory rules
 */
export function shouldSkipPath(path: string): boolean {
  const parts = path.split("/");
  return parts.some((part) => SKIP_DIRS.has(part));
}

/**
 * Check if a file has a valid extension for indexing
 */
export function hasValidExtension(path: string): boolean {
  const ext = path.substring(path.lastIndexOf("."));
  return ext in EXTENSIONS;
}

/**
 * Get the language for a file based on its extension
 */
export function getLanguageFromPath(path: string): string {
  const ext = path.substring(path.lastIndexOf("."));
  return EXTENSIONS[ext] || "unknown";
}
