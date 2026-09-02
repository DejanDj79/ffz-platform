import { db } from "@/db/client";
import {
  scoreboardSettings,
  users,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { listChallenges } from "@/lib/challenges/repository";
import { listTrades } from "@/lib/journal/repository";
import { listLedgerEntries } from "@/lib/ledger/repository";
import { calculateJournalStats } from "@/lib/journal/stats";
import { calculateLedgerStats } from "@/lib/ledger/stats";
import {
  buildMonthlyScoreboardCalendar,
  calculateJourneyDay,
  calculateScoreboardChallenge,
  calculateScoreboardPerformance,
  selectScoreboardChallenge,
} from "./metrics";
import type { PublicScoreboardData } from "./types";

const EMPTY_JOURNAL = {
  totalTrades: 0,
  closedTrades: 0,
  openTrades: 0,
  wins: 0,
  losses: 0,
  breakeven: 0,
  netPnl: 0,
  winRate: null,
  averageR: null,
  profitFactor: null,
};

const EMPTY_PERFORMANCE = {
  bestTrade: null,
  worstTrade: null,
  averageWin: null,
  averageLoss: null,
};

const EMPTY_LEDGER = {
  totalExpenses: 0,
  totalIncome: 0,
  netCashFlow: 0,
  challengeCosts: 0,
  payouts: 0,
  refunds: 0,
  entryCount: 0,
};

export async function buildPublicScoreboardData(
  overlayKey: string,
): Promise<PublicScoreboardData | null> {
  const settingsRows = await db
    .select({
      settings: scoreboardSettings,
      ownerRole: users.role,
    })
    .from(scoreboardSettings)
    .innerJoin(
      users,
      eq(scoreboardSettings.userId, users.id),
    )
    .where(eq(scoreboardSettings.overlayKey, overlayKey))
    .limit(1);

  const result = settingsRows[0];
  if (!result || result.ownerRole !== "CREATOR") return null;

  const settings = result.settings;

  const base = {
    enabled: settings.isEnabled,
    layout: settings.layout as "COMPACT" | "FULL",

    goalLabel: settings.goalLabel,
    tradingStyle: settings.tradingStyle,
    instrumentsLabel: settings.instrumentsLabel,
    scoreboardNotes: settings.scoreboardNotes,

    refreshSeconds: settings.refreshSeconds,

    showBalance: settings.showBalance,
    showChallengePnl: settings.showChallengePnl,
    showTargetProgress: settings.showTargetProgress,
    showTradeCount: settings.showTradeCount,
    showWinRate: settings.showWinRate,
    showAverageR: settings.showAverageR,
    showRealMoneyNet: settings.showRealMoneyNet,
    showRealPayouts: settings.showRealPayouts,
  };

  if (!settings.isEnabled) {
    return {
      ...base,
      currentDay: 1,
      startDate: settings.seasonStartDate?.toISOString() ?? null,
      calendar: buildMonthlyScoreboardCalendar([]),
      challenge: null,
      journal: EMPTY_JOURNAL,
      performance: EMPTY_PERFORMANCE,
      ledger: EMPTY_LEDGER,
      updatedAt: new Date().toISOString(),
    };
  }

  const [challenges, allTrades, ledgerEntries] =
    await Promise.all([
      listChallenges(settings.userId),
      listTrades(settings.userId),
      listLedgerEntries(settings.userId),
    ]);

  const selectedChallenge = selectScoreboardChallenge(
    challenges,
    settings.challengeId,
  );

  const scoreboardTrades = selectedChallenge
    ? allTrades.filter(
        (trade) =>
          trade.challengeId === selectedChallenge.id,
      )
    : allTrades;

  const startDate =
    settings.seasonStartDate?.toISOString() ??
    selectedChallenge?.createdAt ??
    null;

  return {
    ...base,

    currentDay: calculateJourneyDay(startDate),
    startDate,

    calendar: buildMonthlyScoreboardCalendar(
      scoreboardTrades,
    ),

    challenge: calculateScoreboardChallenge(
      selectedChallenge,
    ),

    journal: calculateJournalStats(scoreboardTrades),

    performance:
      calculateScoreboardPerformance(scoreboardTrades),

    ledger: calculateLedgerStats(ledgerEntries),

    updatedAt: new Date().toISOString(),
  };
}
