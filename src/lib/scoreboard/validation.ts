import { z } from "zod";

export const updateScoreboardSettingsSchema = z.object({
  challengeId: z.string().uuid().nullable().optional(),
  layout: z.enum(["COMPACT", "FULL"]).optional(),

  goalLabel: z.string().trim().min(1).max(100).optional(),
  tradingStyle: z.string().trim().min(1).max(80).optional(),
  instrumentsLabel: z.string().trim().min(1).max(80).optional(),
  seasonStartDate: z.string().datetime({ offset: true }).nullable().optional(),
  scoreboardNotes: z.string().max(1200).optional(),

  refreshSeconds: z.number().int().min(2).max(60).optional(),
  isEnabled: z.boolean().optional(),

  showBalance: z.boolean().optional(),
  showChallengePnl: z.boolean().optional(),
  showTargetProgress: z.boolean().optional(),
  showTradeCount: z.boolean().optional(),
  showWinRate: z.boolean().optional(),
  showAverageR: z.boolean().optional(),
  showRealMoneyNet: z.boolean().optional(),
  showRealPayouts: z.boolean().optional(),
});
