import type { JournalBreakdownRow } from "./analytics";
import type { TradeApiModel } from "./types";

export const ALL_SETUPS = "ALL";
export const NO_SETUP = "NO SETUP";

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function setupName(trade: Pick<TradeApiModel, "setup">) {
  return trade.setup?.trim() || NO_SETUP;
}

export function setupOptionsFromTrades(trades: TradeApiModel[]) {
  const options = new Set<string>();
  for (const trade of trades) options.add(setupName(trade));

  return [...options].sort((a, b) => {
    if (a === NO_SETUP) return 1;
    if (b === NO_SETUP) return -1;
    return a.localeCompare(b);
  });
}

export function filterTradesBySetup(
  trades: TradeApiModel[],
  selectedSetup: string,
) {
  if (selectedSetup === ALL_SETUPS) return trades;
  return trades.filter((trade) => setupName(trade) === selectedSetup);
}

function marketMinutes(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? NaN);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? NaN);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

type TimeBucket = {
  key: string;
  label: string;
  order: number;
};

function timeBucket(openedAt: string): TimeBucket {
  const minutes = marketMinutes(openedAt);
  if (minutes == null) return { key: "UNKNOWN", label: "Unknown", order: 99 };
  if (minutes < 570) return { key: "PRE", label: "Before 09:30 ET", order: 0 };
  if (minutes < 600) return { key: "OPEN", label: "09:30–10:00 ET", order: 1 };
  if (minutes < 690) return { key: "MORNING", label: "10:00–11:30 ET", order: 2 };
  if (minutes < 840) return { key: "MIDDAY", label: "11:30–14:00 ET", order: 3 };
  if (minutes < 960) return { key: "AFTERNOON", label: "14:00–16:00 ET", order: 4 };
  return { key: "AFTER", label: "After 16:00 ET", order: 5 };
}

function calculateRow(
  key: string,
  label: string,
  trades: TradeApiModel[],
): JournalBreakdownRow {
  const closed = trades.filter((trade) => trade.status === "CLOSED");
  const wins = closed.filter((trade) => trade.outcome === "WIN").length;
  const losses = closed.filter((trade) => trade.outcome === "LOSS").length;
  const breakeven = closed.filter((trade) => trade.outcome === "BREAKEVEN").length;
  const pnls = closed.map((trade) => trade.netPnl ?? 0);
  const netPnl = round(pnls.reduce((sum, value) => sum + value, 0));
  const grossProfit = pnls.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const grossLoss = Math.abs(
    pnls.filter((value) => value < 0).reduce((sum, value) => sum + value, 0),
  );
  const rValues = closed
    .map((trade) => trade.rMultiple)
    .filter((value): value is number => value != null);

  return {
    key,
    label,
    trades: closed.length,
    wins,
    losses,
    breakeven,
    winRate: wins + losses > 0 ? round((wins / (wins + losses)) * 100, 1) : null,
    netPnl,
    averagePnl: closed.length > 0 ? round(netPnl / closed.length) : null,
    averageR:
      rValues.length > 0
        ? round(rValues.reduce((sum, value) => sum + value, 0) / rValues.length, 3)
        : null,
    profitFactor:
      grossLoss > 0
        ? round(grossProfit / grossLoss, 2)
        : grossProfit > 0
          ? Infinity
          : null,
  };
}

export function calculateSetupTimeOfDayBreakdown(trades: TradeApiModel[]) {
  const groups = new Map<string, { bucket: TimeBucket; trades: TradeApiModel[] }>();

  for (const trade of trades) {
    if (trade.status !== "CLOSED") continue;
    const bucket = timeBucket(trade.openedAt);
    const group = groups.get(bucket.key) ?? { bucket, trades: [] };
    group.trades.push(trade);
    groups.set(bucket.key, group);
  }

  return [...groups.values()]
    .sort((a, b) => a.bucket.order - b.bucket.order)
    .map(({ bucket, trades: bucketTrades }) =>
      calculateRow(bucket.key, bucket.label, bucketTrades),
    );
}
