export type UserPlan = "FREE" | "PRO";

export type Entitlement =
  | "RISK_CALCULATOR"
  | "ECONOMIC_CALENDAR"
  | "BASIC_JOURNAL"
  | "BASIC_ANALYTICS"
  | "BUILT_IN_PROP_RULES"
  | "ONE_ACTIVE_CHALLENGE"
  | "MULTIPLE_ACTIVE_CHALLENGES"
  | "CSV_IMPORT"
  | "AUTO_CHALLENGE_SYNC"
  | "SETUP_ANALYTICS"
  | "TIME_OF_DAY_ANALYTICS"
  | "TRADING_GUARDRAILS"
  | "NEWS_LOCKOUT"
  | "CUSTOM_PROP_RULES"
  | "PROP_JOURNEY_ANALYTICS";

export type PlanLimits = {
  activeChallenges: number | null;
};
