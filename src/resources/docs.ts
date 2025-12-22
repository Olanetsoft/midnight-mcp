/**
 * Documentation resources
 * Provides access to Midnight documentation via MCP resources
 */

import { githubClient } from "../pipeline/index.js";
import { logger } from "../utils/index.js";
import { EMBEDDED_DOCS } from "./content/index.js";
import type { ResourceDefinition } from "./schemas.js";

// Documentation resource URIs
// NOTE: Only resources with embedded content are listed here.
// For other docs (glossary, Zswap, Kachina, etc.), use search_docs tool
// which queries the indexed Vector DB for the full midnight-docs repo.
export const documentationResources: ResourceDefinition[] = [
  {
    uri: "midnight://docs/compact-reference",
    name: "Compact Language Reference",
    description:
      "Quick reference for Compact syntax, types, circuits, and witnesses",
    mimeType: "text/markdown",
  },
  {
    uri: "midnight://docs/sdk-api",
    name: "TypeScript SDK API",
    description:
      "TypeScript SDK API reference with type signatures and usage examples",
    mimeType: "text/markdown",
  },
  {
    uri: "midnight://docs/openzeppelin",
    name: "OpenZeppelin Contracts for Compact",
    description:
      "Official OpenZeppelin library - tokens, access control, security patterns",
    mimeType: "text/markdown",
  },
  {
    uri: "midnight://docs/openzeppelin/token",
    name: "OpenZeppelin FungibleToken",
    description: "Privacy-preserving token standard for Midnight",
    mimeType: "text/markdown",
  },
  {
    uri: "midnight://docs/openzeppelin/access",
    name: "OpenZeppelin Access Control",
    description: "Ownable, roles, and access control patterns",
    mimeType: "text/markdown",
  },
  {
    uri: "midnight://docs/openzeppelin/security",
    name: "OpenZeppelin Security",
    description: "Pausable and security patterns",
    mimeType: "text/markdown",
  },
  {
    uri: "midnight://docs/tokenomics",
    name: "Tokenomics Summary",
    description:
      "Curated summary: NIGHT token, DUST resource, block rewards, Glacier Drop distribution",
    mimeType: "text/markdown",
  },
  {
    uri: "midnight://docs/wallet-integration",
    name: "Wallet Integration Guide",
    description:
      "DApp Connector API for Midnight Lace wallet - React hooks, TypeScript types",
    mimeType: "text/markdown",
  },
];

/**
 * Get documentation content by URI
 */
export async function getDocumentation(uri: string): Promise<string | null> {
  // Check embedded docs first
  if (EMBEDDED_DOCS[uri]) {
    return EMBEDDED_DOCS[uri];
  }

  // Try to fetch from GitHub if it's a doc path
  if (uri.startsWith("midnight://docs/")) {
    const docPath = uri.replace("midnight://docs/", "");
    try {
      // Try to fetch from midnight-docs repo
      const file = await githubClient.getFileContent(
        "midnightntwrk",
        "midnight-docs",
        `docs/${docPath}.md`
      );
      if (file) {
        return file.content;
      }
    } catch (error) {
      logger.warn(`Could not fetch doc from GitHub: ${uri}`);
    }
  }

  return null;
}

/**
 * List all available documentation resources
 */
export function listDocumentationResources(): ResourceDefinition[] {
  return documentationResources;
}
