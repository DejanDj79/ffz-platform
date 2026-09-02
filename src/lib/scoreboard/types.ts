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
  tradingStyle: string;
  instrumentsLabel: string;
  seasonStartDate: string | null;
  scoreboardNotes: string;

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

export type ScoreboardPerformance = {
  bestTrade: number | null;
  worstTrade: number | null;
  averageWin: number | null;
  averageLoss: number | null;
};

export type ScoreboardCalendarStatus =
  | "PROFIT"
  | "LOSS"
  | "NO_TRADE"
  | "FUTURE"
  | "OUTSIDE_MONTH";

export type ScoreboardCalendarDay = {
  day: number;
  pnl: number;
  status: ScoreboardCalendarStatus;
};

export type PublicScoreboardData = ScoreboardVisibility & {
  enabled: boolean;
  layout: ScoreboardLayout;

  goalLabel: string;
  tradingStyle: string;
  instrumentsLabel: string;
  scoreboardNotes: string;

  refreshSeconds: number;

  currentDay: number;
  startDate: string | null;

  calendar: {
    label: string;
    days: ScoreboardCalendarDay[];
  };

  challenge: null | {
    id: string;
    name: string;
    propFirm: string;
    status: string;
    phase: string;

    accountSize: number;
    startingBalance: number;
    currentBalance: number;
    pnl: number;

    profitTarget: number;
    profitTargetPct: number;

    maxDrawdown: number;
    maxDrawdownPct: number;

    dailyLossLimit: number | null;
    dailyLossLimitPct: number | null;

    daysTraded: number;

    targetRemaining: number;
    targetProgressPct: number;

    createdAt: string;
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

  performance: ScoreboardPerformance;

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
