import { getPropFirmPreset } from "@/lib/prop-firms";
import type { Challenge } from "./types";

export function createBlankChallenge(): Challenge {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    propFirm: "",
    name: "",
    accountSize: 50000,
    startingBalance: 50000,
    profitTarget: 3000,
    maxDrawdown: 2000,
    dailyLossLimit: 1000,
    challengeFee: 0,
    resetFee: 0,
    resetsUsed: 0,
    minimumTradingDays: 0,
    currentBalance: 50000,
    todayPnl: 0,
    daysTraded: 0,
    status: "NOT_STARTED",
    phase: "EVALUATION",
    notes: "",
    createdAt: now,
    updatedAt: now,
    rulesPresetId: "CUSTOM",
    drawdownMode: "STATIC",
    highestEodBalance: 50000,
    drawdownLockFloorOffset: 0,
    dailyLossBreachType: "HARD",
    maxMinis: null,
    maxMicros: null,
  };
}

export function applyPresetToChallenge(challenge: Challenge, presetId: Challenge["rulesPresetId"]): Challenge {
  const preset = getPropFirmPreset(presetId);
  if (!preset) {
    return {
      ...challenge,
      rulesPresetId: "CUSTOM",
    };
  }

  return {
    ...challenge,
    rulesPresetId: preset.id,
    propFirm: preset.propFirm,
    name: challenge.name.trim() ? challenge.name : `${preset.program} ${preset.accountSize / 1000}K #1`,
    accountSize: preset.accountSize,
    startingBalance: preset.startingBalance,
    currentBalance: preset.startingBalance,
    highestEodBalance: preset.startingBalance,
    profitTarget: preset.profitTarget,
    maxDrawdown: preset.maxDrawdown,
    drawdownMode: preset.drawdownMode,
    drawdownLockFloorOffset: preset.drawdownLockFloorOffset,
    dailyLossLimit: preset.dailyLossLimit ?? 0,
    dailyLossBreachType: preset.dailyLossBreachType,
    minimumTradingDays: preset.minimumTradingDays,
    maxMinis: preset.maxMinis,
    maxMicros: preset.maxMicros,
    resetFee: preset.resetFee ?? challenge.resetFee,
    phase: "EVALUATION",
  };
}

export function normalizeChallenge(input: Partial<Challenge>): Challenge {
  const base = createBlankChallenge();
  const merged: Challenge = {
    ...base,
    ...input,
    id: input.id ?? base.id,
    createdAt: input.createdAt ?? base.createdAt,
    updatedAt: input.updatedAt ?? base.updatedAt,
  };

  if (input.rulesPresetId && input.rulesPresetId !== "CUSTOM") {
    const preset = getPropFirmPreset(input.rulesPresetId);
    if (preset) {
      // Keep user-entered balances/fees while backfilling missing rule metadata.
      merged.drawdownMode = input.drawdownMode ?? preset.drawdownMode;
      merged.drawdownLockFloorOffset = input.drawdownLockFloorOffset ?? preset.drawdownLockFloorOffset;
      merged.dailyLossBreachType = input.dailyLossBreachType ?? preset.dailyLossBreachType;
      merged.maxMinis = input.maxMinis ?? preset.maxMinis;
      merged.maxMicros = input.maxMicros ?? preset.maxMicros;

      // Sprint 2.1 migration: the first BG 25K preset incorrectly applied
      // the post-payout +$100 floor during evaluation. Evaluation should lock
      // at starting balance (offset 0). Keep non-evaluation values untouched
      // so a future funded/payout workflow can intentionally set +$100.
      if (
        input.rulesPresetId === "BLUE_GUARDIAN_FUTURES_STANDARD_25K" &&
        (input.phase ?? merged.phase) === "EVALUATION" &&
        input.drawdownLockFloorOffset === 100
      ) {
        merged.drawdownLockFloorOffset = 0;
      }
    }
  }

  merged.highestEodBalance = Math.max(
    merged.startingBalance,
    input.highestEodBalance ?? merged.startingBalance,
  );

  return merged;
}

export function createDemoChallenges(): Challenge[] {
  const now = new Date().toISOString();
  const preset = getPropFirmPreset("BLUE_GUARDIAN_FUTURES_STANDARD_25K");

  if (!preset) return [];

  return [
    {
      id: "demo-blue-guardian-standard-25k",
      propFirm: preset.propFirm,
      name: "Standard 25K #1",
      accountSize: preset.accountSize,
      startingBalance: preset.startingBalance,
      profitTarget: preset.profitTarget,
      maxDrawdown: preset.maxDrawdown,
      dailyLossLimit: preset.dailyLossLimit ?? 0,
      challengeFee: 0,
      resetFee: preset.resetFee ?? 0,
      resetsUsed: 0,
      minimumTradingDays: preset.minimumTradingDays,
      currentBalance: preset.startingBalance,
      todayPnl: 0,
      daysTraded: 0,
      status: "NOT_STARTED",
      phase: "EVALUATION",
      notes: "Verify the exact 25K drawdown shown on your purchased Blue Guardian account before trading.",
      createdAt: now,
      updatedAt: now,
      rulesPresetId: preset.id,
      drawdownMode: preset.drawdownMode,
      highestEodBalance: preset.startingBalance,
      drawdownLockFloorOffset: preset.drawdownLockFloorOffset,
      dailyLossBreachType: preset.dailyLossBreachType,
      maxMinis: preset.maxMinis,
      maxMicros: preset.maxMicros,
    },
  ];
}
