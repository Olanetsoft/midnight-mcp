/**
 * Rate limit tracking and management utilities
 * Tracks GitHub API rate limits and warns before hitting limits
 */

import { logger } from "./logger.js";

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  used: number;
}

export interface RateLimitStatus {
  isLimited: boolean;
  isWarning: boolean;
  remaining: number;
  limit: number;
  resetAt: Date;
  percentUsed: number;
  message: string;
}

// Warning threshold - warn when this percentage of rate limit is used
const WARNING_THRESHOLD = 0.8; // 80%

// Critical threshold - consider limited when this percentage is used
const CRITICAL_THRESHOLD = 0.95; // 95%

// Cached rate limit info
let cachedRateLimit: RateLimitInfo | null = null;
let lastUpdate = 0;
const CACHE_TTL = 60 * 1000; // 1 minute cache

/**
 * Update rate limit info from API response headers
 */
export function updateRateLimitFromHeaders(
  headers: Record<string, string | undefined>
): void {
  const limit = parseInt(headers["x-ratelimit-limit"] || "5000", 10);
  const remaining = parseInt(headers["x-ratelimit-remaining"] || "5000", 10);
  const resetTimestamp = parseInt(headers["x-ratelimit-reset"] || "0", 10);

  cachedRateLimit = {
    limit,
    remaining,
    reset: new Date(resetTimestamp * 1000),
    used: limit - remaining,
  };
  lastUpdate = Date.now();

  // Log warning if approaching limit
  const percentUsed = (cachedRateLimit.used / cachedRateLimit.limit) * 100;
  if (percentUsed >= WARNING_THRESHOLD * 100) {
    logger.warn("GitHub API rate limit warning", {
      remaining: cachedRateLimit.remaining,
      limit: cachedRateLimit.limit,
      percentUsed: Math.round(percentUsed),
      resetAt: cachedRateLimit.reset.toISOString(),
    });
  }
}

/**
 * Update rate limit info directly
 */
export function updateRateLimit(info: RateLimitInfo): void {
  cachedRateLimit = info;
  lastUpdate = Date.now();
}

/**
 * Get current rate limit status
 */
export function getRateLimitStatus(): RateLimitStatus {
  if (!cachedRateLimit) {
    return {
      isLimited: false,
      isWarning: false,
      remaining: 5000,
      limit: 5000,
      resetAt: new Date(),
      percentUsed: 0,
      message: "Rate limit info not yet available",
    };
  }

  const percentUsed = cachedRateLimit.used / cachedRateLimit.limit;
  const isWarning = percentUsed >= WARNING_THRESHOLD;
  const isLimited =
    percentUsed >= CRITICAL_THRESHOLD || cachedRateLimit.remaining <= 10;

  let message: string;
  if (isLimited) {
    const minutesUntilReset = Math.ceil(
      (cachedRateLimit.reset.getTime() - Date.now()) / 60000
    );
    message = `Rate limited! Resets in ${minutesUntilReset} minutes`;
  } else if (isWarning) {
    message = `Warning: ${cachedRateLimit.remaining} API calls remaining (${Math.round(percentUsed * 100)}% used)`;
  } else {
    message = `${cachedRateLimit.remaining}/${cachedRateLimit.limit} API calls remaining`;
  }

  return {
    isLimited,
    isWarning,
    remaining: cachedRateLimit.remaining,
    limit: cachedRateLimit.limit,
    resetAt: cachedRateLimit.reset,
    percentUsed: Math.round(percentUsed * 100),
    message,
  };
}

/**
 * Check if we should proceed with an API call
 * Returns true if safe to proceed, false if we should wait/fail
 */
export function shouldProceedWithRequest(): {
  proceed: boolean;
  reason?: string;
  waitMs?: number;
} {
  if (!cachedRateLimit) {
    return { proceed: true };
  }

  if (cachedRateLimit.remaining <= 10) {
    const waitMs = Math.max(0, cachedRateLimit.reset.getTime() - Date.now());
    return {
      proceed: false,
      reason: `Rate limit nearly exhausted (${cachedRateLimit.remaining} remaining)`,
      waitMs,
    };
  }

  return { proceed: true };
}

/**
 * Get time until rate limit resets
 */
export function getTimeUntilReset(): number {
  if (!cachedRateLimit) {
    return 0;
  }
  return Math.max(0, cachedRateLimit.reset.getTime() - Date.now());
}

/**
 * Check if cached rate limit info is stale
 */
export function isRateLimitStale(): boolean {
  return Date.now() - lastUpdate > CACHE_TTL;
}

/**
 * Get cached rate limit info
 */
export function getCachedRateLimit(): RateLimitInfo | null {
  return cachedRateLimit;
}

/**
 * Decrement remaining count (for optimistic tracking)
 */
export function decrementRemaining(): void {
  if (cachedRateLimit && cachedRateLimit.remaining > 0) {
    cachedRateLimit.remaining--;
    cachedRateLimit.used++;
  }
}

/**
 * Format rate limit status for display
 */
export function formatRateLimitStatus(): string {
  const status = getRateLimitStatus();

  if (status.isLimited) {
    return `⛔ ${status.message}`;
  } else if (status.isWarning) {
    return `⚠️ ${status.message}`;
  } else {
    return `✅ ${status.message}`;
  }
}
