import { BLUE_GUARDIAN_FUTURES_STANDARD_25K } from "./presets";
import type { PropFirmPresetId, PropFirmRulePreset } from "./types";

export const PROP_FIRM_PRESETS: PropFirmRulePreset[] = [
  BLUE_GUARDIAN_FUTURES_STANDARD_25K,
];

export function getPropFirmPreset(id?: PropFirmPresetId | string | null) {
  if (!id || id === "CUSTOM") return null;
  return PROP_FIRM_PRESETS.find((preset) => preset.id === id) ?? null;
}

export type { PropFirmPresetId, PropFirmRulePreset, DrawdownMode, BreachType } from "./types";
