type ChallengeLike = {
  id: string;
  name: string;
  propFirm: string;
  status: string;
  phase: string;
  startingBalance: number;
  currentBalance: number;
  profitTarget: number;
};

const STATUS_PRIORITY = [
  "IN_PROGRESS",
  "ACTIVE",
  "FUNDED",
  "NOT_STARTED",
  "PAUSED",
  "PASSED",
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function selectScoreboardChallenge<T extends ChallengeLike>(
  challenges: T[],
  selectedId: string | null,
): T | null {
  if (selectedId) {
    const selected = challenges.find(
      (challenge) => challenge.id === selectedId,
    );

    if (selected) return selected;
  }

  for (const status of STATUS_PRIORITY) {
    const match = challenges.find(
      (challenge) => challenge.status === status,
    );

    if (match) return match;
  }

  return challenges[0] ?? null;
}

export function calculateScoreboardChallenge(
  challenge: ChallengeLike | null,
) {
  if (!challenge) return null;

  const pnl = challenge.currentBalance - challenge.startingBalance;
  const targetRemaining = Math.max(
    0,
    challenge.profitTarget - pnl,
  );

  const targetProgressPct =
    challenge.profitTarget > 0
      ? clamp((pnl / challenge.profitTarget) * 100, 0, 100)
      : 0;

  return {
    id: challenge.id,
    name: challenge.name,
    propFirm: challenge.propFirm,
    status: challenge.status,
    phase: challenge.phase,
    startingBalance: challenge.startingBalance,
    currentBalance: challenge.currentBalance,
    pnl,
    profitTarget: challenge.profitTarget,
    targetRemaining,
    targetProgressPct,
  };
}
