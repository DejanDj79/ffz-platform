import { describe, expect, it } from "vitest";
import { safeFeatureName, safeInternalReturnPath } from "./safe-return";

describe("safeInternalReturnPath", () => {
  it("keeps internal paths with query and hash", () => {
    expect(safeInternalReturnPath("/journal/import?source=gate#top"))
      .toBe("/journal/import?source=gate#top");
  });

  it("rejects external and protocol-relative redirects", () => {
    expect(safeInternalReturnPath("https://example.com/steal")).toBeNull();
    expect(safeInternalReturnPath("//example.com/steal")).toBeNull();
    expect(safeInternalReturnPath("/journal\\evil")).toBeNull();
  });
});

describe("safeFeatureName", () => {
  it("cleans control characters and caps display length", () => {
    expect(safeFeatureName("  CSV\nTrade Import  ")).toBe("CSV Trade Import");
    expect(safeFeatureName("x".repeat(100))).toHaveLength(80);
  });
});
