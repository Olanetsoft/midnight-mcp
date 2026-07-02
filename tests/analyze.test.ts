import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import {
  analyzeContract,
  explainCircuit,
  compileContract,
  getCompilerStatus,
} from "../src/tools/analyze/index.js";

describe("Contract Analyzer", () => {
  it("should analyze a simple counter contract", async () => {
    const code = `
pragma language_version >= 0.16 && <= 0.21;

import CompactStandardLibrary;

ledger {
  counter: Counter;
}

export circuit increment(amount: Field): Field {
  assert(amount > 0);
  ledger.counter.increment(amount);
  return ledger.counter.read();
}
    `;

    const result = await analyzeContract({ code, checkSecurity: true });

    expect(result.summary.hasLedger).toBe(true);
    expect(result.summary.hasCircuits).toBe(true);
    expect(result.summary.publicCircuits).toBe(1);
    expect(result.structure.circuits.length).toBe(1);
    expect(result.structure.circuits[0].name).toBe("increment");
  });

  it("should detect security issues", async () => {
    const code = `
ledger {
  @private
  secretBalance: Field;
}

export circuit revealSecret(): Field {
  return ledger.secretBalance;
}
    `;

    const result = await analyzeContract({ code, checkSecurity: true });

    // Should warn about private data usage without protection
    expect(result.securityFindings.length).toBeGreaterThan(0);
  });

  it("should identify unused witnesses", async () => {
    const code = `
ledger {
  counter: Counter;
}

witness unusedWitness(): Field {
  return 42;
}

export circuit increment(amount: Field): Void {
  ledger.counter.increment(amount);
}
    `;

    const result = await analyzeContract({ code, checkSecurity: true });

    const unusedWitnessFindings = result.securityFindings.filter((f) =>
      f.message.includes("not used"),
    );
    expect(unusedWitnessFindings.length).toBeGreaterThan(0);
  });
});

describe("Circuit Explainer", () => {
  it("should explain a circuit with disclose", async () => {
    const code = `
export circuit revealData(data: Field): Field {
  return disclose(data);
}
    `;

    const result = await explainCircuit({ circuitCode: code });

    expect(result.circuitName).toBe("revealData");
    expect(result.isPublic).toBe(true);
    expect(result.operations).toContain(
      "Reveals private data selectively (disclose)",
    );
    expect(result.zkImplications.length).toBeGreaterThan(0);
  });

  it("should explain a circuit with assertions", async () => {
    const code = `
export circuit validateAmount(amount: Field): Boolean {
  assert(amount > 0);
  assert(amount < 1000);
  return true;
}
    `;

    const result = await explainCircuit({ circuitCode: code });

    expect(result.circuitName).toBe("validateAmount");
    expect(result.operations).toContain("Validates constraints (assert)");
  });

  it("should identify state modifications", async () => {
    const code = `
export circuit deposit(amount: Field): Void {
  ledger.balance.increment(amount);
  ledger.transactions.insert(nextId(), amount);
}
    `;

    const result = await explainCircuit({ circuitCode: code });

    expect(result.operations).toContain("Increments a counter value");
    expect(result.operations).toContain("Inserts data into ledger storage");
  });
});

