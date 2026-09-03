import { z } from "zod";

const money = z.number().finite().nonnegative();
const nullableMoney = money.nullable();
const positiveNullableInt = z.number().int().positive().nullable();

export const customRuleVariantSchema = z.object({
  id: z.string().uuid(),
  label: z.string().trim().min(1).max(80),
  accountSize: money,
  startingBalance: money,
  profitTarget: money,
  maxDrawdown: money,
  drawdownMode: z.enum(["STATIC", "EOD_TRAILING", "INTRADAY_TRAILING"]),
  drawdownLockFloorOffset: z.number().finite(),
  dailyLossLimit: nullableMoney,
  dailyLossBreachType: z.enum(["NONE", "SOFT", "HARD"]),
  minimumTradingDays: z.number().int().nonnegative(),
  maxMinis: positiveNullableInt,
  maxMicros: positiveNullableInt,
  evaluationFee: money,
  resetFee: nullableMoney,
});

export const customRulePresetInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  propFirm: z.string().trim().min(1).max(160),
  variants: z.array(customRuleVariantSchema).min(1).max(20),
});

export const customRulePresetUpdateSchema = customRulePresetInputSchema.partial();
