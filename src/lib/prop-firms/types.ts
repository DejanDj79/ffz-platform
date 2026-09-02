export type PropFirmPresetId =
  | "CUSTOM"
  | "BLUE_GUARDIAN_FUTURES_STANDARD_25K";

export type DrawdownMode = "STATIC" | "EOD_TRAILING" | "INTRADAY_TRAILING";
export type BreachType = "NONE" | "SOFT" | "HARD";
export type PayoutEligibilityMode =
  | "TRADING_DAYS"
  | "CALENDAR_DAYS_AFTER_FIRST_TRADE";

export interface PropFirmRulePreset {
  id: Exclude<PropFirmPresetId, "CUSTOM">;
  label: string;
  propFirm: string;
  program: string;

  accountSize: number;
  startingBalance: number;
  profitTarget: number;

  maxDrawdown: number;
  drawdownMode: DrawdownMode;
  /**
   * Highest floor the trailing drawdown may reach in the current challenge
   * state, expressed as an offset from startingBalance. For Blue Guardian
   * Standard evaluation this is 0: the EOD trail stops at starting balance.
   */
  drawdownLockFloorOffset: number;

  /**
   * Offset to use after a funded payout when the firm's payout rules move the
   * permanent drawdown floor. This is metadata for the payout/ledger workflow;
   * it is NOT applied during evaluation.
   */
  postPayoutDrawdownLockFloorOffset?: number | null;

  dailyLossLimit: number | null;
  dailyLossBreachType: BreachType;
  minimumTradingDays: number;

  maxMinis: number | null;
  maxMicros: number | null;

  evaluationConsistencyPct: number | null;
  fundedConsistencyPct: number | null;

  newsTradingAllowed: boolean;
  microscalpingUnderSeconds: number | null;
  microscalpingMaxProfitSharePct: number | null;

  profitSplitPct: number | null;
  payoutEligibleAfterTradingDays: number | null;
  /**
   * Some firms mean N distinct trading days; others mean N calendar days after
   * the first trade in a payout cycle. Keep the numeric field above for preset
   * compatibility and make the interpretation explicit here.
   */
  payoutEligibilityMode?: PayoutEligibilityMode;
  firstPayoutCap: number | null;
  laterPayoutCap: number | null;
  fundedBuffer: number | null;

  resetFee: number | null;
  reactivationFee: number | null;
  monthlyFee: number | null;
  activationFee: number | null;

  verifiedAt: string;
  sourceUrl: string;
  reviewNote?: string;
}
