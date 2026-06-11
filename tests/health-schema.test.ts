import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Ajv from "ajv";
import { healthTools } from "../src/tools/health/index.js";
import { CURRENT_VERSION } from "../src/utils/version.js";

/**
 * Regression test for the "Failed to call tool" bug.
 *
 * MCP clients validate a tool's `structuredContent` against its declared
 * `outputSchema`. If a health tool returns a value whose shape doesn't match
 * its schema (e.g. a string where an object is declared, or `null` where an
 * object/array is declared), the client rejects the entire call. These tests
 * assert every health tool's runtime output conforms to its own outputSchema.
 */

const ajv = new Ajv({ allErrors: true, strict: false });

function validateAgainstSchema(schema: unknown, data: unknown) {
  const validate = ajv.compile(schema as Parameters<typeof ajv.compile>[0]);
  const ok = validate(data);
  return { ok, errors: validate.errors };
}

function getTool(name: string) {
  const tool = healthTools.find((t) => t.name === name);
  if (!tool) throw new Error(`tool not found: ${name}`);
  if (!tool.outputSchema) throw new Error(`tool ${name} has no outputSchema`);
  return { handler: tool.handler, outputSchema: tool.outputSchema };
}

describe("health tools conform to their declared outputSchema", () => {
  it("every health tool outputSchema is itself a valid JSON Schema", () => {
    for (const tool of healthTools) {
      if (!tool.outputSchema) continue;
      expect(() =>
        ajv.compile(tool.outputSchema as Parameters<typeof ajv.compile>[0])
      ).not.toThrow();
    }
  });

  it("midnight-health-check (quick) output conforms", async () => {
    const { handler, outputSchema } = getTool("midnight-health-check");
    const result = await handler({ detailed: false } as never);
    const { errors } = validateAgainstSchema(outputSchema, result);
    expect(errors).toBeNull();
  });

  it("midnight-get-status output conforms", async () => {
    const { handler, outputSchema } = getTool("midnight-get-status");
    const result = await handler({} as never);
    const { errors } = validateAgainstSchema(outputSchema, result);
    expect(errors).toBeNull();
  });

  describe("midnight-check-version", () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
      // default replaced per-test below
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it("omits update fields and conforms when up to date", async () => {
      globalThis.fetch = (async () => ({
        ok: true,
        json: async () => ({ version: CURRENT_VERSION }),
      })) as unknown as typeof fetch;

      const { handler, outputSchema } = getTool("midnight-check-version");
      const result = (await handler({} as never)) as Record<string, unknown>;

      expect(result.isUpToDate).toBe(true);
      // The bug: these used to be `null`, which violates the object/array schema.
      expect("updateInstructions" in result).toBe(false);
      expect("newFeatures" in result).toBe(false);

      const { errors } = validateAgainstSchema(outputSchema, result);
      expect(errors).toBeNull();
    });

    it("includes object/array update fields and conforms when outdated", async () => {
      globalThis.fetch = (async () => ({
        ok: true,
        json: async () => ({ version: "999.999.999" }),
      })) as unknown as typeof fetch;

      const { handler, outputSchema } = getTool("midnight-check-version");
      const result = (await handler({} as never)) as Record<string, unknown>;

      expect(result.isUpToDate).toBe(false);
      expect(typeof result.updateInstructions).toBe("object");
      expect(Array.isArray(result.newFeatures)).toBe(true);

      const { errors } = validateAgainstSchema(outputSchema, result);
      expect(errors).toBeNull();
    });
  });
});
