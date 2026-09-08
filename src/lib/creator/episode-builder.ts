import { listChallenges } from "@/lib/challenges/repository";
import { readDisciplineReview } from "@/lib/journal/discipline";
import { listTrades } from "@/lib/journal/repository";
import { listLedgerEntries } from "@/lib/ledger/repository";
import { getTradingGuardrailSettings } from "@/lib/trading/guardrails-repository";
import { orderEpisodeTrades } from "./episode-trades";

export type EpisodeBuilderFilters = {
  from: Date;
  to: Date;
  challengeId: string | null;
};

type EpisodeTrade = Awaited<ReturnType<typeof listTrades>>[number];
type EpisodeChallenge = Awaited<ReturnType<typeof listChallenges>>[number];

type EpisodeTradeSummary = {
  id: string;
  instrument: string;
  direction: "LONG" | "SHORT";
  openedAt: string;
  closedAt: string | null;
  netPnl: number;
  rMultiple: number | null;
  initialRisk: number | null;
  outcome: "WIN" | "LOSS" | "BREAKEVEN" | null;
  setup: string | null;
  notes: string | null;
  execution: "ON_PLAN" | "DEVIATED" | "UNPLANNED" | null;
  mindset: "CALM" | "FOCUSED" | "FOMO" | "REVENGE" | "FEAR" | "FRUSTRATED" | "TIRED" | null;
  label: string;
};

export type EpisodeSnapshot = {
  filters: EpisodeBuilderFilters;
  challenge: EpisodeChallenge | null;
  challenges: EpisodeChallenge[];
  tradeCount: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number | null;
  netPnl: number;
  averageR: number | null;
  totalRisk: number;
  costs: number;
  payouts: number;
  otherIncome: number;
  realMoneyNet: number;
  topSetup: string | null;
  guardrails: {
    maxDailyLosses: number | null;
    maxTradesPerDay: number | null;
    maxRiskPerTrade: number | null;
  };
  episodeTrades: EpisodeTradeSummary[];
  talkingPoints: string[];
  brief: string;
};

function inRange(value: string | null, from: Date, to: Date) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return time >= from.getTime() && time <= to.getTime();
}

