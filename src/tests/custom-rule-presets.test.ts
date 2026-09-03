import { describe, expect, it } from "vitest";
import { createBlankChallenge } from "@/lib/challenges/defaults";
import {
  applyCustomVariantToChallenge,
  challengeToCustomRuleVariant,
  customPresetRef,
  parseCustomPresetRef,
} from "@/lib/prop-firms/custom-types";
import type { CustomRulePreset } from "@/lib/prop-firms/custom-types";

describe("custom rule presets", () => {
  it("round-trips custom preset references", () => {
    const value = customPresetRef(
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    );
    expect(parseCustomPresetRef(value)).toEqual({
      presetId: "11111111-1111-4111-8111-111111111111",
      variantId: "22222222-2222-4222-8222-222222222222",
    });
    expect(parseCustomPresetRef("TOPSTEP_50K")).toBeNull();
  });

  it("copies editable challenge rules into a reusable variant", () => {
    const challenge = {
      ...createBlankChallenge(),
      propFirm: "My Firm",
      accountSize: 25000,
      startingBalance: 25000,
      profitTarget: 1500,
      maxDrawdown: 1000,
      dailyLossLimit: 500,
      maxMinis: 2,
      maxMicros: 20,
      challengeFee: 79,
      resetFee: 49,
    };
    const variant = challengeToCustomRuleVariant(challenge);
    expect(variant.label).toBe("25K");
    expect(variant.profitTarget).toBe(1500);
    expect(variant.maxMinis).toBe(2);
    expect(variant.evaluationFee).toBe(79);
  });

  it("applies a selected custom size to a fresh challenge", () => {
    const base = createBlankChallenge();
    const variant = challengeToCustomRuleVariant({
      ...base,
      propFirm: "Custom Futures",
      accountSize: 100000,
      startingBalance: 100000,
      profitTarget: 6000,
      maxDrawdown: 3000,
      maxMinis: 8,
      maxMicros: 80,
    });
    const preset: CustomRulePreset = {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Custom Futures Rules",
      propFirm: "Custom Futures",
      variants: [variant],
      createdAt: "2026-09-03T00:00:00.000Z",
      updatedAt: "2026-09-03T00:00:00.000Z",
    };

    const result = applyCustomVariantToChallenge(base, preset, variant);
    expect(result.accountSize).toBe(100000);
    expect(result.profitTarget).toBe(6000);
    expect(result.maxMicros).toBe(80);
    expect(result.rulesPresetId).toBe(customPresetRef(preset.id, variant.id));
  });
});
