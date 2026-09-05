import { describe, expect, it } from "vitest";
import { orderEpisodeTrades } from "@/lib/creator/episode-trades";

describe("episode trade ordering", () => {
  it("keeps every trade and sorts them chronologically", () => {
    const trades = [
      { id: "three", openedAt: "2026-09-03T14:00:00.000Z", closedAt: "2026-09-03T14:15:00.000Z" },
      { id: "one", openedAt: "2026-09-01T14:00:00.000Z", closedAt: "2026-09-01T14:10:00.000Z" },
      { id: "two", openedAt: "2026-09-02T14:00:00.000Z", closedAt: "2026-09-02T14:05:00.000Z" },
    ];

    const ordered = orderEpisodeTrades(trades);

    expect(ordered.map((trade) => trade.id)).toEqual(["one", "two", "three"]);
    expect(ordered).toHaveLength(trades.length);
  });

  it("falls back to openedAt when closedAt is unavailable", () => {
    const trades = [
      { id: "later", openedAt: "2026-09-02T14:00:00.000Z", closedAt: null },
      { id: "earlier", openedAt: "2026-09-01T14:00:00.000Z", closedAt: null },
    ];

    expect(orderEpisodeTrades(trades).map((trade) => trade.id)).toEqual(["earlier", "later"]);
  });
});
