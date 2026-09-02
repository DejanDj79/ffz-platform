import type { TradeApiModel } from "./types";

export const PLANNED_TRADE_TAG = "__FFZ_PLANNED__";

export function isPlannedTrade(trade: Pick<TradeApiModel, "tags">) {
  return trade.tags.includes(PLANNED_TRADE_TAG);
}

export function withoutPlannedTradeTag(tags: string[]) {
  return tags.filter((tag) => tag !== PLANNED_TRADE_TAG);
}
