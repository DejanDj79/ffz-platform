import { describe, expect, it } from "vitest";
import {
  MAX_EPISODE_TRADE_SELECTION,
  normalizeEpisodeTradeIds,
  orderSelectedEpisodeTrades,
} from "@/lib/creator/episode-selection";

describe("episode trade selection", () => {
  it("normalizes, deduplicates and caps query-string trade ids", () => {
    const value = "one,two,one, three ,four,five,six";

    expect(normalizeEpisodeTradeIds(value)).toEqual([
      "one",
      "two",
      "three",
      "four",
      "five",
    ]);
    expect(normalizeEpisodeTradeIds(value)).toHaveLength(MAX_EPISODE_TRADE_SELECTION);
  });

  it("preserves the creator selection order and ignores missing trades", () => {
    const trades = [
      { id: "one", value: 1 },
      { id: "two", value: 2 },
      { id: "three", value: 3 },
    ];

    const selected = orderSelectedEpisodeTrades(trades, ["three", "missing", "one"]);

    expect(selected.map((trade) => trade.id)).toEqual(["three", "one"]);
  });

  it("returns no explicit selection when the query is empty", () => {
    expect(normalizeEpisodeTradeIds(undefined)).toEqual([]);
    expect(orderSelectedEpisodeTrades([{ id: "one" }], [])).toEqual([]);
  });
});
