import type { Entitlement, PlanLimits, UserPlan } from "./types";

const FREE_ENTITLEMENTS = new Set<Entitlement>([
  "RISK_CALCULATOR",
  "ECONOMIC_CALENDAR",
  "BASIC_JOURNAL",
  "BASIC_ANALYTICS",
  "BUILT_IN_PROP_RULES",
  "ONE_ACTIVE_CHALLENGE",
]);

const PRO_ENTITLEMENTS = new Set<Entitlement>([
  ...FREE_ENTITLEMENTS,
  "MULTIPLE_ACTIVE_CHALLENGES",
  "CSV_IMPORT",
  "AUTO_CHALLENGE_SYNC",
  "SETUP_ANALYTICS",
  "TIME_OF_DAY_ANALYTICS",
  "TRADING_GUARDRAILS",
  "NEWS_LOCKOUT",
  "CUSTOM_PROP_RULES",
  "PROP_JOURNEY_ANALYTICS",
]);

const ENTITLEMENTS_BY_PLAN: Record<UserPlan, ReadonlySet<Entitlement>> = {
  FREE: FREE_ENTITLEMENTS,
  PRO: PRO_ENTITLEMENTS,
};

const LIMITS_BY_PLAN: Record<UserPlan, PlanLimits> = {
  FREE: { activeChallenges: 1 },
  PRO: { activeChallenges: null },
};

export function hasEntitlement(plan: UserPlan, entitlement: Entitlement) {
  return ENTITLEMENTS_BY_PLAN[plan].has(entitlement);
}

export function entitlementsForPlan(plan: UserPlan): Entitlement[] {
  return Array.from(ENTITLEMENTS_BY_PLAN[plan]);
}

export function planLimits(plan: UserPlan): PlanLimits {
  return LIMITS_BY_PLAN[plan];
}

export function canCreateActiveChallenge(plan: UserPlan, activeChallengeCount: number) {
  const limit = planLimits(plan).activeChallenges;
  return limit == null || activeChallengeCount < limit;
}