describe("Compile Contract", () => {
  // Mock fetch for compiler tests
  const mockFetch = vi.fn();
  const originalFetch = globalThis.fetch;

  const prevCompilerUrl = process.env.COMPACT_COMPILER_URL;

  beforeAll(() => {
    globalThis.fetch = mockFetch;
    // Compiler is opt-in; configure an endpoint so the service path is tested.
    process.env.COMPACT_COMPILER_URL = "https://compiler.test.local";
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
    if (prevCompilerUrl === undefined) {
      delete process.env.COMPACT_COMPILER_URL;
    } else {
      process.env.COMPACT_COMPILER_URL = prevCompilerUrl;
    }
  });

  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("should return success for valid contract", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        output: "Compilation successful",
        compilerVersion: "0.29.0",
        compiledAt: "2026-01-19T19:17:56.064Z",
        executionTime: 2841,
      }),
    });

    const result = (await compileContract({
      code: `
pragma language_version >= 0.16 && <= 0.21;

ledger {
  counter: Counter;
}

export circuit increment(): Void {
  ledger.counter.increment(1);
}
      `,
    })) as Record<string, unknown>;

    expect(result.success).toBe(true);
    expect(result.message).toContain("Compilation successful");
    expect(result.compilerVersion).toBe("0.29.0");
  });

  it("should return error details for invalid contract", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: false,
        errors: [
          {
            file: "contract.compact",
            line: 3,
            column: 26,
            severity: "error",
            message: "unbound identifier Void",
          },
        ],
        output: "Compilation failed with 1 error(s)",
      }),
    });

    const result = (await compileContract({
      code: `invalid code`,
    })) as Record<string, unknown>;

    expect(result.success).toBe(false);
    expect(result.message).toContain("Line 3:26");
    expect(result.message).toContain("unbound identifier Void");
    expect(result.location).toEqual({
      line: 3,
      column: 26,
      errorType: "error",
    });
  });

  it("should return validationType compiler on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        output: "Compilation successful",
        compilerVersion: "0.29.0",
        compiledAt: "2026-01-19T19:17:56.064Z",
        executionTime: 2841,
      }),
    });

    const result = (await compileContract({
      code: `
pragma language_version >= 0.16 && <= 0.21;

ledger {
  counter: Counter;
}

export circuit increment(): Void {
  ledger.counter.increment(1);
}
      `,
    })) as Record<string, unknown>;

    expect(result.success).toBe(true);
    expect(result.validationType).toBe("compiler");
    expect(result.message).toContain("Compilation successful");
    expect(result.compilerVersion).toBe("0.29.0");
  });

  it("should fall back to static analysis on network failures", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const validCode = `
pragma language_version >= 0.16 && <= 0.21;

ledger {
  counter: Counter;
}

export circuit increment(): Void {
  ledger.counter.increment(1);
}
    `;

    const result = (await compileContract({
      code: validCode,
    })) as Record<string, unknown>;

    // Should succeed with fallback, not fail
    expect(result.success).toBe(true);
    expect(result.validationType).toBe("static-analysis-fallback");
    expect(result.serviceAvailable).toBe(false);
    expect(result.message).toContain("Static analysis completed");
    expect(result.staticAnalysis).toBeDefined();
  });

  it("should fall back to static analysis on API 500 errors", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    });

    const validCode = `
ledger {
  value: Field;
}

export circuit getValue(): Field {
  return ledger.value;
}
    `;

    const result = (await compileContract({
      code: validCode,
    })) as Record<string, unknown>;

    // Should succeed with fallback
    expect(result.success).toBe(true);
    expect(result.validationType).toBe("static-analysis-fallback");
    expect(result.serviceAvailable).toBe(false);
    expect(result.staticAnalysis).toBeDefined();
  });

  it("should validate input - reject empty code", async () => {
    const result = (await compileContract({
      code: "",
    })) as Record<string, unknown>;

    expect(result.success).toBe(false);
    expect(result.error).toBe("INVALID_INPUT");
  });

  it("does not send source off-box when no compiler is configured", async () => {
    const saved = process.env.COMPACT_COMPILER_URL;
    delete process.env.COMPACT_COMPILER_URL;
    mockFetch.mockClear();

    try {
      const result = (await compileContract({
        code: `
ledger {
  counter: Counter;
}

export circuit increment(): Void {
  ledger.counter.increment(1);
}
        `,
      })) as Record<string, unknown>;

      // No network call is made, so contract source never leaves the machine.
      expect(mockFetch).not.toHaveBeenCalled();
      // Falls back to local static analysis instead of erroring.
      expect(result.success).toBe(true);
      expect(result.validationType).toBe("static-analysis-fallback");
      expect(result.serviceAvailable).toBe(false);
    } finally {
      process.env.COMPACT_COMPILER_URL = saved;
    }
  });

  it("should validate input - reject oversized code", async () => {
    const result = (await compileContract({
      code: "x".repeat(200 * 1024), // 200KB
    })) as Record<string, unknown>;

    expect(result.success).toBe(false);
    expect(result.error).toBe("CODE_TOO_LARGE");
  });
});

describe("Compiler Status", () => {
  const mockFetch = vi.fn();
  const originalFetch = globalThis.fetch;

  const prevCompilerUrl = process.env.COMPACT_COMPILER_URL;

  beforeAll(() => {
    globalThis.fetch = mockFetch;
    // Compiler is opt-in; configure an endpoint so the service path is tested.
    process.env.COMPACT_COMPILER_URL = "https://compiler.test.local";
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
    if (prevCompilerUrl === undefined) {
      delete process.env.COMPACT_COMPILER_URL;
    } else {
      process.env.COMPACT_COMPILER_URL = prevCompilerUrl;
    }
  });

  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("should report healthy service", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "ok",
        compilerVersion: "0.29.0",
      }),
    });

    const result = (await getCompilerStatus()) as Record<string, unknown>;

    expect(result.available).toBe(true);
    expect(result.compilerVersion).toBe("0.29.0");
    expect(result.message).toContain("✅");
  });

  it("should report unavailable service", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

    const result = (await getCompilerStatus()) as Record<string, unknown>;

    expect(result.available).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.message).toContain("❌");
  });
});
