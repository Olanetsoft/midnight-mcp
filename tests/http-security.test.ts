import { describe, it, expect } from "vitest";
import { buildAllowlist, isRebindingBlocked } from "../src/server.js";

describe("DNS-rebinding allowlist", () => {
  it("derives a loopback allowlist from the given port", () => {
    const { allowedHosts, allowedOrigins } = buildAllowlist(3000);
    expect(allowedHosts).toEqual(["127.0.0.1:3000", "localhost:3000"]);
    expect(allowedOrigins).toEqual([
      "http://127.0.0.1:3000",
      "https://127.0.0.1:3000",
      "http://localhost:3000",
      "https://localhost:3000",
    ]);
  });

  it("is port-aware (does not hardcode 3000)", () => {
    const { allowedHosts } = buildAllowlist(8080);
    expect(allowedHosts).toContain("localhost:8080");
    expect(allowedHosts).not.toContain("localhost:3000");
  });
});

describe("isRebindingBlocked", () => {
  const { allowedHosts, allowedOrigins } = buildAllowlist(3000);

  it("blocks a foreign Origin (the DNS-rebinding attack)", () => {
    expect(
      isRebindingBlocked(
        "localhost:3000",
        "https://evil.example",
        allowedHosts,
        allowedOrigins
      )
    ).toBe(true);
  });

  it("blocks a foreign Host (rebound hostname)", () => {
    expect(
      isRebindingBlocked("evil.example", undefined, allowedHosts, allowedOrigins)
    ).toBe(true);
  });

  it("allows a legitimate localhost browser request", () => {
    expect(
      isRebindingBlocked(
        "localhost:3000",
        "http://localhost:3000",
        allowedHosts,
        allowedOrigins
      )
    ).toBe(false);
  });

  it("allows a non-browser CLI client (no Origin header)", () => {
    expect(
      isRebindingBlocked(
        "127.0.0.1:3000",
        undefined,
        allowedHosts,
        allowedOrigins
      )
    ).toBe(false);
  });

  it("blocks a stale port even on loopback", () => {
    expect(
      isRebindingBlocked("localhost:9999", undefined, allowedHosts, allowedOrigins)
    ).toBe(true);
  });
});
