export type ChallengeApiStatus =
  | "NOT_STARTED"
  | "ACTIVE"
  | "IN_PROGRESS"
  | "PAUSED"
  | "PASSED"
  | "FAILED"
  | "FUNDED"
  | "CLOSED";

export type ChallengeApiPhase =
  | "EVALUATION"
  | "VERIFICATION"
  | "SIM_FUNDED"
  | "FUNDED"
  | "PAYOUT"
  | "OTHER";

export type ChallengeApiModel = {
  id: string;
  rulesPresetId: string | null;
  propFirm: string;
  name: string;

  status: ChallengeApiStatus;
  phase: ChallengeApiPhase;
  drawdownType: "STATIC" | "EOD_TRAILING" | "INTRADAY_TRAILING";
  dailyLossBreachType: "NONE" | "SOFT" | "HARD";

  accountSize: number;
  startingBalance: number;
  currentBalance: number;
  highestEodBalance: number;
  todayPnl: number;

  profitTarget: number;
  maxDrawdown: number;
  drawdownLockFloorOffset: number;
  dailyLossLimit: number | null;

  challengeFee: number;
  resetFee: number | null;
  resetCount: number;

  maxMiniContracts: number | null;
  maxMicroContracts: number | null;

  minimumTradingDays: number | null;
  daysTraded: number;
  notes: string | null;

  createdAt: string;
  updatedAt: string;
};

export type CreateChallengeApiInput = Omit<
  ChallengeApiModel,
  "id" | "createdAt" | "updatedAt"
>;

export type UpdateChallengeApiInput = Partial<CreateChallengeApiInput>;
