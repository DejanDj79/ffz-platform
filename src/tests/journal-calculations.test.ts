import { describe, expect, it } from "vitest";
import { calculateTradeMetrics } from "@/lib/journal/calculations";

describe("journal trade calculations", () => {
  it("calculates a closed winning MNQ long", () => {
    const result = calculateTradeMetrics({
      instrument: "MNQ",
      direction: "LONG",
      entryPrice: 20000,
      stopPrice: 19990,
      exitPrice: 20020,
      contracts: 1,
      commissionFees: 1.22,
    });

    expect(result.status).toBe("CLOSED");
    expect(result.initialRisk).toBe(20);
    expect(result.grossPnl).toBe(40);
    expect(result.netPnl).toBe(38.78);
    expect(result.rMultiple).toBe(1.939);
    expect(result.outcome).toBe("WIN");
  });

  it("calculates a closed losing MES short", () => {
    const result = calculateTradeMetrics({
      instrument: "MES",
      direction: "SHORT",
      entryPrice: 6000,
      stopPrice: 6005,
      exitPrice: 6005,
      contracts: 1,
      commissionFees: 1.24,
    });

    expect(result.initialRisk).toBe(25);
    expect(result.grossPnl).toBe(-25);
    expect(result.netPnl).toBe(-26.24);
    expect(result.rMultiple).toBe(-1.0496);
    expect(result.outcome).toBe("LOSS");
  });

  it("keeps P&L empty for an open trade but calculates risk", () => {
    const result = calculateTradeMetrics({
      instrument: "NQ",
      direction: "LONG",
      entryPrice: 20000,
      stopPrice: 19995,
      exitPrice: null,
      contracts: 1,
      commissionFees: 0,
    });

    expect(result.status).toBe("OPEN");
    expect(result.initialRisk).toBe(100);
    expect(result.netPnl).toBeNull();
    expect(result.rMultiple).toBeNull();
  });
});
