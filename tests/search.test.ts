import { describe, it, expect } from "vitest";
import { searchTools } from "../src/tools/search.js";

describe("Search Tools", () => {
  describe("Tool Definitions", () => {
    it("should have all three search tools", () => {
      expect(searchTools).toHaveLength(3);
      
      const toolNames = searchTools.map(t => t.name);
      expect(toolNames).toContain("midnight-search-compact");
      expect(toolNames).toContain("midnight-search-typescript");
      expect(toolNames).toContain("midnight-search-docs");
    });

    it("search_compact should have correct schema", () => {
      const tool = searchTools.find(t => t.name === "midnight-search-compact");
      expect(tool).toBeDefined();
      expect(tool!.description).toContain("Compact");
      expect(tool!.inputSchema.properties).toHaveProperty("query");
      expect(tool!.inputSchema.properties).toHaveProperty("limit");
      expect(tool!.inputSchema.required).toContain("query");
    });

    it("search_typescript should have correct schema", () => {
      const tool = searchTools.find(t => t.name === "midnight-search-typescript");
      expect(tool).toBeDefined();
      expect(tool!.description).toContain("TypeScript");
      expect(tool!.inputSchema.properties).toHaveProperty("query");
      expect(tool!.inputSchema.properties).toHaveProperty("includeTypes");
      expect(tool!.inputSchema.properties).toHaveProperty("includeExamples");
    });

    it("search_docs should have correct schema", () => {
      const tool = searchTools.find(t => t.name === "midnight-search-docs");
      expect(tool).toBeDefined();
      expect(tool!.description).toContain("documentation");
      expect(tool!.inputSchema.properties).toHaveProperty("query");
      expect(tool!.inputSchema.properties).toHaveProperty("category");
    });

    it("all search tools should have annotations", () => {
      for (const tool of searchTools) {
        expect(tool.annotations).toBeDefined();
        expect(tool.annotations!.readOnlyHint).toBe(true);
        expect(tool.annotations!.idempotentHint).toBe(true);
      }
    });

    it("all search tools should have output schemas", () => {
      for (const tool of searchTools) {
        expect(tool.outputSchema).toBeDefined();
        expect(tool.outputSchema!.type).toBe("object");
        expect(tool.outputSchema!.properties).toHaveProperty("results");
        expect(tool.outputSchema!.properties).toHaveProperty("totalResults");
        expect(tool.outputSchema!.properties).toHaveProperty("query");
      }
    });
  });

  describe("Search Input Validation", () => {
    it("search_compact should require query parameter", () => {
      const tool = searchTools.find(t => t.name === "midnight-search-compact");
      expect(tool!.inputSchema.required).toContain("query");
    });

    it("limit should be optional with default", () => {
      const tool = searchTools.find(t => t.name === "midnight-search-compact");
      expect(tool!.inputSchema.required).not.toContain("limit");
    });

    it("category enum should have valid values", () => {
      const tool = searchTools.find(t => t.name === "midnight-search-docs");
      const categoryProp = tool!.inputSchema.properties.category as { enum?: string[] };
      expect(categoryProp.enum).toContain("guides");
      expect(categoryProp.enum).toContain("api");
      expect(categoryProp.enum).toContain("concepts");
      expect(categoryProp.enum).toContain("all");
    });
  });
});
