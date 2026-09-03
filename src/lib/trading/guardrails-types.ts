import type { TradeApiModel } from "@/lib/journal/types";
import type { EconomicCalendarEvent } from "@/lib/economic-calendar/types";
import type { InstrumentCode, PositionSizeResult } from "./types";

export type GuardrailSeverity = "INFO" | "CAUTION" | "BLOCKED";

export type NumericGuardrailRule = {
  enabled: boolean;
  value: number;
  severity: GuardrailSeverity;
};

export type ContractCapRule = {
  enabled: boolean;
  value: number;
};

export type TimeGuardrailRule = {
  enabled: boolean;
  timeEt: string;
  severity: GuardrailSeverity;
};

export type NewsGuardrailRule = {
  enabled: boolean;
  beforeMinutes: number;
  afterMinutes: number;
  severity: GuardrailSeverity;
};

export type MajorNewsGuardrailRule = NewsGuardrailRule & {
  keywords: string[];
};

export type TradingGuardrailSettings = {
  maxRiskPerTrade: NumericGuardrailRule;
  maxDailyLosses: NumericGuardrailRule;
  maxTradesPerDay: NumericGuardrailRule;
  maxContracts: ContractCapRule;
  minRewardRisk: NumericGuardrailRule;
  noNewTradesAfter: TimeGuardrailRule;
  highImpactNews: NewsGuardrailRule;
  mediumImpactNews: NewsGuardrailRule;
  majorNewsOverride: MajorNewsGuardrailRule;
};

export type TradingGuardrailSettingsApiModel = TradingGuardrailSettings & {
  id: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type GuardrailSource = "PERSONAL" | "NEWS";

export type TradeGuardrailCheck = {
  code: string;
  source: GuardrailSource;
  severity: GuardrailSeverity;
  reason: string;
};

export type DailyTradingStats = {
  trades: number;
  losses: number;
};

export type EvaluatePersonalGuardrailsInput = {
  result: PositionSizeResult;
  settings: TradingGuardrailSettings;
  dailyStats: DailyTradingStats;
  now?: Date;
  uncappedMaxContracts?: number | null;
};

export type EvaluateNewsGuardrailsInput = {
  instrument: InstrumentCode;
  events: EconomicCalendarEvent[];
  settings: TradingGuardrailSettings;
  now?: Date;
  calendarAvailable?: boolean;
  calendarStale?: boolean;
};

export type DailyStatsInput = {
  trades: TradeApiModel[];
  now?: Date;
};
