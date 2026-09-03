import type { ChallengeApiStatus } from "@/lib/challenges/api-types";
import type { ChallengeStatus } from "@/lib/challenges/types";

type ChallengeLimitStatus = ChallengeStatus | ChallengeApiStatus;

const ACTIVE_CHALLENGE_STATUSES = new Set<ChallengeLimitStatus>([
  "NOT_STARTED",
  "ACTIVE",
  "IN_PROGRESS",
  "PAUSED",
  "FUNDED",
]);

export function countsTowardActiveChallengeLimit(status: ChallengeLimitStatus) {
  return ACTIVE_CHALLENGE_STATUSES.has(status);
}

export function countActiveChallenges(
  challenges: Array<{ id: string; status: ChallengeLimitStatus }>,
  excludeId?: string,
) {
  return challenges.filter(
    (challenge) =>
      challenge.id !== excludeId &&
      countsTowardActiveChallengeLimit(challenge.status),
  ).length;
}
