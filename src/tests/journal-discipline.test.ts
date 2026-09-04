import { describe, expect, it } from "vitest";
import {
  applyDisciplineReview,
  disciplineReviewStatus,
  readDisciplineReview,
} from "@/lib/journal/discipline";

describe("journal discipline metadata", () => {
  it("preserves normal tags while adding structured review tags", () => {
    const tags = applyDisciplineReview(["A+", "FFZ:planned"], {
      execution: "ON_PLAN",
      mindset: "FOCUSED",
    });

    expect(tags).toEqual([
      "A+",
      "FFZ:planned",
      "FFZ:execution:on-plan",
      "FFZ:mindset:focused",
    ]);
    expect(readDisciplineReview(tags)).toEqual({
      execution: "ON_PLAN",
      mindset: "FOCUSED",
    });
  });

  it("replaces an earlier review instead of stacking conflicting tags", () => {
    const tags = applyDisciplineReview(
      [
        "scalp",
        "FFZ:execution:on-plan",
        "FFZ:mindset:calm",
      ],
      {
        execution: "DEVIATED",
        mindset: "REVENGE",
      },
    );

    expect(tags).toEqual([
      "scalp",
      "FFZ:execution:deviated",
      "FFZ:mindset:revenge",
    ]);
  });

  it("supports clearing review fields without touching other tags", () => {
    const tags = applyDisciplineReview(
      ["trend", "FFZ:execution:unplanned", "FFZ:mindset:fomo"],
      { execution: null, mindset: null },
    );

    expect(tags).toEqual(["trend"]);
    expect(disciplineReviewStatus(readDisciplineReview(tags))).toBe("UNREVIEWED");
  });

  it("reports partial and complete review states", () => {
    expect(
      disciplineReviewStatus({ execution: "ON_PLAN", mindset: null }),
    ).toBe("PARTIAL");
    expect(
      disciplineReviewStatus({ execution: "ON_PLAN", mindset: "CALM" }),
    ).toBe("REVIEWED");
  });
});
