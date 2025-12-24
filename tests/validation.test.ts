import { describe, it, expect } from "vitest";
import { extractContractStructure } from "../src/tools/repository/validation.js";

// Note: validateContract requires actual compiler installation, so we focus on
// extractContractStructure which can be fully tested without external dependencies

describe("Contract Structure Extraction", () => {
  describe("extractContractStructure", () => {
    it("should extract pragma version with >= operator", async () => {
      const code = `pragma language_version >= 0.16;

import CompactStandardLibrary;

export ledger counter: Counter;
`;
      const result = await extractContractStructure({ code });

      expect(result.success).toBe(true);
      expect(result.languageVersion).toBe("0.16");
    });

    it("should extract pragma version with > operator", async () => {
      const code = `pragma language_version > 0.15;

export ledger counter: Counter;
`;
      const result = await extractContractStructure({ code });

      expect(result.success).toBe(true);
      expect(result.languageVersion).toBe("0.15");
    });

    it("should extract pragma version with == operator", async () => {
      const code = `pragma language_version == 0.16;

export ledger counter: Counter;
`;
      const result = await extractContractStructure({ code });

      expect(result.success).toBe(true);
      expect(result.languageVersion).toBe("0.16");
    });

    it("should extract pragma version with ~ operator", async () => {
      const code = `pragma language_version ~ 0.16;

export ledger counter: Counter;
`;
      const result = await extractContractStructure({ code });

      expect(result.success).toBe(true);
      expect(result.languageVersion).toBe("0.16");
    });

    it("should extract pragma version with < operator", async () => {
      const code = `pragma language_version < 0.17;

export ledger counter: Counter;
`;
      const result = await extractContractStructure({ code });

      expect(result.success).toBe(true);
      expect(result.languageVersion).toBe("0.17");
    });

    it("should extract pragma version with <= operator", async () => {
      const code = `pragma language_version <= 0.16;

export ledger counter: Counter;
`;
      const result = await extractContractStructure({ code });

      expect(result.success).toBe(true);
      expect(result.languageVersion).toBe("0.16");
    });

    it("should extract imports", async () => {
      const code = `pragma language_version >= 0.16;

import CompactStandardLibrary;
include "utils.compact";
`;
      const result = await extractContractStructure({ code });

      expect(result.success).toBe(true);
      expect(result.imports).toContain("CompactStandardLibrary");
      expect(result.imports).toContain("utils.compact");
    });

    it("should extract circuit definitions", async () => {
      const code = `pragma language_version >= 0.16;

export circuit increment(amount: Field): [] {
  counter.increment(amount);
}

circuit helper(): Field {
  return 42;
}
`;
      const result = await extractContractStructure({ code });

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.structure!.circuits).toHaveLength(2);

      const exportedCircuit = result.structure!.circuits.find(
        (c) => c.name === "increment"
      );
      expect(exportedCircuit).toBeDefined();
      expect(exportedCircuit?.isExport).toBe(true);
      expect(exportedCircuit?.params).toContain("amount: Field");

      const helperCircuit = result.structure!.circuits.find(
        (c) => c.name === "helper"
      );
      expect(helperCircuit).toBeDefined();
      expect(helperCircuit?.isExport).toBe(false);
    });

    it("should handle complex parameter types with nested generics", async () => {
      const code = `pragma language_version >= 0.16;

export circuit transfer(from: Opaque<"address">, to: Opaque<"address">, amounts: Map<Field, Uint<64>>): [Boolean, Field] {
  // implementation
}
`;
      const result = await extractContractStructure({ code });

      expect(result.success).toBe(true);
      if (!result.success) return;
      const circuit = result.structure!.circuits.find(
        (c) => c.name === "transfer"
      );
      expect(circuit).toBeDefined();
      // With the improved splitParams, nested generics should be preserved
      expect(circuit?.params).toHaveLength(3);
      expect(circuit?.params[0]).toContain("Opaque");
      expect(circuit?.params[2]).toContain("Map<Field, Uint<64>>");
    });

    it("should handle function types in parameters", async () => {
      const code = `pragma language_version >= 0.16;

export circuit withCallback(fn: (a: Field, b: Field) => Boolean, data: Field): [] {
  // implementation
}
`;
      const result = await extractContractStructure({ code });

      expect(result.success).toBe(true);
      if (!result.success) return;
      const circuit = result.structure!.circuits.find(
        (c) => c.name === "withCallback"
      );
      expect(circuit).toBeDefined();
      // With parentheses depth tracking, function types should not be split
      expect(circuit?.params).toHaveLength(2);
      expect(circuit?.params[0]).toContain("(a: Field, b: Field) => Boolean");
      expect(circuit?.params[1]).toBe("data: Field");
    });

    it("should handle string literals with commas in parameters", async () => {
      const code = `pragma language_version >= 0.16;

export circuit withStringType(addr: Opaque<"a, b">, data: Field): [] {
  // implementation
}
`;
      const result = await extractContractStructure({ code });

      expect(result.success).toBe(true);
      if (!result.success) return;
      const circuit = result.structure!.circuits.find(
        (c) => c.name === "withStringType"
      );
      expect(circuit).toBeDefined();
      // With string literal tracking, commas inside strings should not split params
      expect(circuit?.params).toHaveLength(2);
      expect(circuit?.params[0]).toContain('Opaque<"a, b">');
      expect(circuit?.params[1]).toBe("data: Field");
    });

    it("should extract witness definitions", async () => {
      const code = `pragma language_version >= 0.16;

export witness getSecret: () => Field;
witness privateHelper: (x: Field) => Boolean;
`;
      const result = await extractContractStructure({ code });

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.structure!.witnesses).toHaveLength(2);

      const exportedWitness = result.structure!.witnesses.find(
        (w) => w.name === "getSecret"
      );
      expect(exportedWitness).toBeDefined();
      expect(exportedWitness?.isExport).toBe(true);
    });

    it("should extract ledger items", async () => {
      const code = `pragma language_version >= 0.16;

export ledger counter: Counter;
export ledger balances: Map<Bytes<32>, Uint<64>>;
ledger privateData: Field;
`;
      const result = await extractContractStructure({ code });

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.structure!.ledgerItems).toHaveLength(3);
      expect(result.exports!.ledger).toContain("counter");
      expect(result.exports!.ledger).toContain("balances");
      expect(result.exports!.ledger).not.toContain("privateData");
    });

    it("should extract type definitions", async () => {
      const code = `pragma language_version >= 0.16;

type Address = Bytes<32>;
type Balance = Uint<64>;
`;
      const result = await extractContractStructure({ code });

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.structure!.types).toHaveLength(2);
      expect(result.structure!.types[0].name).toBe("Address");
      expect(result.structure!.types[0].definition).toBe("Bytes<32>");
    });

    it("should extract struct definitions", async () => {
      const code = `pragma language_version >= 0.16;

struct User {
  id: Field,
  balance: Uint<64>,
  active: Boolean
}
`;
      const result = await extractContractStructure({ code });

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.structure!.structs).toHaveLength(1);
      expect(result.structure!.structs[0].name).toBe("User");
      expect(result.structure!.structs[0].fields).toHaveLength(3);
    });

    it("should extract enum definitions", async () => {
      const code = `pragma language_version >= 0.16;

enum Status {
  Pending,
  Active,
  Completed
}
`;
      const result = await extractContractStructure({ code });

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.structure!.enums).toHaveLength(1);
      expect(result.structure!.enums[0].name).toBe("Status");
      expect(result.structure!.enums[0].variants).toContain("Pending");
      expect(result.structure!.enums[0].variants).toContain("Active");
      expect(result.structure!.enums[0].variants).toContain("Completed");
    });

    it("should generate accurate statistics", async () => {
      const code = `pragma language_version >= 0.16;

import CompactStandardLibrary;

export ledger counter: Counter;
export ledger data: Map<Field, Field>;

export circuit increment(): [] {
  counter.increment(1);
}

export circuit getData(key: Field): Field {
  return data.get(key);
}

witness getPrivateKey: () => Field;

type MyType = Field;
`;
      const result = await extractContractStructure({ code });

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.stats!.circuitCount).toBe(2);
      expect(result.stats!.ledgerCount).toBe(2);
      expect(result.stats!.witnessCount).toBe(1);
      expect(result.stats!.typeCount).toBe(1);
      expect(result.stats!.exportedCircuits).toBe(2);
      expect(result.stats!.exportedLedger).toBe(2);
    });

    it("should handle empty contract", async () => {
      const code = `pragma language_version >= 0.16;
`;
      const result = await extractContractStructure({ code });

      expect(result.success).toBe(true);
      expect(result.summary).toBe("Empty contract");
    });

    it("should handle empty code gracefully", async () => {
      const result = await extractContractStructure({ code: "" });

      // Empty string is treated as no contract provided
      expect(result.success).toBe(false);
      expect(result.error).toBe("No contract provided");
    });

    it("should reject when neither code nor filePath provided", async () => {
      const result = await extractContractStructure({});

      expect(result.success).toBe(false);
      expect(result.error).toBe("No contract provided");
    });

    it("should reject binary content", async () => {
      const binaryContent =
        "pragma language_version >= 0.16;\x00\x00binary data";
      const result = await extractContractStructure({ code: binaryContent });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid code content");
    });

    it("should generate summary message", async () => {
      const code = `pragma language_version >= 0.16;

export ledger counter: Counter;
export circuit increment(): [] {}
`;
      const result = await extractContractStructure({ code });

      expect(result.success).toBe(true);
      expect(result.message).toContain("circuit");
      expect(result.message).toContain("ledger");
    });
  });
});

describe("Path Validation", () => {
  // These tests verify the security checks without actually accessing files

  it("should reject relative file paths", async () => {
    const result = await extractContractStructure({
      filePath: "relative/path/contract.compact",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("absolute");
  });

  it("should reject paths without .compact extension", async () => {
    const result = await extractContractStructure({
      filePath: "/Users/test/contract.txt",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain(".compact");
  });

  it("should reject system directory paths on Unix", async () => {
    // This test is platform-specific but validates the security logic
    if (process.platform !== "win32") {
      const result = await extractContractStructure({
        filePath: "/etc/passwd.compact",
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("system directories");
    }
  });
});

describe("Standard Library Detection", () => {
  // These tests verify the word boundary detection for stdlib types

  it("should detect Counter type usage", async () => {
    const code = `pragma language_version >= 0.16;
export ledger counter: Counter;
`;
    const result = await extractContractStructure({ code });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.structure!.ledgerItems[0].type).toBe("Counter");
  });

  it("should detect Map type usage", async () => {
    const code = `pragma language_version >= 0.16;
export ledger data: Map<Field, Field>;
`;
    const result = await extractContractStructure({ code });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.structure!.ledgerItems[0].type).toBe("Map<Field, Field>");
  });
});
