import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import {
  clearAllRateLimitsForTests,
  clearRateLimit,
  consumeRateLimit,
} from "@/lib/security/rate-limit";

describe("rate limit", () => {
  beforeEach(() => {
    clearAllRateLimitsForTests();
  });

  it("allows requests up to the configured limit", () => {
    const first =
      consumeRateLimit(
        "login:test",
        {
          limit: 2,
          windowMs: 60_000,
        },
        1_000,
      );

    const second =
      consumeRateLimit(
        "login:test",
        {
          limit: 2,
          windowMs: 60_000,
        },
        2_000,
      );

    const third =
      consumeRateLimit(
        "login:test",
        {
          limit: 2,
          windowMs: 60_000,
        },
        3_000,
      );

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSeconds).toBe(
      58,
    );
  });

  it("resets after the fixed window", () => {
    consumeRateLimit(
      "register:test",
      {
        limit: 1,
        windowMs: 10_000,
      },
      1_000,
    );

    expect(
      consumeRateLimit(
        "register:test",
        {
          limit: 1,
          windowMs: 10_000,
        },
        12_000,
      ).allowed,
    ).toBe(true);
  });

  it("can clear a successful account-login bucket", () => {
    consumeRateLimit(
      "account:test",
      {
        limit: 1,
        windowMs: 10_000,
      },
      1_000,
    );

    clearRateLimit("account:test");

    expect(
      consumeRateLimit(
        "account:test",
        {
          limit: 1,
          windowMs: 10_000,
        },
        2_000,
      ).allowed,
    ).toBe(true);
  });
});
