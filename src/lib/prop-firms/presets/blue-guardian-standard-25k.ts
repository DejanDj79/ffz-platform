import type { PropFirmRulePreset } from "../types";

/**
 * Blue Guardian Futures — Standard 25K
 * Verified against Blue Guardian's Futures Help Center on 2026-09-01.
 *
 * IMPORTANT: recent official copies have shown conflicting 25K max-drawdown
 * values. The preset keeps $1,500 for continuity and leaves the field editable.
 * What is clear in the detailed rule text is that the EOD trailing floor locks
 * at starting balance before payouts; the starting balance + $100 floor is a
 * separate funded post-payout rule.
 */
export const BLUE_GUARDIAN_FUTURES_STANDARD_25K: PropFirmRulePreset = {
  id: "BLUE_GUARDIAN_FUTURES_STANDARD_25K",
  label: "Blue Guardian Futures — Standard 25K",
  propFirm: "Blue Guardian Futures",
  program: "Standard",

  accountSize: 25_000,
  startingBalance: 25_000,
  profitTarget: 1_500,

  maxDrawdown: 1_500,
  drawdownMode: "EOD_TRAILING",
  // During evaluation the EOD trailing floor stops at the starting balance.
  drawdownLockFloorOffset: 0,
  // After a funded payout Blue Guardian publishes a starting balance + $100 floor.
  postPayoutDrawdownLockFloorOffset: 100,

  dailyLossLimit: null,
  dailyLossBreachType: "NONE",
  minimumTradingDays: 0,

  maxMinis: 1,
  maxMicros: 10,

  evaluationConsistencyPct: null,
  fundedConsistencyPct: 40,

  newsTradingAllowed: true,
  microscalpingUnderSeconds: 10,
  microscalpingMaxProfitSharePct: 50,

  profitSplitPct: 90,
  payoutEligibleAfterTradingDays: 3,
  firstPayoutCap: 1_500,
  laterPayoutCap: 2_000,
  fundedBuffer: 1_600,

  resetFee: 104,
  reactivationFee: 450,
  monthlyFee: 0,
  activationFee: 0,

  verifiedAt: "2026-09-01",
  sourceUrl: "https://helpfutures.blueguardian.com/en/articles/15654479-standard-account-rules",
  reviewNote:
    "Blue Guardian's official material has shown conflicting 25K max-drawdown values across recent versions. This preset keeps $1,500 for now, but the field remains editable and MUST be checked against the exact rule shown on the purchased account. During evaluation the EOD trail locks at starting balance; the +$100 floor applies after a funded payout.",
};
