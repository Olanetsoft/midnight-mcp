/**
 * Type definitions for the indexing script
 */

export interface RepoConfig {
  owner: string;
  repo: string;
  branch: string;
}

export interface Document {
  id: string;
  content: string;
  metadata: {
    repository: string;
    filePath: string;
    language: string;
    startLine: number;
    endLine: number;
    indexedAt: string;
  };
}

export interface FileCacheEntry {
  hash: string;
  vectorIds: string[]; // Track vector IDs for cleanup
}

export interface FileCache {
  [filePath: string]: FileCacheEntry;
}

export interface IndexResult {
  repo: string;
  success: boolean;
  documents: number;
  skipped: number;
  deleted: number;
  error?: string;
}

export interface ExtractedFile {
  path: string;
  content: string;
}

export interface ExtractionResult {
  files: ExtractedFile[];
  newCache: FileCache;
  skipped: number;
}
