import { listChallenges } from "@/lib/challenges/repository";
import { listTrades } from "@/lib/journal/repository";
import { listLedgerEntries } from "@/lib/ledger/repository";

export type EpisodeBuilderFilters = {
  from: Date;
  to: Date;
  challengeId: string | null;
};

type EpisodeTrade = Awaited<ReturnType<typeof listTrades>>[number];
type EpisodeChallenge = Awaited<ReturnType<typeof listChallenges>>[number];

type FeaturedTrade = {
  id: string;
  instrument: string;
  direction: "LONG" | "SHORT";
  closedAt: string | null;
  netPnl: number;
  rMultiple: number | null;
  setup: string | null;
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
  featuredTrades: FeaturedTrade[];
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

function featuredTrades(trades: EpisodeTrade[]): FeaturedTrade[] {
  const withPnl = trades
    .filter((trade) => trade.netPnl != null)
    .sort((a, b) => (b.netPnl ?? 0) - (a.netPnl ?? 0));

  if (withPnl.length === 0) return [];

  const picks: Array<{ trade: EpisodeTrade; label: string }> = [
    { trade: withPnl[0], label: "BEST TRADE" },
  ];

  if (withPnl.length > 1) {
    picks.push({ trade: withPnl[withPnl.length - 1], label: "WORST TRADE" });
  }

  const biggestR = [...withPnl]
    .filter((trade) => trade.rMultiple != null)
    .sort((a, b) => Math.abs(b.rMultiple ?? 0) - Math.abs(a.rMultiple ?? 0))[0];

  if (biggestR && !picks.some(({ trade }) => trade.id === biggestR.id)) {
    picks.push({ trade: biggestR, label: "BIGGEST R MOVE" });
  }

  return picks.slice(0, 3).map(({ trade, label }) => ({
    id: trade.id,
    instrument: trade.instrument,
    direction: trade.direction,
    closedAt: trade.closedAt,
    netPnl: trade.netPnl ?? 0,
    rMultiple: trade.rMultiple,
    setup: trade.setup,
    label,
  }));
}

export async function buildEpisodeSnapshot(
  userId: string,
  filters: EpisodeBuilderFilters,
): Promise<EpisodeSnapshot> {
  const [allTrades, challenges, allLedger] = await Promise.all([
    listTrades(userId),
    listChallenges(userId),
    listLedgerEntries(userId),
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
  const featured = featuredTrades(trades);

  const talkingPoints: string[] = [];
  if (trades.length === 0) {
    talkingPoints.push("No closed trades in this period — useful for a reset, planning or process-focused episode.");
  } else {
    talkingPoints.push(`${trades.length} closed trades produced ${money(netPnl)} net P&L with a ${percent(winRate)} win rate.`);
    if (averageR != null) talkingPoints.push(`Average result was ${averageR.toFixed(2)}R across trades with recorded risk.`);
    if (topSetup) talkingPoints.push(`${topSetup} was the most-used setup in this period.`);
    if (featured[0]) talkingPoints.push(`Best trade: ${featured[0].instrument} ${featured[0].direction} for ${money(featured[0].netPnl)}.`);
    const worst = featured.find((trade) => trade.label === "WORST TRADE");
    if (worst) talkingPoints.push(`Trade worth reviewing: ${worst.instrument} ${worst.direction} for ${money(worst.netPnl)}.`);
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
    featuredTrades: featured,
    talkingPoints,
    brief,
  };
}
