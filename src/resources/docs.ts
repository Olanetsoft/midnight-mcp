/**
 * Documentation resources
 * Provides access to Midnight documentation via MCP resources
 */

import { githubClient } from "../pipeline/index.js";
import { logger } from "../utils/index.js";
import { EMBEDDED_DOCS } from "./content/index.js";
import type { ResourceDefinition } from "./schemas.js";

// Documentation resource URIs
export const documentationResources: ResourceDefinition[] = [
  {
    uri: "midnight://docs/compact-reference",
    name: "Compact Language Reference",
    description:
      "Complete Compact language reference including syntax, types, built-in functions, and circuit definitions",
    mimeType: "text/markdown",
  },
  {
    uri: "midnight://docs/sdk-api",
    name: "TypeScript SDK API",
    description:
      "TypeScript SDK API documentation with type signatures and usage examples",
    mimeType: "text/markdown",
  },
  {
    uri: "midnight://docs/concepts/zero-knowledge",
    name: "Zero-Knowledge Proofs",
    description:
      "Conceptual documentation about zero-knowledge proofs in Midnight",
    mimeType: "text/markdown",
  },
  {
    uri: "midnight://docs/concepts/shielded-state",
    name: "Shielded State",
    description:
      "Understanding shielded (private) vs unshielded (public) state in Midnight",
    mimeType: "text/markdown",
  },
  {
    uri: "midnight://docs/concepts/witnesses",
    name: "Witness Functions",
    description:
      "How witness functions work in Midnight for off-chain computation",
    mimeType: "text/markdown",
  },
  {
    uri: "midnight://docs/concepts/kachina",
    name: "Kachina Protocol",
    description: "The Kachina protocol underlying Midnight's privacy features",
    mimeType: "text/markdown",
  },
  {
    uri: "midnight://docs/openzeppelin",
    name: "OpenZeppelin Contracts for Compact",
    description:
      "Official OpenZeppelin library documentation - the recommended source for token contracts, access control, and security patterns",
    mimeType: "text/markdown",
  },
  {
    uri: "midnight://docs/openzeppelin/token",
    name: "OpenZeppelin FungibleToken",
    description:
      "Official token contract implementation - the recommended standard for tokens on Midnight",
    mimeType: "text/markdown",
  },
  {
    uri: "midnight://docs/openzeppelin/access",
    name: "OpenZeppelin Access Control",
    description:
      "Ownable, roles, and access control patterns from OpenZeppelin",
    mimeType: "text/markdown",
  },
  {
    uri: "midnight://docs/openzeppelin/security",
    name: "OpenZeppelin Security",
    description: "Pausable and other security patterns from OpenZeppelin",
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
