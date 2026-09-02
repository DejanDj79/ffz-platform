import { describe, expect, it } from "vitest";
import { canAccessCreatorTools } from "@/lib/auth/roles";

describe("creator role access", () => {
  it("allows CREATOR", () => {
    expect(canAccessCreatorTools({ role: "CREATOR" })).toBe(true);
  });

  it("rejects USER", () => {
    expect(canAccessCreatorTools({ role: "USER" })).toBe(false);
  });

  it("rejects missing user", () => {
    expect(canAccessCreatorTools(null)).toBe(false);
  });
});
