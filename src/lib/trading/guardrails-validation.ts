import { z } from "zod";

const severity = z.enum(["INFO", "CAUTION", "BLOCKED"]);

const numericRule = z.object({
  enabled: z.boolean(),
  value: z.number().finite().nonnegative(),
  severity,
});

const positiveIntegerRule = numericRule.extend({
  value: z.number().int().min(1).max(1000),
});

const contractCapRule = z.object({
  enabled: z.boolean(),
  value: z.number().int().min(1).max(1000),
});

const timeRule = z.object({
  enabled: z.boolean(),
  timeEt: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  severity,
});

const newsRule = z.object({
  enabled: z.boolean(),
  beforeMinutes: z.number().int().min(0).max(240),
  afterMinutes: z.number().int().min(0).max(240),
  severity,
});

export const tradingGuardrailSettingsSchema = z.object({
  maxRiskPerTrade: numericRule.extend({
    value: z.number().finite().positive().max(1_000_000),
  }),
  maxDailyLosses: positiveIntegerRule,
  maxTradesPerDay: positiveIntegerRule,
  maxContracts: contractCapRule,
  minRewardRisk: numericRule.extend({
    value: z.number().finite().positive().max(100),
  }),
  noNewTradesAfter: timeRule,
  highImpactNews: newsRule,
  mediumImpactNews: newsRule,
  majorNewsOverride: newsRule.extend({
    keywords: z.array(z.string().trim().min(1).max(80)).max(50),
  }),
});

export type TradingGuardrailSettingsInput = z.infer<
  typeof tradingGuardrailSettingsSchema
>;
