import type { BreachType, DrawdownMode, PropFirmPresetId } from "@/lib/prop-firms";

export type ChallengeStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "PAUSED"
  | "PASSED"
  | "FAILED"
  | "FUNDED"
  | "CLOSED";

export type ChallengePhase =
  | "EVALUATION"
  | "VERIFICATION"
  | "SIM_FUNDED"
  | "FUNDED"
  | "PAYOUT"
  | "OTHER";

export type ChallengeHealth = "SAFE" | "CAUTION" | "DANGER";

export interface Challenge {
  id: string;
  propFirm: string;
  name: string;
  accountSize: number;
  startingBalance: number;
  profitTarget: number;
  maxDrawdown: number;
  dailyLossLimit: number;
  challengeFee: number;
  resetFee: number;
  resetsUsed: number;
  minimumTradingDays: number;
  currentBalance: number;
  todayPnl: number;
  daysTraded: number;
  status: ChallengeStatus;
  phase: ChallengePhase;
  notes: string;
  createdAt: string;
  updatedAt: string;

  rulesPresetId?: PropFirmPresetId;
  drawdownMode?: DrawdownMode;
  highestEodBalance?: number;
  drawdownLockFloorOffset?: number;
  dailyLossBreachType?: BreachType;
  maxMinis?: number | null;
  maxMicros?: number | null;
}

export interface ChallengeMetrics {
  currentPnl: number;
  targetProgressPct: number;
  profitTargetRemaining: number;
  drawdownFloor: number;
  remainingDrawdown: number;
  remainingDrawdownPct: number;
  remainingDailyLoss: number | null;
  remainingDailyLossPct: number | null;
  realMoneyCost: number;
  health: ChallengeHealth;
}
