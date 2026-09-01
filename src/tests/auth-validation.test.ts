import { describe, expect, it } from "vitest";
import { hashSessionToken } from "@/lib/auth/token";
import { loginSchema, registerSchema } from "@/lib/auth/validation";

describe("auth validation", () => {
  it("normalizes registration email", () => {
    const result = registerSchema.parse({
      email: " Trader@Example.COM ",
      password: "password123",
      displayName: "Trader",
    });

    expect(result.email).toBe("trader@example.com");
  });

  it("rejects short passwords", () => {
    expect(() =>
      registerSchema.parse({
        email: "trader@example.com",
        password: "123",
      }),
    ).toThrow();
  });

  it("validates login credentials", () => {
    const result = loginSchema.parse({
      email: "USER@EXAMPLE.COM",
      password: "password123",
    });

    expect(result.email).toBe("user@example.com");
  });

  it("hashes session tokens deterministically without storing raw token", () => {
    const token = "temporary-test-token";
    const hash = hashSessionToken(token);

    expect(hash).toHaveLength(64);
    expect(hash).not.toBe(token);
    expect(hashSessionToken(token)).toBe(hash);
  });
});
