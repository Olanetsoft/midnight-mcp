/**
 * Code resources
 * Provides access to Midnight code examples via MCP resources
 */

import { githubClient } from "../pipeline/index.js";
import { logger } from "../utils/index.js";
import { EMBEDDED_CODE } from "./content/index.js";
import type { ResourceDefinition } from "./schemas.js";

// Code example resources
export const codeResources: ResourceDefinition[] = [
  {
    uri: "midnight://code/examples/counter",
    name: "Counter Example",
    description: "Simple counter contract demonstrating basic Compact concepts",
    mimeType: "text/x-compact",
  },
  {
    uri: "midnight://code/examples/bboard",
    name: "Bulletin Board Example",
    description: "Full DApp example with private messaging",
    mimeType: "text/x-compact",
  },
  {
    uri: "midnight://code/patterns/state-management",
    name: "State Management Pattern",
    description: "Best practices for managing public and private state",
    mimeType: "text/x-compact",
  },
  {
    uri: "midnight://code/patterns/access-control",
    name: "Access Control Pattern",
    description: "Implementing access control in Compact contracts",
    mimeType: "text/x-compact",
  },
  {
    uri: "midnight://code/patterns/privacy-preserving",
    name: "Privacy-Preserving Pattern",
    description: "Patterns for maintaining privacy in smart contracts",
    mimeType: "text/x-compact",
  },
  {
    uri: "midnight://code/templates/token",
    name: "Token Template",
    description: "Starter template for privacy-preserving token contracts",
    mimeType: "text/x-compact",
  },
  {
    uri: "midnight://code/templates/voting",
    name: "Voting Template",
    description: "Starter template for private voting contracts",
    mimeType: "text/x-compact",
  },
];

/**
 * Get code content by URI
 */
export async function getCode(uri: string): Promise<string | null> {
  // Check embedded code first
  if (EMBEDDED_CODE[uri]) {
    return EMBEDDED_CODE[uri];
  }

  // Try to fetch from GitHub for example paths
  if (uri.startsWith("midnight://code/examples/")) {
    const exampleName = uri.replace("midnight://code/examples/", "");
    try {
      // Map example names to repositories
      const repoMap: Record<
        string,
        { owner: string; repo: string; path: string }
      > = {
        counter: {
          owner: "midnightntwrk",
          repo: "example-counter",
          path: "contract/src/counter.compact",
        },
        bboard: {
          owner: "midnightntwrk",
          repo: "example-bboard",
          path: "contract/src/bboard.compact",
        },
      };

      const mapping = repoMap[exampleName];
      if (mapping) {
        const file = await githubClient.getFileContent(
          mapping.owner,
          mapping.repo,
          mapping.path
        );
        if (file) {
          return file.content;
        }
      }
    } catch (error) {
      logger.warn(`Could not fetch code from GitHub: ${uri}`);
    }
  }

  return null;
}

/**
 * List all available code resources
 */
export function listCodeResources(): ResourceDefinition[] {
  return codeResources;
}
