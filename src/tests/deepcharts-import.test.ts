import { describe, expect, it } from "vitest";
import { parseDeepChartsCsv } from "@/lib/journal/deepcharts-import";

describe("DeepCharts CSV import", () => {
  it("parses the documented Trade List columns and infers fees from reported P&L", () => {
    const csv = [
      "Symbol,Quantity,Entry DT,Entry Price,Exit DT,Exit Price,ProfitLoss",
      "CME:MNQZ6,1,09/02/2026 09:30:00,20000,09/02/2026 09:35:00,20010,15",
      "CME:NQZ6,-2,09/02/2026 10:00:00,25000,09/02/2026 10:05:00,24990,390",
    ].join("\n");

    const result = parseDeepChartsCsv(csv, {
      challengeId: "11111111-1111-4111-8111-111111111111",
      timeZone: "America/New_York",
    });

    expect(result.fatalErrors).toEqual([]);
    expect(result.rows).toHaveLength(2);

    expect(result.rows[0].input).toMatchObject({
      instrument: "MNQ",
      direction: "LONG",
      contracts: 1,
      entryPrice: 20000,
      exitPrice: 20010,
      commissionFees: 5,
      openedAt: "2026-09-02T13:30:00.000Z",
      closedAt: "2026-09-02T13:35:00.000Z",
    });
    expect(result.rows[0].calculatedGrossPnl).toBe(20);
    expect(result.rows[0].reportedPnl).toBe(15);

    expect(result.rows[1].input).toMatchObject({
      instrument: "NQ",
      direction: "SHORT",
      contracts: 2,
      commissionFees: 10,
    });
    expect(result.rows[1].calculatedGrossPnl).toBe(400);
    expect(result.rows[1].reportedPnl).toBe(390);
  });

  it("supports quoted CSV values and UTC timestamps", () => {
    const csv = [
      'Symbol,Quantity,Entry DT,Entry Price,Exit DT,Exit Price,ProfitLoss',
      '"MESU6",1,"2026-09-02 14:00:00","6,500.00","2026-09-02 14:10:00","6,502.00","$10.00"',
    ].join("\n");

    const result = parseDeepChartsCsv(csv, {
      challengeId: null,
      timeZone: "UTC",
    });

    expect(result.fatalErrors).toEqual([]);
    expect(result.rows[0].error).toBeNull();
    expect(result.rows[0].input).toMatchObject({
      instrument: "MES",
      direction: "LONG",
      entryPrice: 6500,
      exitPrice: 6502,
      openedAt: "2026-09-02T14:00:00.000Z",
      closedAt: "2026-09-02T14:10:00.000Z",
      commissionFees: 0,
    });
  });

  it("rejects files that are not DeepCharts Trade List exports", () => {
    const result = parseDeepChartsCsv(
      "Symbol,Quantity,Entry Price\nMNQ,1,20000",
      { challengeId: null, timeZone: "UTC" },
    );

    expect(result.rows).toEqual([]);
    expect(result.fatalErrors).toHaveLength(1);
    expect(result.fatalErrors[0]).toContain("Missing columns");
  });

  it("marks unsupported futures symbols as invalid instead of importing them", () => {
    const csv = [
      "Symbol,Quantity,Entry DT,Entry Price,Exit DT,Exit Price,ProfitLoss",
      "CLZ6,1,09/02/2026 09:30:00,70,09/02/2026 09:35:00,71,1000",
    ].join("\n");

    const result = parseDeepChartsCsv(csv, {
      challengeId: null,
      timeZone: "UTC",
    });

    expect(result.rows[0].input).toBeNull();
    expect(result.rows[0].error).toContain("FFZ currently supports MNQ, MES, NQ and ES");
  });
});
