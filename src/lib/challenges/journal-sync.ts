import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { challenges, ledgerEntries, trades } from "@/db/schema";
import { getPropFirmPreset } from "@/lib/prop-firms";
import { marketDateKey } from "@/lib/journal/market-time";
import { PLANNED_TRADE_TAG } from "@/lib/journal/planned";

export type JournalSyncTrade = {
  openedAt: Date;
  closedAt: Date | null;
  status: "OPEN" | "CLOSED";
  netPnlCents: number | null;
  tags: string[];
};

export type JournalSyncPayout = {
  occurredAt: Date;
  amountCents: number;
};

export type JournalChallengeSyncResult = {
  currentBalanceCents: number;
  highestEodBalanceCents: number;
  todayPnlCents: number;
  daysTraded: number;
  journalNetPnlCents: number;
  estimatedGrossWithdrawnCents: number;
};

function grossWithdrawalCents(amountCents: number, profitSplitPct: number | null) {
  if (profitSplitPct == null || profitSplitPct <= 0) return amountCents;
  return Math.round(amountCents / (profitSplitPct / 100));
}

export function calculateJournalChallengeSync({
  startingBalanceCents,
  trades: journalTrades,
  payouts,
  profitSplitPct,
  now = new Date(),
}: {
  startingBalanceCents: number;
  trades: JournalSyncTrade[];
  payouts: JournalSyncPayout[];
  profitSplitPct: number | null;
  now?: Date;
}): JournalChallengeSyncResult {
  const closedTrades = journalTrades
    .filter(
      (trade) =>
        trade.status === "CLOSED" &&
        trade.netPnlCents != null &&
        !trade.tags.includes(PLANNED_TRADE_TAG),
    )
    .slice()
    .sort(
      (a, b) =>
        (a.closedAt ?? a.openedAt).getTime() -
        (b.closedAt ?? b.openedAt).getTime(),
    );

  const tradePnlByDay = new Map<string, number>();
  for (const trade of closedTrades) {
    const key = marketDateKey(trade.closedAt ?? trade.openedAt);
    tradePnlByDay.set(key, (tradePnlByDay.get(key) ?? 0) + (trade.netPnlCents ?? 0));
  }

  const payoutByDay = new Map<string, number>();
  let estimatedGrossWithdrawnCents = 0;
  for (const payout of payouts) {
    const gross = grossWithdrawalCents(payout.amountCents, profitSplitPct);
    estimatedGrossWithdrawnCents += gross;
    const key = marketDateKey(payout.occurredAt);
    payoutByDay.set(key, (payoutByDay.get(key) ?? 0) + gross);
  }

  const journalNetPnlCents = closedTrades.reduce(
    (sum, trade) => sum + (trade.netPnlCents ?? 0),
    0,
  );

  const allDays = [...new Set([...tradePnlByDay.keys(), ...payoutByDay.keys()])]
    .filter((key) => key !== "invalid")
    .sort();

  let runningBalance = startingBalanceCents;
  let highestEodBalanceCents = startingBalanceCents;
  for (const key of allDays) {
    runningBalance += tradePnlByDay.get(key) ?? 0;
    runningBalance -= payoutByDay.get(key) ?? 0;
    highestEodBalanceCents = Math.max(highestEodBalanceCents, runningBalance);
  }

  const todayPnlCents = tradePnlByDay.get(marketDateKey(now)) ?? 0;

  return {
    currentBalanceCents:
      startingBalanceCents + journalNetPnlCents - estimatedGrossWithdrawnCents,
    highestEodBalanceCents,
    todayPnlCents,
    daysTraded: tradePnlByDay.size,
    journalNetPnlCents,
    estimatedGrossWithdrawnCents,
  };
}

export async function syncChallengeFromJournal(
  userId: string,
  challengeId: string,
  now = new Date(),
  force = false,
) {
  const challengeRows = await db
    .select()
    .from(challenges)
    .where(and(eq(challenges.userId, userId), eq(challenges.id, challengeId)))
    .limit(1);

  const challenge = challengeRows[0];
  if (!challenge) return null;

  const [tradeRows, payoutRows] = await Promise.all([
    db
      .select({
        openedAt: trades.openedAt,
        closedAt: trades.closedAt,
        status: trades.status,
        netPnlCents: trades.netPnlCents,
        tags: trades.tags,
      })
      .from(trades)
      .where(and(eq(trades.userId, userId), eq(trades.challengeId, challengeId))),
    db
      .select({
        occurredAt: ledgerEntries.occurredAt,
        amountCents: ledgerEntries.amountCents,
      })
      .from(ledgerEntries)
      .where(
        and(
          eq(ledgerEntries.userId, userId),
          eq(ledgerEntries.challengeId, challengeId),
          eq(ledgerEntries.entryType, "INCOME"),
          eq(ledgerEntries.category, "PAYOUT"),
        ),
      ),
  ]);

  const normalizedTrades = tradeRows.map((trade) => ({
    ...trade,
    tags: Array.isArray(trade.tags) ? trade.tags : [],
  }));
  const hasRegularTrade = normalizedTrades.some(
    (trade) => !trade.tags.includes(PLANNED_TRADE_TAG),
  );

  if (!force && !hasRegularTrade && payoutRows.length === 0) {
    return null;
  }

  const preset = getPropFirmPreset(challenge.rulesPresetId);
  const result = calculateJournalChallengeSync({
    startingBalanceCents: challenge.startingBalanceCents,
    trades: normalizedTrades,
    payouts: payoutRows,
    profitSplitPct: preset?.profitSplitPct ?? null,
    now,
  });

  const changed =
    challenge.currentBalanceCents !== result.currentBalanceCents ||
    challenge.highestEodBalanceCents !== result.highestEodBalanceCents ||
    challenge.todayPnlCents !== result.todayPnlCents ||
    challenge.daysTraded !== result.daysTraded;

  if (changed) {
    await db
      .update(challenges)
      .set({
        currentBalanceCents: result.currentBalanceCents,
        highestEodBalanceCents: result.highestEodBalanceCents,
        todayPnlCents: result.todayPnlCents,
        daysTraded: result.daysTraded,
        updatedAt: new Date(),
      })
      .where(and(eq(challenges.userId, userId), eq(challenges.id, challengeId)));
  }

  return result;
}

export async function syncChallengesFromJournal(
  userId: string,
  challengeIds: Array<string | null | undefined>,
  now = new Date(),
  force = false,
) {
  const ids = [...new Set(challengeIds.filter((id): id is string => Boolean(id)))];
  await Promise.all(ids.map((id) => syncChallengeFromJournal(userId, id, now, force)));
}

export async function syncAllChallengesFromJournal(userId: string, now = new Date()) {
  const rows = await db
    .select({ id: challenges.id })
    .from(challenges)
    .where(eq(challenges.userId, userId));

  await syncChallengesFromJournal(userId, rows.map((row) => row.id), now, false);
}
