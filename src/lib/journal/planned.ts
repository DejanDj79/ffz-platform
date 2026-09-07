import type { TradeApiModel } from "./types";

export const PLANNED_TRADE_TAG = "__FFZ_PLANNED__";
export const STARTED_FROM_PLAN_TAG = "FFZ:planned";

export function isPlannedTrade(trade: Pick<TradeApiModel, "tags">) {
  return trade.tags.includes(PLANNED_TRADE_TAG);
}

export function withoutPlannedTradeTag(tags: string[]) {
  return tags.filter((tag) => tag !== PLANNED_TRADE_TAG);
}
