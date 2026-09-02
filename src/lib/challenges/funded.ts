import { getPropFirmPreset } from "@/lib/prop-firms";
import type { PayoutEligibilityMode } from "@/lib/prop-firms";
import type { TradeApiModel } from "@/lib/journal/types";
import type { LedgerEntryApiModel } from "@/lib/ledger/types";
import type { Challenge } from "./types";

export type FundedPayoutSummary = {
  isFunded: boolean;
  payoutCount: number;
  lastPayoutAt: string | null;
  cycleTrades: number;
  tradingDays: number;
  payoutScheduleMode: PayoutEligibilityMode;
  payoutWaitDays: number | null;
  payoutUnlockAt: string | null;
  scheduleOk: boolean;
  /** Compatibility aliases for callers that still present generic payout days. */
  payoutDaysRequired: number | null;
  daysOk: boolean;
  cycleNetPnl: number;
  bestDayPnl: number | null;
  consistencyPct: number | null;
  consistencyLimitPct: number | null;
  consistencyOk: boolean;
  bufferAmount: number | null;
  bufferBalance: number | null;
  balanceAboveBuffer: number;
  bufferOk: boolean;
  payoutCap: number | null;
  grossPayoutAvailable: number;
  profitSplitPct: number | null;
  estimatedTraderPayout: number;
  eligible: boolean;
  readinessPct: number;
  journalNetPnl: number;
  estimatedGrossWithdrawn: number;
  journalDerivedBalance: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const roundMoney = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const roundPct = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

function marketDateKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "invalid";

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type: "year" | "month" | "day") =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function payoutEntriesForChallenge(
  challengeId: string,
  ledgerEntries: LedgerEntryApiModel[],
) {
  return ledgerEntries
    .filter(
      (entry) =>
        entry.challengeId === challengeId &&
        entry.entryType === "INCOME" &&
        entry.category === "PAYOUT",
    )
    .slice()
    .sort(
      (a, b) =>
        new Date(a.occurredAt).getTime() -
        new Date(b.occurredAt).getTime(),
    );
}

export function effectiveChallengeAfterPayouts(
  challenge: Challenge,
  ledgerEntries: LedgerEntryApiModel[],
): Challenge {
  const payouts = payoutEntriesForChallenge(challenge.id, ledgerEntries);
  if (payouts.length === 0) return challenge;

  const preset = getPropFirmPreset(challenge.rulesPresetId);
  const postPayoutOffset = preset?.postPayoutDrawdownLockFloorOffset;
  if (postPayoutOffset == null) return challenge;

  return {
    ...challenge,
    drawdownLockFloorOffset: Math.max(
      challenge.drawdownLockFloorOffset ?? 0,
      postPayoutOffset,
    ),
  };
}

