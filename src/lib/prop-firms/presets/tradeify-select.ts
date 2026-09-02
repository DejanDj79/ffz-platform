import { NO_DRAWDOWN_LOCK } from "../types";
import type { PropFirmRulePreset } from "../types";

type TradeifySelectConfig = {
  id: PropFirmRulePreset["id"];
  accountSize: number;
  profitTarget: number;
  maxDrawdown: number;
  maxMinis: number;
  maxMicros: number;
  evaluationFee: number;
  resetFee: number;
  flexPayoutCap: number;
};

function tradeifySelect(config: TradeifySelectConfig): PropFirmRulePreset {
  const sizeLabel = `${config.accountSize / 1000}K`;

  return {
    id: config.id,
    label: `Tradeify — Select ${sizeLabel}`,
    propFirm: "Tradeify",
    program: "Select Evaluation",

    accountSize: config.accountSize,
    startingBalance: config.accountSize,
    profitTarget: config.profitTarget,

    maxDrawdown: config.maxDrawdown,
    drawdownMode: "EOD_TRAILING",
    // Tradeify explicitly states that Evaluation accounts do not lock the
    // trailing drawdown. The floor may continue above starting balance.
    drawdownLockFloorOffset: NO_DRAWDOWN_LOCK,
    // Once funded, Select Flex/Daily can lock the floor at +$100.
    postPayoutDrawdownLockFloorOffset: 100,

    dailyLossLimit: null,
    dailyLossBreachType: "NONE",
    minimumTradingDays: 3,

    maxMinis: config.maxMinis,
    maxMicros: config.maxMicros,

    evaluationConsistencyPct: 40,
    fundedConsistencyPct: null,

    newsTradingAllowed: true,
    microscalpingUnderSeconds: null,
    microscalpingMaxProfitSharePct: null,

    profitSplitPct: 90,
    // The funded payout policy is chosen only after passing (Flex or Daily).
    payoutEligibleAfterTradingDays: null,
    firstPayoutCap: config.flexPayoutCap,
    laterPayoutCap: config.flexPayoutCap,
    fundedBuffer: null,

    evaluationFee: config.evaluationFee,
    evaluationBillingMode: "ONE_TIME",
    resetFee: config.resetFee,
    reactivationFee: null,
    monthlyFee: 0,
    activationFee: 0,

    verifiedAt: "2026-09-03",
    sourceUrl: "https://help.tradeify.co/en/articles/12853921-select-evaluation-accounts",
    reviewNote:
      `Select ${sizeLabel} is a one-time ${config.evaluationFee} evaluation with a ${config.resetFee} reset fee. ` +
      "Evaluation uses a 40% consistency rule, no Daily Loss Limit, and an EOD trailing drawdown that does NOT lock during evaluation. " +
      "After passing, the trader permanently chooses Select Flex or Select Daily. This preset shows the current post-Sep-1 Flex payout cap as a reference, but funded DLL/buffer/payout behavior depends on that later choice.",
  };
}

export const TRADEIFY_SELECT_25K = tradeifySelect({
  id: "TRADEIFY_SELECT_25K",
  accountSize: 25_000,
  profitTarget: 1_500,
  maxDrawdown: 1_000,
  maxMinis: 1,
  maxMicros: 10,
  evaluationFee: 109,
  resetFee: 60,
  flexPayoutCap: 1_250,
});

export const TRADEIFY_SELECT_50K = tradeifySelect({
  id: "TRADEIFY_SELECT_50K",
  accountSize: 50_000,
  profitTarget: 3_000,
  maxDrawdown: 2_000,
  maxMinis: 4,
  maxMicros: 40,
  evaluationFee: 165,
  resetFee: 109,
  flexPayoutCap: 2_500,
});

export const TRADEIFY_SELECT_100K = tradeifySelect({
  id: "TRADEIFY_SELECT_100K",
  accountSize: 100_000,
  profitTarget: 6_000,
  maxDrawdown: 3_000,
  maxMinis: 8,
  maxMicros: 80,
  evaluationFee: 265,
  resetFee: 169,
  flexPayoutCap: 3_500,
});

export const TRADEIFY_SELECT_150K = tradeifySelect({
  id: "TRADEIFY_SELECT_150K",
  accountSize: 150_000,
  profitTarget: 9_000,
  maxDrawdown: 4_500,
  maxMinis: 12,
  maxMicros: 120,
  evaluationFee: 369,
  resetFee: 239,
  flexPayoutCap: 4_500,
});
