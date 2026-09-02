import { INSTRUMENTS } from "@/lib/trading/instruments";
import type { JournalInstrument, TradeDirection, TradeOutcome } from "./types";

type CalculateTradeMetricsInput = {
  instrument: JournalInstrument;
  direction: TradeDirection;
  entryPrice: number;
  stopPrice: number | null;
  exitPrice: number | null;
  contracts: number;
  commissionFees: number;
};

export type CalculatedTradeMetrics = {
  status: "OPEN" | "CLOSED";
  grossPnl: number | null;
  netPnl: number | null;
  initialRisk: number | null;
  rMultiple: number | null;
  outcome: TradeOutcome | null;
};

const roundMoney = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const roundR = (value: number) =>
  Math.round((value + Number.EPSILON) * 10000) / 10000;

export function calculateTradeMetrics(
  input: CalculateTradeMetricsInput,
): CalculatedTradeMetrics {
  const spec = INSTRUMENTS[input.instrument];
  const sign = input.direction === "LONG" ? 1 : -1;

  const initialRisk =
    input.stopPrice == null
      ? null
      : roundMoney(
          Math.abs(input.entryPrice - input.stopPrice) *
            spec.pointValue *
            input.contracts,
        );

  if (input.exitPrice == null) {
    return {
      status: "OPEN",
      grossPnl: null,
      netPnl: null,
      initialRisk,
      rMultiple: null,
      outcome: null,
    };
  }

  const grossPnl = roundMoney(
    (input.exitPrice - input.entryPrice) *
      sign *
      spec.pointValue *
      input.contracts,
  );

  const netPnl = roundMoney(grossPnl - input.commissionFees);
  const rMultiple =
    initialRisk != null && initialRisk > 0
      ? roundR(netPnl / initialRisk)
      : null;

  const outcome: TradeOutcome =
    netPnl > 0 ? "WIN" : netPnl < 0 ? "LOSS" : "BREAKEVEN";

  return {
    status: "CLOSED",
    grossPnl,
    netPnl,
    initialRisk,
    rMultiple,
    outcome,
  };
}
