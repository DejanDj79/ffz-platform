import type { JournalInstrument, TradeApiModel } from "./types";

export type TradeReviewInstrumentFilter = "ALL" | JournalInstrument;

export function selectTradeReviewTrades(
  trades: TradeApiModel[],
  instrument: TradeReviewInstrumentFilter = "ALL",
) {
  return trades
    .filter(
      (trade) =>
        trade.status === "CLOSED" &&
        (instrument === "ALL" || trade.instrument === instrument),
    )
    .sort(
      (a, b) =>
        new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime(),
    );
}

export function tradeDurationMs(trade: TradeApiModel) {
  if (!trade.closedAt) return null;

  const opened = new Date(trade.openedAt).getTime();
  const closed = new Date(trade.closedAt).getTime();

  if (!Number.isFinite(opened) || !Number.isFinite(closed) || closed < opened) {
    return null;
  }

  return closed - opened;
}
