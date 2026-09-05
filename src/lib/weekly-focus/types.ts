export const WEEKLY_FOCUS_STATUSES = [
  "ACTIVE",
  "ACHIEVED",
  "PARTIAL",
  "MISSED",
] as const;

export type WeeklyFocusStatus = (typeof WEEKLY_FOCUS_STATUSES)[number];

export const WEEKLY_FOCUS_SIGNAL_KEYS = [
  "RAPID_REENTRY",
  "POST_LOSS_ACTIVITY",
  "LOSS_STREAK",
  "OVERTRADING",
  "DAILY_LOSS_COUNT",
  "PLAN_BREAKDOWN",
  "MINDSET_SHIFT",
  "RISK_ESCALATION",
] as const;

export type WeeklyFocusSignalKey = (typeof WEEKLY_FOCUS_SIGNAL_KEYS)[number];

export type WeeklyFocusApiModel = {
  id: string;
  weekStart: string;
  primaryFocus: string;
  rule: string;
  whyItMatters: string | null;
  sourceSignalKey: WeeklyFocusSignalKey | null;
  status: WeeklyFocusStatus;
  createdAt: string;
  updatedAt: string;
};

export type SaveWeeklyFocusInput = {
  weekStart: string;
  primaryFocus: string;
  rule: string;
  whyItMatters?: string | null;
  sourceSignalKey?: WeeklyFocusSignalKey | null;
  status?: WeeklyFocusStatus;
};
