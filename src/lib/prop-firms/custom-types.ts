import type { BreachType, DrawdownMode } from "./types";
import type { Challenge } from "@/lib/challenges/types";

export const CUSTOM_PRESET_PREFIX = "CUSTOM_PRESET";

export type CustomRuleVariant = {
  id: string;
  label: string;
  accountSize: number;
  startingBalance: number;
  profitTarget: number;
  maxDrawdown: number;
  drawdownMode: DrawdownMode;
  drawdownLockFloorOffset: number;
  dailyLossLimit: number | null;
  dailyLossBreachType: BreachType;
  minimumTradingDays: number;
  maxMinis: number | null;
  maxMicros: number | null;
  evaluationFee: number;
  resetFee: number | null;
};

export type CustomRulePreset = {
  id: string;
  name: string;
  propFirm: string;
  variants: CustomRuleVariant[];
  createdAt: string;
  updatedAt: string;
};

export type CustomRulePresetInput = Pick<CustomRulePreset, "name" | "propFirm" | "variants">;

export function customPresetRef(presetId: string, variantId: string) {
  return `${CUSTOM_PRESET_PREFIX}:${presetId}:${variantId}`;
}

export function parseCustomPresetRef(value?: string | null) {
  if (!value?.startsWith(`${CUSTOM_PRESET_PREFIX}:`)) return null;
  const [, presetId, variantId] = value.split(":");
  return presetId && variantId ? { presetId, variantId } : null;
}

export function challengeToCustomRuleVariant(challenge: Challenge): CustomRuleVariant {
  return {
    id: crypto.randomUUID(),
    label: challenge.accountSize >= 1000 && challenge.accountSize % 1000 === 0
      ? `${challenge.accountSize / 1000}K`
      : String(challenge.accountSize),
    accountSize: challenge.accountSize,
    startingBalance: challenge.startingBalance,
    profitTarget: challenge.profitTarget,
    maxDrawdown: challenge.maxDrawdown,
    drawdownMode: challenge.drawdownMode ?? "STATIC",
    drawdownLockFloorOffset: challenge.drawdownLockFloorOffset ?? 0,
    dailyLossLimit: challenge.dailyLossLimit > 0 ? challenge.dailyLossLimit : null,
    dailyLossBreachType: challenge.dailyLossBreachType ?? "HARD",
    minimumTradingDays: challenge.minimumTradingDays,
    maxMinis: challenge.maxMinis ?? null,
    maxMicros: challenge.maxMicros ?? null,
    evaluationFee: challenge.challengeFee,
    resetFee: challenge.resetFee > 0 ? challenge.resetFee : null,
  };
}

export function applyCustomVariantToChallenge(
  challenge: Challenge,
  preset: CustomRulePreset,
  variant: CustomRuleVariant,
): Challenge {
  return {
    ...challenge,
    rulesPresetId: customPresetRef(preset.id, variant.id),
    propFirm: preset.propFirm,
    name: challenge.name.trim() ? challenge.name : `${preset.name} ${variant.label} #1`,
    accountSize: variant.accountSize,
    startingBalance: variant.startingBalance,
    currentBalance: variant.startingBalance,
    highestEodBalance: variant.startingBalance,
    profitTarget: variant.profitTarget,
    maxDrawdown: variant.maxDrawdown,
    drawdownMode: variant.drawdownMode,
    drawdownLockFloorOffset: variant.drawdownLockFloorOffset,
    dailyLossLimit: variant.dailyLossLimit ?? 0,
    dailyLossBreachType: variant.dailyLossBreachType,
    minimumTradingDays: variant.minimumTradingDays,
    maxMinis: variant.maxMinis,
    maxMicros: variant.maxMicros,
    challengeFee: variant.evaluationFee,
    resetFee: variant.resetFee ?? 0,
    phase: "EVALUATION",
  };
}
