import { describe, expect, it } from "vitest";
import {
  canCreateActiveChallenge,
  entitlementsForPlan,
  hasEntitlement,
  planLimits,
} from "@/lib/monetization/entitlements";

describe("FFZ monetization entitlements", () => {
  it("keeps the core workflow available on FREE", () => {
    expect(hasEntitlement("FREE", "RISK_CALCULATOR")).toBe(true);
    expect(hasEntitlement("FREE", "ECONOMIC_CALENDAR")).toBe(true);
    expect(hasEntitlement("FREE", "BASIC_JOURNAL")).toBe(true);
    expect(hasEntitlement("FREE", "BASIC_ANALYTICS")).toBe(true);
    expect(hasEntitlement("FREE", "BUILT_IN_PROP_RULES")).toBe(true);
    expect(hasEntitlement("FREE", "ONE_ACTIVE_CHALLENGE")).toBe(true);
  });

  it("keeps automation and edge tools on PRO", () => {
    for (const entitlement of [
      "MULTIPLE_ACTIVE_CHALLENGES",
      "CSV_IMPORT",
      "AUTO_CHALLENGE_SYNC",
      "SETUP_ANALYTICS",
      "TIME_OF_DAY_ANALYTICS",
      "TRADING_GUARDRAILS",
      "NEWS_LOCKOUT",
      "CUSTOM_PROP_RULES",
      "PROP_JOURNEY_ANALYTICS",
    ] as const) {
      expect(hasEntitlement("FREE", entitlement)).toBe(false);
      expect(hasEntitlement("PRO", entitlement)).toBe(true);
    }
  });

  it("limits FREE to one active challenge and leaves PRO unlimited", () => {
    expect(planLimits("FREE").activeChallenges).toBe(1);
    expect(canCreateActiveChallenge("FREE", 0)).toBe(true);
    expect(canCreateActiveChallenge("FREE", 1)).toBe(false);

    expect(planLimits("PRO").activeChallenges).toBeNull();
    expect(canCreateActiveChallenge("PRO", 50)).toBe(true);
  });

  it("makes PRO a superset of FREE", () => {
    const pro = new Set(entitlementsForPlan("PRO"));
    for (const entitlement of entitlementsForPlan("FREE")) {
      expect(pro.has(entitlement)).toBe(true);
    }
  });
});
