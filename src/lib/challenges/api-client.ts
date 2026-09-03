"use client";

import type { Challenge } from "./types";
import type {
  ChallengeApiModel,
  CreateChallengeApiInput,
  UpdateChallengeApiInput,
} from "./api-types";
import { normalizeChallenge } from "./defaults";

const LEGACY_STORAGE_KEY = "ffz-challenges-v1";
const MIGRATION_FLAG_KEY = "ffz-challenges-api-migrated-v1";

async function assertOk(response: Response) {
  if (response.ok) return;

  const json = await response.json().catch(() => null) as {
    error?: string;
    upgradeUrl?: string;
  } | null;

  if (json?.upgradeUrl && typeof window !== "undefined") {
    window.location.assign(json.upgradeUrl);
  }

  throw new Error(
    json?.error ?? `Challenge API request failed (${response.status}).`,
  );
}

export function apiModelToChallenge(input: ChallengeApiModel): Challenge {
  return normalizeChallenge({
    id: input.id,
    rulesPresetId: (input.rulesPresetId ?? "CUSTOM") as Challenge["rulesPresetId"],
    propFirm: input.propFirm,
    name: input.name,
    status: input.status === "ACTIVE" ? "IN_PROGRESS" : input.status as Challenge["status"],
    phase: input.phase as Challenge["phase"],
    drawdownMode: input.drawdownType,
    dailyLossBreachType: input.dailyLossBreachType,

    accountSize: input.accountSize,
    startingBalance: input.startingBalance,
    currentBalance: input.currentBalance,
    highestEodBalance: input.highestEodBalance,
    todayPnl: input.todayPnl,

    profitTarget: input.profitTarget,
    maxDrawdown: input.maxDrawdown,
    drawdownLockFloorOffset: input.drawdownLockFloorOffset,
    dailyLossLimit: input.dailyLossLimit ?? 0,

    challengeFee: input.challengeFee,
    resetFee: input.resetFee ?? 0,
    resetsUsed: input.resetCount,
    maxMinis: input.maxMiniContracts,
    maxMicros: input.maxMicroContracts,
    minimumTradingDays: input.minimumTradingDays ?? 0,
    daysTraded: input.daysTraded,
    notes: input.notes ?? "",
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  });
}

export function challengeToApiInput(challenge: Challenge): CreateChallengeApiInput {
  const drawdownLockFloorOffset = challenge.drawdownLockFloorOffset ?? 0;

  return {
    rulesPresetId: challenge.rulesPresetId ?? "CUSTOM",
    propFirm: challenge.propFirm.trim() || "Custom Prop Firm",
    name: challenge.name.trim() || "Untitled Challenge",
    status: challenge.status,
    phase: challenge.phase,
    drawdownType: challenge.drawdownMode ?? "STATIC",
    dailyLossBreachType: challenge.dailyLossBreachType ?? "HARD",

    accountSize: Math.max(0, challenge.accountSize),
    startingBalance: Math.max(0, challenge.startingBalance),
    currentBalance: Math.max(0, challenge.currentBalance),
    highestEodBalance: Math.max(challenge.startingBalance, challenge.highestEodBalance ?? challenge.startingBalance),
    todayPnl: challenge.todayPnl,

    profitTarget: Math.max(0, challenge.profitTarget),
    maxDrawdown: Math.max(0, challenge.maxDrawdown),
    drawdownLockFloorOffset: drawdownLockFloorOffset < 0 ? -1 : Math.max(0, drawdownLockFloorOffset),
    dailyLossLimit: challenge.dailyLossLimit > 0 ? challenge.dailyLossLimit : null,

    challengeFee: Math.max(0, challenge.challengeFee),
    resetFee: challenge.resetFee > 0 ? challenge.resetFee : null,
    resetCount: Math.max(0, Math.floor(challenge.resetsUsed)),
    maxMiniContracts: challenge.maxMinis ?? null,
    maxMicroContracts: challenge.maxMicros ?? null,
    minimumTradingDays: challenge.minimumTradingDays > 0 ? Math.floor(challenge.minimumTradingDays) : null,
    daysTraded: Math.max(0, Math.floor(challenge.daysTraded)),
    notes: challenge.notes.trim() || null,
  };
}

export async function fetchChallenges(): Promise<Challenge[]> {
  const response = await fetch("/api/challenges", { cache: "no-store" });
  await assertOk(response);
  const json = await response.json() as { data: ChallengeApiModel[] };
  return json.data.map(apiModelToChallenge);
}

export async function createChallengeViaApi(challenge: Challenge): Promise<Challenge> {
  const response = await fetch("/api/challenges", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(challengeToApiInput(challenge)),
  });
  await assertOk(response);
  const json = await response.json() as { data: ChallengeApiModel };
  return apiModelToChallenge(json.data);
}

export async function updateChallengeViaApi(challenge: Challenge): Promise<Challenge> {
  const input: UpdateChallengeApiInput = challengeToApiInput(challenge);
  const response = await fetch(`/api/challenges/${challenge.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  await assertOk(response);
  const json = await response.json() as { data: ChallengeApiModel };
  return apiModelToChallenge(json.data);
}

export async function deleteChallengeViaApi(challengeId: string): Promise<void> {
  const response = await fetch(`/api/challenges/${challengeId}`, { method: "DELETE" });
  await assertOk(response);
}

function sameChallenge(a: Challenge, b: Challenge) {
  if (a.rulesPresetId && a.rulesPresetId !== "CUSTOM" && b.rulesPresetId === a.rulesPresetId) {
    return a.name.trim().toLowerCase() === b.name.trim().toLowerCase();
  }
  return a.propFirm.trim().toLowerCase() === b.propFirm.trim().toLowerCase()
    && a.name.trim().toLowerCase() === b.name.trim().toLowerCase();
}

/**
 * One-time browser migration from the old localStorage planner.
 * The legacy key is intentionally left untouched as a backup.
 */
export async function migrateLegacyChallengesToApi(existing: Challenge[]): Promise<boolean> {
  if (window.localStorage.getItem(MIGRATION_FLAG_KEY) === "1") return false;

  const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) {
    window.localStorage.setItem(MIGRATION_FLAG_KEY, "1");
    return false;
  }

  let legacy: Challenge[];
  try {
    legacy = (JSON.parse(raw) as Partial<Challenge>[]).map(normalizeChallenge);
  } catch {
    window.localStorage.setItem(MIGRATION_FLAG_KEY, "1");
    return false;
  }

  for (const localChallenge of legacy) {
    const matching = existing.find((serverChallenge) => sameChallenge(localChallenge, serverChallenge));

    if (matching) {
      await updateChallengeViaApi({
        ...localChallenge,
        id: matching.id,
        createdAt: matching.createdAt,
      });
    } else {
      await createChallengeViaApi(localChallenge);
    }
  }

  window.localStorage.setItem(MIGRATION_FLAG_KEY, "1");
  return legacy.length > 0;
}
