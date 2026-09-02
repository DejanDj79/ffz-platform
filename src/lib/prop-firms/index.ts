import {
  BLUE_GUARDIAN_FUTURES_STANDARD_25K,
  TOPSTEP_TRADING_COMBINE_STANDARD_50K,
  TOPSTEP_TRADING_COMBINE_STANDARD_100K,
  TOPSTEP_TRADING_COMBINE_STANDARD_150K,
  TRADEIFY_SELECT_25K,
  TRADEIFY_SELECT_50K,
  TRADEIFY_SELECT_100K,
  TRADEIFY_SELECT_150K,
} from "./presets";
import type { PropFirmPresetId, PropFirmRulePreset } from "./types";

export const PROP_FIRM_PRESETS: PropFirmRulePreset[] = [
  TOPSTEP_TRADING_COMBINE_STANDARD_50K,
  TOPSTEP_TRADING_COMBINE_STANDARD_100K,
  TOPSTEP_TRADING_COMBINE_STANDARD_150K,
  TRADEIFY_SELECT_25K,
  TRADEIFY_SELECT_50K,
  TRADEIFY_SELECT_100K,
  TRADEIFY_SELECT_150K,
  BLUE_GUARDIAN_FUTURES_STANDARD_25K,
];

export function getPropFirmPreset(id?: PropFirmPresetId | string | null) {
  if (!id || id === "CUSTOM") return null;
  return PROP_FIRM_PRESETS.find((preset) => preset.id === id) ?? null;
}

export {
  NO_DRAWDOWN_LOCK,
} from "./types";

export type {
  PropFirmPresetId,
  PropFirmRulePreset,
  DrawdownMode,
  BreachType,
  PayoutEligibilityMode,
  EvaluationBillingMode,
} from "./types";
