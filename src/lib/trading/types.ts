export type InstrumentCode = "MNQ" | "MES" | "NQ" | "ES";
export type Direction = "LONG" | "SHORT";
export type AccountType = "PERSONAL" | "PROP";

export interface InstrumentSpec {
  code: InstrumentCode;
  name: string;
  tickSize: number;
  tickValue: number;
  pointValue: number;
}

export interface PositionSizeInput {
  instrument: InstrumentCode;
  entry: number;
  stop: number;
  target?: number | null;
  maxRisk: number;
  commissionAndFeesPerContract?: number;
  slippageBufferTicks?: number;
  accountType?: AccountType;
  remainingDrawdown?: number | null;
  remainingDailyLoss?: number | null;
}

export type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "N/A";

export interface PositionSizeResult {
  direction: Direction;
  stopDistancePoints: number;
  stopDistanceTicks: number;
  marketRiskPerContract: number;
  commissionAndFeesPerContract: number;
  slippageBufferTicks: number;
  slippageBufferPerContract: number;
  totalCostBufferPerContract: number;
  riskPerContract: number;
  effectiveRiskBudget: number;
  maxContracts: number;
  actualRisk: number;
  unusedRiskBudget: number;
  rewardDistancePoints: number | null;
  rewardRiskRatio: number | null;
  drawdownUsagePct: number | null;
  dailyLossUsagePct: number | null;
  riskLevel: RiskLevel;
  warnings: string[];
}
