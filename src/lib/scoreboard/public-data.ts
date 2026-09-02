import { db } from "@/db/client";
import {
  scoreboardSettings,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { listChallenges } from "@/lib/challenges/repository";
import { listTrades } from "@/lib/journal/repository";
import { listLedgerEntries } from "@/lib/ledger/repository";
import { calculateJournalStats } from "@/lib/journal/stats";
import { calculateLedgerStats } from "@/lib/ledger/stats";
import {
  calculateScoreboardChallenge,
  selectScoreboardChallenge,
} from "./metrics";
import type { PublicScoreboardData } from "./types";

export async function buildPublicScoreboardData(
  overlayKey: string,
): Promise<PublicScoreboardData | null> {
  const settingsRows = await db
    .select()
    .from(scoreboardSettings)
    .where(eq(scoreboardSettings.overlayKey, overlayKey))
    .limit(1);

  const settings = settingsRows[0];
  if (!settings) return null;

  if (!settings.isEnabled) {
    return {
      enabled: false,
      layout: settings.layout as "COMPACT" | "FULL",
      goalLabel: settings.goalLabel,
      refreshSeconds: settings.refreshSeconds,

      showBalance: settings.showBalance,
      showChallengePnl: settings.showChallengePnl,
      showTargetProgress: settings.showTargetProgress,
      showTradeCount: settings.showTradeCount,
      showWinRate: settings.showWinRate,
      showAverageR: settings.showAverageR,
      showRealMoneyNet: settings.showRealMoneyNet,
      showRealPayouts: settings.showRealPayouts,

      challenge: null,

      journal: {
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
      },

      ledger: {
        totalExpenses: 0,
        totalIncome: 0,
        netCashFlow: 0,
        challengeCosts: 0,
        payouts: 0,
        refunds: 0,
        entryCount: 0,
      },

      updatedAt: new Date().toISOString(),
    };
  }

  const [challenges, allTrades, ledgerEntries] = await Promise.all([
    listChallenges(settings.userId),
    listTrades(settings.userId),
    listLedgerEntries(settings.userId),
  ]);

  const selectedChallenge = selectScoreboardChallenge(
    challenges,
    settings.challengeId,
  );

  // If a challenge is selected, trading stats on the scoreboard are scoped
  // to that challenge. The Real Money Ledger remains journey-wide.
  const scoreboardTrades = selectedChallenge
    ? allTrades.filter(
        (trade) => trade.challengeId === selectedChallenge.id,
      )
    : allTrades;

  return {
    enabled: true,
    layout: settings.layout as "COMPACT" | "FULL",
    goalLabel: settings.goalLabel,
    refreshSeconds: settings.refreshSeconds,

    showBalance: settings.showBalance,
    showChallengePnl: settings.showChallengePnl,
    showTargetProgress: settings.showTargetProgress,
    showTradeCount: settings.showTradeCount,
    showWinRate: settings.showWinRate,
    showAverageR: settings.showAverageR,
    showRealMoneyNet: settings.showRealMoneyNet,
    showRealPayouts: settings.showRealPayouts,

    challenge: calculateScoreboardChallenge(selectedChallenge),
    journal: calculateJournalStats(scoreboardTrades),
    ledger: calculateLedgerStats(ledgerEntries),

    updatedAt: new Date().toISOString(),
  };
}
