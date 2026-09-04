import type { TradeApiModel, UpdateTradeInput } from "./types";

export const PLANNED_TRADE_TAG = "__FFZ_PLANNED__";
export const STARTED_FROM_PLAN_TAG = "FFZ:planned";

export function isPlannedTrade(trade: Pick<TradeApiModel, "tags">) {
  return trade.tags.includes(PLANNED_TRADE_TAG);
}

export function withoutPlannedTradeTag(tags: string[]) {
  return tags.filter((tag) => tag !== PLANNED_TRADE_TAG);
}

export function buildStartedTradeUpdate(
  plan: TradeApiModel,
  openedAt: string,
  startedNote: string,
): UpdateTradeInput {
  return {
    challengeId: plan.challengeId,
    tradingAccountId: plan.tradingAccountId,
    instrument: plan.instrument,
    direction: plan.direction,
    openedAt,
    closedAt: null,
    entryPrice: plan.entryPrice,
    stopPrice: plan.stopPrice,
    targetPrice: plan.targetPrice,
    exitPrice: null,
    contracts: plan.contracts,
    commissionFees: plan.commissionFees,
    setup: plan.setup,
    tags: [...new Set([
      ...withoutPlannedTradeTag(plan.tags),
      STARTED_FROM_PLAN_TAG,
    ])],
    notes: [plan.notes, startedNote].filter(Boolean).join("\n\n"),
  };
}
