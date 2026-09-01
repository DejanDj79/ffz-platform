import type { InstrumentCode, InstrumentSpec } from "./types";

export const INSTRUMENTS: Record<InstrumentCode, InstrumentSpec> = {
  MNQ: {
    code: "MNQ",
    name: "Micro E-mini Nasdaq-100",
    tickSize: 0.25,
    tickValue: 0.5,
    pointValue: 2,
  },
  MES: {
    code: "MES",
    name: "Micro E-mini S&P 500",
    tickSize: 0.25,
    tickValue: 1.25,
    pointValue: 5,
  },
  NQ: {
    code: "NQ",
    name: "E-mini Nasdaq-100",
    tickSize: 0.25,
    tickValue: 5,
    pointValue: 20,
  },
  ES: {
    code: "ES",
    name: "E-mini S&P 500",
    tickSize: 0.25,
    tickValue: 12.5,
    pointValue: 50,
  },
};
