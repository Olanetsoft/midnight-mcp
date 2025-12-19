/**
 * Generic caching utilities for MCP server
 * Provides TTL-based caching with memory management
 */

import { logger } from "./logger.js";

export interface CacheOptions {
  ttl: number; // Time to live in milliseconds
  maxSize?: number; // Maximum number of entries
  name?: string; // Cache name for logging
}

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

/**
 * Generic cache implementation with TTL and size limits
 */
export class Cache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private options: Required<CacheOptions>;
  private stats = { hits: 0, misses: 0 };

  constructor(options: CacheOptions) {
    this.options = {
      ttl: options.ttl,
      maxSize: options.maxSize || 1000,
      name: options.name || "cache",
    };
  }

  /**
   * Get a value from the cache
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return undefined;
    }

    this.stats.hits++;
    return entry.value;
  }

  /**
   * Set a value in the cache
   */
  set(key: string, value: T, ttl?: number): void {
    // Enforce size limit
    if (this.cache.size >= this.options.maxSize) {
      this.evictOldest();
    }

    const now = Date.now();
    this.cache.set(key, {
      value,
      expiresAt: now + (ttl || this.options.ttl),
      createdAt: now,
    });
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete a key from the cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries from the cache
   */
  clear(): void {
    this.cache.clear();
    logger.debug(`Cache cleared: ${this.options.name}`);
  }

  /**
   * Remove expired entries
   */
  prune(): number {
    const now = Date.now();
    let pruned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        pruned++;
      }
    }

    if (pruned > 0) {
      logger.debug(`Cache pruned: ${this.options.name}`, { pruned });
    }

    return pruned;
  }

  /**
   * Evict the oldest entry to make room
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  /**
   * Get or set with a factory function
   */
  async getOrSet(
    key: string,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await factory();
    this.set(key, value, ttl);
    return value;
  }
}

/**
 * Create a cache key from multiple parts
 */
export function createCacheKey(
  ...parts: (string | number | boolean | undefined)[]
): string {
  return parts
    .filter((p) => p !== undefined)
    .map((p) => String(p))
    .join(":");
}

// Pre-configured caches for common use cases
export const searchCache = new Cache<unknown>({
  ttl: 5 * 60 * 1000, // 5 minutes
  maxSize: 500,
  name: "search",
});

export const fileCache = new Cache<string>({
  ttl: 10 * 60 * 1000, // 10 minutes
  maxSize: 200,
  name: "file",
});

export const metadataCache = new Cache<unknown>({
  ttl: 15 * 60 * 1000, // 15 minutes
  maxSize: 100,
  name: "metadata",
});

/**
 * Prune all caches periodically
 */
export function pruneAllCaches(): void {
  searchCache.prune();
  fileCache.prune();
  metadataCache.prune();
}

// Auto-prune every 5 minutes
setInterval(pruneAllCaches, 5 * 60 * 1000);
