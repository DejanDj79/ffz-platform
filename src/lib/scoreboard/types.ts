export type ScoreboardLayout = "COMPACT" | "FULL";

export type ScoreboardVisibility = {
  showBalance: boolean;
  showChallengePnl: boolean;
  showTargetProgress: boolean;
  showTradeCount: boolean;
  showWinRate: boolean;
  showAverageR: boolean;
  showRealMoneyNet: boolean;
  showRealPayouts: boolean;
};

export type ScoreboardSettingsApiModel = ScoreboardVisibility & {
  id: string;
  overlayKey: string;
  challengeId: string | null;
  layout: ScoreboardLayout;
  goalLabel: string;
  refreshSeconds: number;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UpdateScoreboardSettingsInput = Partial<
  Omit<
    ScoreboardSettingsApiModel,
    "id" | "overlayKey" | "createdAt" | "updatedAt"
  >
>;

export type PublicScoreboardData = ScoreboardVisibility & {
  enabled: boolean;
  layout: ScoreboardLayout;
  goalLabel: string;
  refreshSeconds: number;

  challenge: null | {
    id: string;
    name: string;
    propFirm: string;
    status: string;
    phase: string;
    startingBalance: number;
    currentBalance: number;
    pnl: number;
    profitTarget: number;
    targetRemaining: number;
    targetProgressPct: number;
  };

  journal: {
    totalTrades: number;
    closedTrades: number;
    openTrades: number;
    wins: number;
    losses: number;
    breakeven: number;
    netPnl: number;
    winRate: number | null;
    averageR: number | null;
    profitFactor: number | null;
  };

  ledger: {
    totalExpenses: number;
    totalIncome: number;
    netCashFlow: number;
    challengeCosts: number;
    payouts: number;
    refunds: number;
    entryCount: number;
  };

  updatedAt: string;
};
