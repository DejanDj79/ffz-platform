import { z } from "zod";

export const challengeStatusSchema = z.enum([
  "NOT_STARTED",
  "ACTIVE",
  "IN_PROGRESS",
  "PAUSED",
  "PASSED",
  "FAILED",
  "FUNDED",
  "CLOSED",
]);

export const challengePhaseSchema = z.enum([
  "EVALUATION",
  "VERIFICATION",
  "SIM_FUNDED",
  "FUNDED",
  "PAYOUT",
  "OTHER",
]);

export const drawdownTypeSchema = z.enum([
  "STATIC",
  "EOD_TRAILING",
  "INTRADAY_TRAILING",
]);

export const breachTypeSchema = z.enum(["NONE", "SOFT", "HARD"]);

const money = z.number().finite().nonnegative();
const signedMoney = z.number().finite();
const nullableMoney = money.nullable();
const drawdownLockOffset = z.number().finite().refine(
  (value) => value === -1 || value >= 0,
  "Drawdown lock offset must be -1 (no lock) or a non-negative amount.",
);

export const createChallengeSchema = z.object({
  rulesPresetId: z.string().max(160).nullable().default(null),
  propFirm: z.string().trim().min(1).max(160),
  name: z.string().trim().min(1).max(160),

  status: challengeStatusSchema.default("NOT_STARTED"),
  phase: challengePhaseSchema.default("EVALUATION"),
  drawdownType: drawdownTypeSchema.default("STATIC"),
  dailyLossBreachType: breachTypeSchema.default("HARD"),

  accountSize: money,
  startingBalance: money,
  currentBalance: money,
  highestEodBalance: money,
  todayPnl: signedMoney.default(0),

  profitTarget: money,
  maxDrawdown: money,
  drawdownLockFloorOffset: drawdownLockOffset.default(0),
  dailyLossLimit: nullableMoney.default(null),

  challengeFee: money.default(0),
  resetFee: nullableMoney.default(null),
  resetCount: z.number().int().nonnegative().default(0),

  maxMiniContracts: z.number().int().positive().nullable().default(null),
  maxMicroContracts: z.number().int().positive().nullable().default(null),

  minimumTradingDays: z.number().int().nonnegative().nullable().default(null),
  daysTraded: z.number().int().nonnegative().default(0),

  notes: z.string().max(5000).nullable().default(null),
});

export const updateChallengeSchema = createChallengeSchema.partial();
