export { config, isHostedMode, isLocalMode } from "./config.js";
export type { Config, RepositoryConfig } from "./config.js";
export { DEFAULT_REPOSITORIES } from "./config.js";
export { logger, setMCPLogCallback } from "./logger.js";
export {
  MCPError,
  ErrorCodes,
  createUserError,
  formatErrorResponse,
  withErrorHandling,
  SelfCorrectionHints,
} from "./errors.js";

// Validation utilities
export {
  validateQuery,
  validateRepository,
  validatePath,
  validateRef,
  validateNumber,
  validateToolArgs,
  sanitizeString,
} from "./validation.js";
export type { ValidationResult } from "./validation.js";

// Health check utilities
export { getHealthStatus, getQuickHealthStatus } from "./health.js";
export type { HealthStatus } from "./health.js";

// Rate limit tracking
export {
  updateRateLimitFromHeaders,
  updateRateLimit,
  getRateLimitStatus,
  shouldProceedWithRequest,
  getTimeUntilReset,
  formatRateLimitStatus,
  decrementRemaining,
} from "./rate-limit.js";
export type { RateLimitInfo, RateLimitStatus } from "./rate-limit.js";

// Caching utilities
export {
  Cache,
  createCacheKey,
  searchCache,
  fileCache,
  metadataCache,
  pruneAllCaches,
} from "./cache.js";
export type { CacheOptions, CacheEntry, CacheStats } from "./cache.js";

// Hosted API client
export {
  searchCompactHosted,
  searchTypeScriptHosted,
  searchDocsHosted,
  searchHosted,
  checkHostedApiHealth,
  getHostedApiStats,
} from "./hosted-api.js";
export type {
  HostedSearchResult,
  HostedSearchResponse,
  HostedSearchFilter,
} from "./hosted-api.js";
