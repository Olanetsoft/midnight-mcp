/**
 * Search utilities for result formatting and scoring
 */

import type { SearchResponse } from "../interfaces";

/**
 * Format Vectorize matches into API response format
 */
export function formatResults(
  matches: VectorizeMatches["matches"],
  query: string
): SearchResponse {
  return {
    results: matches.map((match) => ({
      content: (match.metadata?.content as string) || "",
      relevanceScore: match.score,
      source: {
        repository: (match.metadata?.repository as string) || "",
        filePath: (match.metadata?.filePath as string) || "",
        lines: match.metadata?.startLine
          ? `${match.metadata.startLine}-${match.metadata.endLine}`
          : undefined,
      },
      codeType: match.metadata?.language as string | undefined,
    })),
    query,
    totalResults: matches.length,
  };
}

/**
 * Hybrid search: boost scores for keyword matches
 */
export function applyKeywordBoost(
  matches: VectorizeMatches["matches"],
  query: string
): VectorizeMatches["matches"] {
  const queryTerms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2); // Ignore short words

  return matches
    .map((match) => {
      const content = ((match.metadata?.content as string) || "").toLowerCase();
      const filePath = (
        (match.metadata?.filePath as string) || ""
      ).toLowerCase();

      // Count keyword matches
      let keywordMatches = 0;
      for (const term of queryTerms) {
        if (content.includes(term)) keywordMatches++;
        if (filePath.includes(term)) keywordMatches += 0.5; // Boost for filename match
      }

      // Apply boost: up to 20% bonus for keyword matches
      const keywordBoost = Math.min(keywordMatches * 0.05, 0.2);
      const boostedScore = Math.min(match.score + keywordBoost, 1.0);

      return { ...match, score: boostedScore };
    })
    .sort((a, b) => b.score - a.score); // Re-sort by boosted score
}
