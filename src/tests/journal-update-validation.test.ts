import { describe, expect, it } from "vitest";
import { updateTradeSchema } from "@/lib/journal/validation";

describe("journal partial update validation", () => {
  it("does not inject defaults into a tags-only update", () => {
    const parsed = updateTradeSchema.parse({
      tags: ["A+", "FFZ:execution:on-plan"],
    });

    expect(parsed).toEqual({
      tags: ["A+", "FFZ:execution:on-plan"],
    });
    expect("closedAt" in parsed).toBe(false);
    expect("exitPrice" in parsed).toBe(false);
    expect("challengeId" in parsed).toBe(false);
  });
});
