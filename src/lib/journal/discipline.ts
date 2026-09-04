export const EXECUTION_REVIEW_OPTIONS = [
  { value: "ON_PLAN", label: "On plan" },
  { value: "DEVIATED", label: "Deviated" },
  { value: "UNPLANNED", label: "Unplanned" },
] as const;

export const MINDSET_REVIEW_OPTIONS = [
  { value: "CALM", label: "Calm" },
  { value: "FOCUSED", label: "Focused" },
  { value: "FOMO", label: "FOMO" },
  { value: "REVENGE", label: "Revenge" },
  { value: "FEAR", label: "Fear" },
  { value: "FRUSTRATED", label: "Frustrated" },
  { value: "TIRED", label: "Tired" },
] as const;

export type ExecutionReview = (typeof EXECUTION_REVIEW_OPTIONS)[number]["value"];
export type MindsetReview = (typeof MINDSET_REVIEW_OPTIONS)[number]["value"];

export type DisciplineReview = {
  execution: ExecutionReview | null;
  mindset: MindsetReview | null;
};

const EXECUTION_TAG_PREFIX = "FFZ:execution:";
const MINDSET_TAG_PREFIX = "FFZ:mindset:";

const EXECUTION_TAGS: Record<ExecutionReview, string> = {
  ON_PLAN: `${EXECUTION_TAG_PREFIX}on-plan`,
  DEVIATED: `${EXECUTION_TAG_PREFIX}deviated`,
  UNPLANNED: `${EXECUTION_TAG_PREFIX}unplanned`,
};

const MINDSET_TAGS: Record<MindsetReview, string> = {
  CALM: `${MINDSET_TAG_PREFIX}calm`,
  FOCUSED: `${MINDSET_TAG_PREFIX}focused`,
  FOMO: `${MINDSET_TAG_PREFIX}fomo`,
  REVENGE: `${MINDSET_TAG_PREFIX}revenge`,
  FEAR: `${MINDSET_TAG_PREFIX}fear`,
  FRUSTRATED: `${MINDSET_TAG_PREFIX}frustrated`,
  TIRED: `${MINDSET_TAG_PREFIX}tired`,
};

const executionByTag = new Map(
  Object.entries(EXECUTION_TAGS).map(([value, tag]) => [tag, value as ExecutionReview]),
);

const mindsetByTag = new Map(
  Object.entries(MINDSET_TAGS).map(([value, tag]) => [tag, value as MindsetReview]),
);

export function readDisciplineReview(tags: string[]): DisciplineReview {
  let execution: ExecutionReview | null = null;
  let mindset: MindsetReview | null = null;

  for (const tag of tags) {
    execution ??= executionByTag.get(tag) ?? null;
    mindset ??= mindsetByTag.get(tag) ?? null;
  }

  return { execution, mindset };
}

export function clearDisciplineReviewTags(tags: string[]): string[] {
  return tags.filter(
    (tag) =>
      !tag.startsWith(EXECUTION_TAG_PREFIX) &&
      !tag.startsWith(MINDSET_TAG_PREFIX),
  );
}

export function applyDisciplineReview(
  tags: string[],
  review: DisciplineReview,
): string[] {
  const preserved = clearDisciplineReviewTags(tags);
  const next = [...preserved];

  if (review.execution) next.push(EXECUTION_TAGS[review.execution]);
  if (review.mindset) next.push(MINDSET_TAGS[review.mindset]);

  return [...new Set(next)];
}

export function disciplineReviewStatus(review: DisciplineReview) {
  if (review.execution && review.mindset) return "REVIEWED" as const;
  if (review.execution || review.mindset) return "PARTIAL" as const;
  return "UNREVIEWED" as const;
}
