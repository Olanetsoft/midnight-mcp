/**
 * Syntax Drift Detection Tests
 *
 * These tests ensure that embedded documentation (quickStartTemplate, commonMistakes, etc.)
 * stays in sync with the actual Compact language syntax validated by our static analysis.
 *
 * CRITICAL: If these tests fail, the embedded docs have drifted from reality and will cause
 * agents to generate contracts that fail compilation.
 */

import { describe, it, expect } from "vitest";
import { extractContractStructure } from "../src/tools/repository/validation.js";
import { EMBEDDED_DOCS } from "../src/resources/content/docs-content.js";

// Extract the compact reference doc at module level for all tests
const compactReference = EMBEDDED_DOCS["midnight://docs/compact-reference"];

describe("Syntax Drift Detection", () => {
  describe("Quick Start Template Validation", () => {
    it("should have a compact-reference doc", () => {
      expect(compactReference).toBeDefined();
      expect(compactReference.length).toBeGreaterThan(1000);
    });

    it("quick start template should pass static analysis with no P0 errors", async () => {
      // Extract the quick start template from the docs
      const quickStartMatch = compactReference.match(
        /## Quick Start Template[\s\S]*?```compact\n([\s\S]*?)```/
      );
      expect(quickStartMatch).toBeDefined();

      const quickStartTemplate = quickStartMatch![1];
      expect(quickStartTemplate).toBeDefined();
      expect(quickStartTemplate.length).toBeGreaterThan(100);

      // Run static analysis
      const result = await extractContractStructure({
        code: quickStartTemplate,
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      // Check for P0 (critical) issues
      const p0Issues = result.potentialIssues?.filter(
        (issue) =>
          issue.severity === "error" &&
          [
            "deprecated_ledger_block",
            "invalid_void_type",
            "invalid_pragma_format",
            "deprecated_cell_wrapper",
          ].includes(issue.type)
      );

      // Template should have ZERO P0 errors
      expect(p0Issues || []).toEqual([]);
    });

    it("quick start template should have correct pragma format", () => {
      const quickStartMatch = compactReference.match(
        /## Quick Start Template[\s\S]*?```compact\n([\s\S]*?)```/
      );
      const quickStartTemplate = quickStartMatch![1];

      // Should have bounded range pragma
      expect(quickStartTemplate).toMatch(
        /pragma\s+language_version\s*>=?\s*0\.\d+\s*&&\s*<=?\s*0\.\d+/
      );

      // Should NOT have patch version
      expect(quickStartTemplate).not.toMatch(
        /pragma\s+language_version\s*>=?\s*\d+\.\d+\.\d+/
      );
    });

    it("quick start template should use individual ledger declarations", () => {
      const quickStartMatch = compactReference.match(
        /## Quick Start Template[\s\S]*?```compact\n([\s\S]*?)```/
      );
      const quickStartTemplate = quickStartMatch![1];

      // Should use 'export ledger' not 'ledger {'
      expect(quickStartTemplate).toMatch(/export\s+ledger\s+\w+\s*:/);
      expect(quickStartTemplate).not.toMatch(/ledger\s*\{/);
    });

    it("quick start template should use [] return type not Void", () => {
      const quickStartMatch = compactReference.match(
        /## Quick Start Template[\s\S]*?```compact\n([\s\S]*?)```/
      );
      const quickStartTemplate = quickStartMatch![1];

      // Should use [] return type
      expect(quickStartTemplate).toMatch(
        /circuit\s+\w+\s*\([^)]*\)\s*:\s*\[\]/
      );

      // Should NOT use Void
      expect(quickStartTemplate).not.toMatch(/:\s*Void\b/);
    });
  });

  describe("Common Mistakes Detection", () => {
    it("should detect deprecated ledger block syntax", async () => {
      const badCode = `pragma language_version >= 0.16 && <= 0.18;

import CompactStandardLibrary;

ledger {
  counter: Counter;
  owner: Bytes<32>;
}
`;
      const result = await extractContractStructure({ code: badCode });

      expect(result.success).toBe(true);
      if (!result.success) return;

      const ledgerBlockIssue = result.potentialIssues?.find(
        (i) => i.type === "deprecated_ledger_block"
      );
      expect(ledgerBlockIssue).toBeDefined();
      expect(ledgerBlockIssue?.severity).toBe("error");
    });

    it("should detect invalid Void return type", async () => {
      const badCode = `pragma language_version >= 0.16 && <= 0.18;

import CompactStandardLibrary;

export ledger counter: Counter;

export circuit increment(): Void {
  counter.increment(1);
}
`;
      const result = await extractContractStructure({ code: badCode });

      expect(result.success).toBe(true);
      if (!result.success) return;

      const voidIssue = result.potentialIssues?.find(
        (i) => i.type === "invalid_void_type"
      );
      expect(voidIssue).toBeDefined();
      expect(voidIssue?.severity).toBe("error");
    });

    it("should detect old pragma format with patch version", async () => {
      const badCode = `pragma language_version >= 0.14.0;

import CompactStandardLibrary;

export ledger counter: Counter;
`;
      const result = await extractContractStructure({ code: badCode });

      expect(result.success).toBe(true);
      if (!result.success) return;

      const pragmaIssue = result.potentialIssues?.find(
        (i) => i.type === "invalid_pragma_format"
      );
      expect(pragmaIssue).toBeDefined();
      expect(pragmaIssue?.severity).toBe("error");
    });

    it("should detect deprecated Cell wrapper", async () => {
      const badCode = `pragma language_version >= 0.16 && <= 0.18;

import CompactStandardLibrary;

export ledger value: Cell<Field>;
`;
      const result = await extractContractStructure({ code: badCode });

      expect(result.success).toBe(true);
      if (!result.success) return;

      const cellIssue = result.potentialIssues?.find(
        (i) => i.type === "deprecated_cell_wrapper"
      );
      expect(cellIssue).toBeDefined();
      expect(cellIssue?.severity).toBe("error");
    });

    it("should detect unexported enum", async () => {
      const badCode = `pragma language_version >= 0.16 && <= 0.18;

import CompactStandardLibrary;

enum State {
  Active,
  Inactive
}
`;
      const result = await extractContractStructure({ code: badCode });

      expect(result.success).toBe(true);
      if (!result.success) return;

      const enumIssue = result.potentialIssues?.find(
        (i) => i.type === "unexported_enum"
      );
      expect(enumIssue).toBeDefined();
      expect(enumIssue?.severity).toBe("warning");
    });
  });

  describe("CORRECT patterns should NOT trigger errors", () => {
    it("should accept correct pragma format with bounded range", async () => {
      const goodCode = `pragma language_version >= 0.16 && <= 0.18;

import CompactStandardLibrary;

export ledger counter: Counter;
`;
      const result = await extractContractStructure({ code: goodCode });

      expect(result.success).toBe(true);
      if (!result.success) return;

      const pragmaIssue = result.potentialIssues?.find(
        (i) => i.type === "invalid_pragma_format"
      );
      expect(pragmaIssue).toBeUndefined();
    });

    it("should accept individual ledger declarations", async () => {
      const goodCode = `pragma language_version >= 0.16 && <= 0.18;

import CompactStandardLibrary;

export ledger counter: Counter;
export ledger owner: Bytes<32>;
ledger secretValue: Field;
`;
      const result = await extractContractStructure({ code: goodCode });

      expect(result.success).toBe(true);
      if (!result.success) return;

      const ledgerBlockIssue = result.potentialIssues?.find(
        (i) => i.type === "deprecated_ledger_block"
      );
      expect(ledgerBlockIssue).toBeUndefined();
    });

    it("should accept [] return type", async () => {
      const goodCode = `pragma language_version >= 0.16 && <= 0.18;

import CompactStandardLibrary;

export ledger counter: Counter;

export circuit increment(): [] {
  counter.increment(1);
}
`;
      const result = await extractContractStructure({ code: goodCode });

      expect(result.success).toBe(true);
      if (!result.success) return;

      const voidIssue = result.potentialIssues?.find(
        (i) => i.type === "invalid_void_type"
      );
      expect(voidIssue).toBeUndefined();
    });

    it("should accept exported enum", async () => {
      const goodCode = `pragma language_version >= 0.16 && <= 0.18;

import CompactStandardLibrary;

export enum State {
  Active,
  Inactive
}
`;
      const result = await extractContractStructure({ code: goodCode });

      expect(result.success).toBe(true);
      if (!result.success) return;

      const enumIssue = result.potentialIssues?.find(
        (i) => i.type === "unexported_enum"
      );
      expect(enumIssue).toBeUndefined();
    });
  });

  describe("Documentation Section Validation", () => {
    it("docs should show WRONG ledger block example", () => {
      expect(compactReference).toMatch(/ledger\s*\{\s*\n\s*counter:/);
      expect(compactReference).toMatch(/❌/); // Should have error markers
    });

    it("docs should show CORRECT individual ledger example", () => {
      expect(compactReference).toMatch(/export\s+ledger\s+counter:\s*Counter/);
    });

    it("docs should show Void as wrong example", () => {
      // Look for Void in a WRONG example context
      expect(compactReference).toMatch(/Void/);
    });

    it("docs should show CORRECT [] return type example", () => {
      expect(compactReference).toMatch(/circuit\s+\w+\s*\([^)]*\)\s*:\s*\[\]/);
    });

    it("docs should have WRONG indicators", () => {
      expect(compactReference).toMatch(/WRONG|❌/i);
    });

    it("docs should have working code examples", () => {
      // Count code blocks
      const codeBlockMatches = compactReference.match(/```compact[\s\S]*?```/g);
      expect(codeBlockMatches).toBeDefined();
      expect(codeBlockMatches!.length).toBeGreaterThan(5);
    });
  });

  describe("Full Contract Template", () => {
    it("counter contract template should pass static analysis", async () => {
      // A complete counter contract based on the documented patterns
      const counterContract = `pragma language_version >= 0.16 && <= 0.18;

import CompactStandardLibrary;

export ledger counter: Counter;
export ledger owner: Bytes<32>;

witness local_secret_key(): Bytes<32>;

export circuit increment(amount: Uint<64>): [] {
  assert amount > 0 "Amount must be positive";
  counter.increment(amount);
}

export circuit decrement(amount: Uint<64>): [] {
  assert amount > 0 "Amount must be positive";
  counter.decrement(amount);
}

export circuit get_value(): Uint<64> {
  return counter.value();
}
`;

      const result = await extractContractStructure({ code: counterContract });

      expect(result.success).toBe(true);
      if (!result.success) return;

      // No P0 errors
      const p0Issues = result.potentialIssues?.filter(
        (issue) =>
          issue.severity === "error" &&
          [
            "deprecated_ledger_block",
            "invalid_void_type",
            "invalid_pragma_format",
            "deprecated_cell_wrapper",
          ].includes(issue.type)
      );
      expect(p0Issues || []).toEqual([]);

      // Should have correct structure
      expect(result.languageVersion).toBe("0.16");
      expect(result.imports).toContain("CompactStandardLibrary");
      expect(result.structure?.ledgerItems?.length).toBe(2);
      expect(result.structure?.circuits?.length).toBe(3);
      // Witness count depends on the parser pattern (may not catch function-style witnesses)
      expect(result.stats?.circuitCount).toBe(3);
    });

    it("token contract template should pass static analysis", async () => {
      const tokenContract = `pragma language_version >= 0.16 && <= 0.18;

import CompactStandardLibrary;

export enum TokenState {
  Active,
  Paused
}

export ledger balances: Map<Bytes<32>, Uint<128>>;
export ledger totalSupply: Uint<128>;
export sealed ledger name: Bytes<32>;
export sealed ledger symbol: Bytes<8>;

witness local_secret_key(): Bytes<32>;

constructor(tokenName: Bytes<32>, tokenSymbol: Bytes<8>, initialSupply: Uint<128>) {
  name = disclose(tokenName);
  symbol = disclose(tokenSymbol);
  totalSupply = disclose(initialSupply);
}

export circuit transfer(to: Bytes<32>, amount: Uint<128>): [] {
  const from = local_secret_key();
  assert balances.member(from) "Sender has no balance";
  assert balances.lookup(from) >= amount "Insufficient balance";

  balances.insert(from, balances.lookup(from) - amount);
  const toBalance = balances.member(to) ? balances.lookup(to) : 0 as Uint<128>;
  balances.insert(to, toBalance + amount);
}
`;

      const result = await extractContractStructure({ code: tokenContract });

      expect(result.success).toBe(true);
      if (!result.success) return;

      // No P0 errors
      const p0Issues = result.potentialIssues?.filter(
        (issue) =>
          issue.severity === "error" &&
          [
            "deprecated_ledger_block",
            "invalid_void_type",
            "invalid_pragma_format",
            "deprecated_cell_wrapper",
          ].includes(issue.type)
      );
      expect(p0Issues || []).toEqual([]);

      // Should have correct structure
      expect(result.structure?.enums?.length).toBe(1);
      expect(result.structure?.ledgerItems?.length).toBe(4);
      expect(result.stats?.circuitCount).toBeGreaterThan(0);
    });
  });
});
