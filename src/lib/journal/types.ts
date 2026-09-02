export const JOURNAL_INSTRUMENTS = ["MNQ", "MES", "NQ", "ES"] as const;

export type JournalInstrument = (typeof JOURNAL_INSTRUMENTS)[number];
export type TradeDirection = "LONG" | "SHORT";
export type TradeStatus = "OPEN" | "CLOSED";
export type TradeOutcome = "WIN" | "LOSS" | "BREAKEVEN";

export type TradeApiModel = {
  id: string;
  challengeId: string | null;
  tradingAccountId: string | null;
  instrument: JournalInstrument;
  direction: TradeDirection;
  status: TradeStatus;
  openedAt: string;
  closedAt: string | null;
  entryPrice: number;
  stopPrice: number | null;
  targetPrice: number | null;
  exitPrice: number | null;
  contracts: number;
  commissionFees: number;
  grossPnl: number | null;
  netPnl: number | null;
  initialRisk: number | null;
  rMultiple: number | null;
  outcome: TradeOutcome | null;
  setup: string | null;
  tags: string[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TradeEditableInput = {
  challengeId: string | null;
  tradingAccountId: string | null;
  instrument: JournalInstrument;
  direction: TradeDirection;
  openedAt: string;
  closedAt: string | null;
  entryPrice: number;
  stopPrice: number | null;
  targetPrice: number | null;
  exitPrice: number | null;
  contracts: number;
  commissionFees: number;
  setup: string | null;
  tags: string[];
  notes: string | null;
};

export type UpdateTradeInput = Partial<TradeEditableInput>;


export type TradeAttachmentApiModel = {
  id: string;
  tradeId: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  sortOrder: number;
  createdAt: string;
};