export function calculateFundedPayoutSummary(
  challenge: Challenge,
  trades: TradeApiModel[],
  ledgerEntries: LedgerEntryApiModel[],
  now = new Date(),
): FundedPayoutSummary {
  const preset = getPropFirmPreset(challenge.rulesPresetId);
  const isFunded =
    challenge.status === "FUNDED" ||
    challenge.phase === "FUNDED" ||
    challenge.phase === "PAYOUT";

  const payouts = payoutEntriesForChallenge(challenge.id, ledgerEntries);
  const lastPayoutAt = payouts.at(-1)?.occurredAt ?? null;
  const lastPayoutMs = lastPayoutAt
    ? new Date(lastPayoutAt).getTime()
    : Number.NEGATIVE_INFINITY;

  const linkedClosedTrades = trades
    .filter(
      (trade) =>
        trade.challengeId === challenge.id &&
        trade.status === "CLOSED" &&
        trade.netPnl != null,
    )
    .slice()
    .sort(
      (a, b) =>
        new Date(a.closedAt ?? a.openedAt).getTime() -
        new Date(b.closedAt ?? b.openedAt).getTime(),
    );

  const cycle = linkedClosedTrades.filter(
    (trade) => new Date(trade.openedAt).getTime() > lastPayoutMs,
  );

  const dailyPnl = new Map<string, number>();
  for (const trade of cycle) {
    const key = marketDateKey(trade.closedAt ?? trade.openedAt);
    dailyPnl.set(key, roundMoney((dailyPnl.get(key) ?? 0) + (trade.netPnl ?? 0)));
  }

  const dailyValues = [...dailyPnl.values()];
  const cycleNetPnl = roundMoney(
    cycle.reduce((sum, trade) => sum + (trade.netPnl ?? 0), 0),
  );
  const bestDayPnl = dailyValues.length > 0 ? Math.max(...dailyValues) : null;
  const consistencyPct =
    bestDayPnl != null && bestDayPnl > 0 && cycleNetPnl > 0
      ? roundPct((bestDayPnl / cycleNetPnl) * 100)
      : null;

  const payoutWaitDays = preset?.payoutEligibleAfterTradingDays ?? null;
  const payoutScheduleMode: PayoutEligibilityMode =
    preset?.payoutEligibilityMode ?? "TRADING_DAYS";
  const firstCycleTrade = cycle[0] ?? null;
  const payoutUnlockAt =
    payoutWaitDays != null &&
    payoutWaitDays > 0 &&
    firstCycleTrade &&
    payoutScheduleMode === "CALENDAR_DAYS_AFTER_FIRST_TRADE"
      ? new Date(
          new Date(firstCycleTrade.openedAt).getTime() + payoutWaitDays * DAY_MS,
        ).toISOString()
      : null;
  const scheduleOk =
    payoutWaitDays == null ||
    payoutWaitDays <= 0 ||
    (payoutScheduleMode === "CALENDAR_DAYS_AFTER_FIRST_TRADE"
      ? payoutUnlockAt != null && now.getTime() >= new Date(payoutUnlockAt).getTime()
      : dailyPnl.size >= payoutWaitDays);

  const consistencyLimitPct = preset?.fundedConsistencyPct ?? null;
  const consistencyOk =
    consistencyLimitPct == null ||
    consistencyLimitPct <= 0 ||
    (consistencyPct != null && consistencyPct < consistencyLimitPct);

  const bufferAmount = preset?.fundedBuffer ?? null;
  const bufferBalance =
    bufferAmount == null
      ? null
      : roundMoney(challenge.startingBalance + bufferAmount);
  const balanceAboveBuffer =
    bufferBalance == null
      ? Math.max(0, challenge.currentBalance - challenge.startingBalance)
      : Math.max(0, roundMoney(challenge.currentBalance - bufferBalance));
  const bufferOk =
    bufferBalance == null || challenge.currentBalance > bufferBalance;

  const payoutCap =
    payouts.length === 0
      ? preset?.firstPayoutCap ?? null
      : preset?.laterPayoutCap ?? preset?.firstPayoutCap ?? null;
  const grossPayoutAvailable = roundMoney(
    Math.max(
      0,
      payoutCap == null
        ? balanceAboveBuffer
        : Math.min(balanceAboveBuffer, payoutCap),
    ),
  );

  const profitSplitPct = preset?.profitSplitPct ?? null;
  const estimatedTraderPayout = roundMoney(
    grossPayoutAvailable *
      (profitSplitPct == null ? 1 : profitSplitPct / 100),
  );

  const journalNetPnl = roundMoney(
    linkedClosedTrades.reduce((sum, trade) => sum + (trade.netPnl ?? 0), 0),
  );
  const split = profitSplitPct != null && profitSplitPct > 0
    ? profitSplitPct / 100
    : 1;
  const estimatedGrossWithdrawn = roundMoney(
    payouts.reduce((sum, entry) => sum + entry.amount / split, 0),
  );
  const journalDerivedBalance = roundMoney(
    challenge.startingBalance + journalNetPnl - estimatedGrossWithdrawn,
  );

  const gates = [scheduleOk, consistencyOk, bufferOk];
  const readinessPct = roundPct(
    (gates.filter(Boolean).length / gates.length) * 100,
  );
  const eligible =
    isFunded &&
    scheduleOk &&
    consistencyOk &&
    bufferOk &&
    grossPayoutAvailable > 0;

  return {
    isFunded,
    payoutCount: payouts.length,
    lastPayoutAt,
    cycleTrades: cycle.length,
    tradingDays: dailyPnl.size,
    payoutScheduleMode,
    payoutWaitDays,
    payoutUnlockAt,
    scheduleOk,
    payoutDaysRequired: payoutWaitDays,
    daysOk: scheduleOk,
    cycleNetPnl,
    bestDayPnl,
    consistencyPct,
    consistencyLimitPct,
    consistencyOk,
    bufferAmount,
    bufferBalance,
    balanceAboveBuffer,
    bufferOk,
    payoutCap,
    grossPayoutAvailable,
    profitSplitPct,
    estimatedTraderPayout,
    eligible,
    readinessPct,
    journalNetPnl,
    estimatedGrossWithdrawn,
    journalDerivedBalance,
  };
}

export function createFundedAccountFromEvaluation(
  evaluation: Challenge,
): Challenge {
  const now = new Date().toISOString();
  const preset = getPropFirmPreset(evaluation.rulesPresetId);
  const fundedName = evaluation.name.toLowerCase().includes("funded")
    ? evaluation.name
    : `${evaluation.name} — Funded`;

  return {
    ...evaluation,
    id: crypto.randomUUID(),
    name: fundedName,
    startingBalance: evaluation.accountSize,
    currentBalance: evaluation.accountSize,
    highestEodBalance: evaluation.accountSize,
    todayPnl: 0,
    profitTarget: 0,
    challengeFee: 0,
    resetFee: 0,
    resetsUsed: 0,
    minimumTradingDays: 0,
    daysTraded: 0,
    status: "FUNDED",
    phase: "FUNDED",
    drawdownLockFloorOffset:
      preset?.drawdownLockFloorOffset ??
      evaluation.drawdownLockFloorOffset ??
      0,
    notes: evaluation.notes
      ? `${evaluation.notes}\nFunded account created from passed evaluation: ${evaluation.name}.`
      : `Funded account created from passed evaluation: ${evaluation.name}.`,
    createdAt: now,
    updatedAt: now,
  };
}