function money(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function percent(value: number | null) {
  return value == null ? "—" : `${value.toFixed(1)}%`;
}

function dateLabel(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

function mostCommonSetup(trades: EpisodeTrade[]) {
  const counts = new Map<string, number>();
  for (const trade of trades) {
    const setup = trade.setup?.trim();
    if (!setup) continue;
    counts.set(setup, (counts.get(setup) ?? 0) + 1);
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function episodeTradeSummaries(trades: EpisodeTrade[]): EpisodeTradeSummary[] {
  return orderEpisodeTrades(trades).map((trade, index) => {
    const review = readDisciplineReview(trade.tags);
    return {
      id: trade.id,
      instrument: trade.instrument,
      direction: trade.direction,
      openedAt: trade.openedAt,
      closedAt: trade.closedAt,
      netPnl: trade.netPnl ?? 0,
      rMultiple: trade.rMultiple,
      initialRisk: trade.initialRisk,
      outcome: trade.outcome,
      setup: trade.setup,
      notes: trade.notes,
      execution: review.execution,
      mindset: review.mindset,
      label: `TRADE ${index + 1}`,
    };
  });
}

function tradeBriefLine(trade: EpisodeTradeSummary) {
  const setup = trade.setup ? ` · ${trade.setup}` : "";
  const rMultiple = trade.rMultiple == null ? "" : ` · ${trade.rMultiple.toFixed(2)}R`;
  return `- ${trade.label}: ${trade.instrument} ${trade.direction} · ${money(trade.netPnl)}${rMultiple}${setup}`;
}

export async function buildEpisodeSnapshot(
  userId: string,
  filters: EpisodeBuilderFilters,
): Promise<EpisodeSnapshot> {
  const [allTrades, challenges, allLedger, guardrailSettings] = await Promise.all([
    listTrades(userId),
    listChallenges(userId),
    listLedgerEntries(userId),
    getTradingGuardrailSettings(userId),
  ]);

  const challenge = filters.challengeId
    ? challenges.find((item) => item.id === filters.challengeId) ?? null
    : null;

  const trades = allTrades.filter((trade) => {
    if (trade.status !== "CLOSED") return false;
    if (!inRange(trade.closedAt ?? trade.openedAt, filters.from, filters.to)) return false;
    if (filters.challengeId && trade.challengeId !== filters.challengeId) return false;
    return true;
  });

  const ledger = allLedger.filter((entry) => {
    if (!inRange(entry.occurredAt, filters.from, filters.to)) return false;
    if (filters.challengeId && entry.challengeId !== filters.challengeId) return false;
    return true;
  });

  const wins = trades.filter((trade) => trade.outcome === "WIN").length;
  const losses = trades.filter((trade) => trade.outcome === "LOSS").length;
  const breakeven = trades.filter((trade) => trade.outcome === "BREAKEVEN").length;
  const decided = wins + losses;
  const winRate = decided > 0 ? (wins / decided) * 100 : null;
  const netPnl = trades.reduce((sum, trade) => sum + (trade.netPnl ?? 0), 0);
  const totalRisk = trades.reduce((sum, trade) => sum + (trade.initialRisk ?? 0), 0);
  const rTrades = trades.filter((trade) => trade.rMultiple != null);
  const averageR = rTrades.length > 0
    ? rTrades.reduce((sum, trade) => sum + (trade.rMultiple ?? 0), 0) / rTrades.length
    : null;

  const costs = ledger
    .filter((entry) => entry.entryType === "EXPENSE")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const payouts = ledger
    .filter((entry) => entry.entryType === "INCOME" && entry.category === "PAYOUT")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const otherIncome = ledger
    .filter((entry) => entry.entryType === "INCOME" && entry.category !== "PAYOUT")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const realMoneyNet = payouts + otherIncome - costs;
  const topSetup = mostCommonSetup(trades);
  const episodeTrades = episodeTradeSummaries(trades);
  const guardrails = {
    maxDailyLosses: guardrailSettings.maxDailyLosses.enabled
      ? guardrailSettings.maxDailyLosses.value
      : null,
    maxTradesPerDay: guardrailSettings.maxTradesPerDay.enabled
      ? guardrailSettings.maxTradesPerDay.value
      : null,
    maxRiskPerTrade: guardrailSettings.maxRiskPerTrade.enabled
      ? guardrailSettings.maxRiskPerTrade.value
      : null,
  };

  const rankedByPnl = [...trades]
    .filter((trade) => trade.netPnl != null)
    .sort((a, b) => (b.netPnl ?? 0) - (a.netPnl ?? 0));
  const bestTrade = rankedByPnl[0] ?? null;
  const worstTrade = rankedByPnl.length > 1 ? rankedByPnl[rankedByPnl.length - 1] : null;

  const talkingPoints: string[] = [];
  if (trades.length === 0) {
    talkingPoints.push("No closed trades in this period — useful for a reset, planning or process-focused episode.");
  } else {
    talkingPoints.push(`${trades.length} closed trades produced ${money(netPnl)} net P&L with a ${percent(winRate)} win rate.`);
    if (averageR != null) talkingPoints.push(`Average result was ${averageR.toFixed(2)}R across trades with recorded risk.`);
    if (topSetup) talkingPoints.push(`${topSetup} was the most-used setup in this period.`);
    if (bestTrade) talkingPoints.push(`Best trade: ${bestTrade.instrument} ${bestTrade.direction} for ${money(bestTrade.netPnl ?? 0)}.`);
    if (worstTrade) talkingPoints.push(`Trade worth reviewing: ${worstTrade.instrument} ${worstTrade.direction} for ${money(worstTrade.netPnl ?? 0)}.`);
  }

  if (costs > 0 || payouts > 0 || otherIncome > 0) {
    talkingPoints.push(`Real-money activity: ${money(payouts + otherIncome)} income, $${costs.toFixed(2)} costs, ${money(realMoneyNet)} net cash.`);
  }

  if (challenge) {
    const challengePnl = challenge.currentBalance - challenge.startingBalance;
    const targetProgress = challenge.profitTarget > 0
      ? Math.max(0, Math.min(100, (challengePnl / challenge.profitTarget) * 100))
      : 0;
    talkingPoints.push(`${challenge.propFirm} ${challenge.name}: ${challenge.status.replaceAll("_", " ")} · ${money(challengePnl)} challenge P&L · ${targetProgress.toFixed(0)}% of target.`);
  }

  const title = challenge
    ? `${challenge.propFirm} — ${challenge.name}`
    : "All FFZ trading activity";

  const brief = [
    "FFZ EPISODE BRIEF",
    `${dateLabel(filters.from)} → ${dateLabel(filters.to)}`,
    title,
    "",
    `Trades: ${trades.length} (${wins}W / ${losses}L / ${breakeven}BE)`,
    `Net P&L: ${money(netPnl)}`,
    `Win rate: ${percent(winRate)}`,
    `Average R: ${averageR == null ? "—" : `${averageR.toFixed(2)}R`}`,
    `Recorded risk: $${totalRisk.toFixed(2)}`,
    `Real-money costs: $${costs.toFixed(2)}`,
    `Payouts: $${payouts.toFixed(2)}`,
    `Real-money net: ${money(realMoneyNet)}`,
    topSetup ? `Top setup: ${topSetup}` : null,
    "",
    "TALKING POINTS",
    ...talkingPoints.map((point) => `- ${point}`),
    "",
    "TRADES IN ORDER",
    ...(episodeTrades.length > 0
      ? episodeTrades.map(tradeBriefLine)
      : ["- No closed trades in this period."]),
  ].filter((line): line is string => line != null).join("\n");

  return {
    filters,
    challenge,
    challenges,
    tradeCount: trades.length,
    wins,
    losses,
    breakeven,
    winRate,
    netPnl,
    averageR,
    totalRisk,
    costs,
    payouts,
    otherIncome,
    realMoneyNet,
    topSetup,
    guardrails,
    episodeTrades,
    talkingPoints,
    brief,
  };
}
