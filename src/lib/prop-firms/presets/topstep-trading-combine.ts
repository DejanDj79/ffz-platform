import type { PropFirmRulePreset } from "../types";

type TopstepPresetConfig = {
  id: PropFirmRulePreset["id"];
  accountSize: number;
  profitTarget: number;
  maxDrawdown: number;
  maxMinis: number;
  maxMicros: number;
  monthlyFee: number;
  resetFee: number;
  reactivationFee: number;
};

function topstepTradingCombine(config: TopstepPresetConfig): PropFirmRulePreset {
  const sizeLabel = `${config.accountSize / 1000}K`;

  return {
    id: config.id,
    label: `Topstep — Trading Combine ${sizeLabel}`,
    propFirm: "Topstep",
    program: "Trading Combine · Standard billing",

    accountSize: config.accountSize,
    startingBalance: config.accountSize,
    profitTarget: config.profitTarget,

    maxDrawdown: config.maxDrawdown,
    drawdownMode: "EOD_TRAILING",
    // Topstep's MLL trails on EOD balance and stops once the floor reaches starting balance.
    drawdownLockFloorOffset: 0,
    postPayoutDrawdownLockFloorOffset: null,

    // DLL is optional at checkout, so the base preset intentionally leaves it disabled.
    dailyLossLimit: null,
    dailyLossBreachType: "NONE",
    minimumTradingDays: 0,

    maxMinis: config.maxMinis,
    maxMicros: config.maxMicros,

    evaluationConsistencyPct: 50,
    // XFA payout path is chosen after passing: Standard has no consistency target,
    // while Consistency uses a 40% target.
    fundedConsistencyPct: null,

    newsTradingAllowed: true,
    microscalpingUnderSeconds: null,
    microscalpingMaxProfitSharePct: null,

    profitSplitPct: 90,
    payoutEligibleAfterTradingDays: null,
    firstPayoutCap: null,
    laterPayoutCap: null,
    fundedBuffer: null,

    evaluationFee: config.monthlyFee,
    evaluationBillingMode: "MONTHLY",
    resetFee: config.resetFee,
    reactivationFee: config.reactivationFee,
    monthlyFee: config.monthlyFee,
    activationFee: 149,

    verifiedAt: "2026-09-03",
    sourceUrl: "https://www.topstep.com/topstep-prop",
    reviewNote:
      `Standard billing is ${config.monthlyFee}/month with a ${config.resetFee} reset and $149 XFA activation fee. ` +
      "Topstep also sells a higher-priced No Activation Fee path. The Daily Loss Limit is optional at checkout and is therefore not enabled in this base preset. " +
      "After passing, the trader chooses an XFA payout path (Standard or Consistency), so funded payout-day and cap fields are intentionally left unset here. " +
      "News trading is allowed, but Topstep prohibits intentionally taking maximum position size directly into scheduled major news.",
  };
}

export const TOPSTEP_TRADING_COMBINE_STANDARD_50K = topstepTradingCombine({
  id: "TOPSTEP_TRADING_COMBINE_STANDARD_50K",
  accountSize: 50_000,
  profitTarget: 3_000,
  maxDrawdown: 2_000,
  maxMinis: 5,
  maxMicros: 50,
  monthlyFee: 49,
  resetFee: 49,
  reactivationFee: 599,
});

export const TOPSTEP_TRADING_COMBINE_STANDARD_100K = topstepTradingCombine({
  id: "TOPSTEP_TRADING_COMBINE_STANDARD_100K",
  accountSize: 100_000,
  profitTarget: 6_000,
  maxDrawdown: 3_000,
  maxMinis: 10,
  maxMicros: 100,
  monthlyFee: 99,
  resetFee: 99,
  reactivationFee: 699,
});

export const TOPSTEP_TRADING_COMBINE_STANDARD_150K = topstepTradingCombine({
  id: "TOPSTEP_TRADING_COMBINE_STANDARD_150K",
  accountSize: 150_000,
  profitTarget: 9_000,
  maxDrawdown: 4_500,
  maxMinis: 15,
  maxMicros: 150,
  monthlyFee: 199,
  resetFee: 199,
  reactivationFee: 829,
});
