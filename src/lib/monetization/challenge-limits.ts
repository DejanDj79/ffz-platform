import type { ChallengeStatus } from "@/lib/challenges/types";

const ACTIVE_CHALLENGE_STATUSES = new Set<ChallengeStatus>([
  "NOT_STARTED",
  "IN_PROGRESS",
  "PAUSED",
  "FUNDED",
]);

export function countsTowardActiveChallengeLimit(status: ChallengeStatus) {
  return ACTIVE_CHALLENGE_STATUSES.has(status);
}

export function countActiveChallenges(
  challenges: Array<{ id: string; status: ChallengeStatus }>,
  excludeId?: string,
) {
  return challenges.filter(
    (challenge) =>
      challenge.id !== excludeId &&
      countsTowardActiveChallengeLimit(challenge.status),
  ).length;
}
