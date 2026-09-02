import { INSTRUMENTS } from "@/lib/trading/instruments";
import type {
  JournalInstrument,
  TradeApiModel,
  TradeDirection,
  TradeEditableInput,
} from "./types";

export type DeepChartsImportTimeZone =
  | "LOCAL"
  | "America/New_York"
  | "America/Chicago"
  | "Europe/Belgrade"
  | "UTC";

export type DeepChartsParsedRow = {
  rowNumber: number;
  rawSymbol: string;
  reportedPnl: number | null;
  calculatedGrossPnl: number | null;
  commissionFees: number | null;
  warnings: string[];
  error: string | null;
  input: TradeEditableInput | null;
};

export type DeepChartsParseResult = {
  rows: DeepChartsParsedRow[];
  fatalErrors: string[];
};

type ParseOptions = {
  challengeId: string | null;
  timeZone: DeepChartsImportTimeZone;
};

type WallClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
};

const REQUIRED_HEADERS = {
  symbol: ["symbol"],
  quantity: ["quantity", "qty"],
  entryDt: ["entrydt", "entrydatetime", "entrydatetimevalue", "entrytime"],
  entryPrice: ["entryprice"],
  exitDt: ["exitdt", "exitdatetime", "exitdatetimevalue", "exittime"],
  exitPrice: ["exitprice"],
  profitLoss: ["profitloss", "pnl", "pl", "profitandloss"],
} as const;

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeHeader(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  row.push(field);
  if (row.some((value) => value.trim() !== "")) rows.push(row);

  return rows;
}

function parseNumber(raw: string) {
  let value = raw.trim();
  if (!value) return null;

  const negativeByParentheses = value.startsWith("(") && value.endsWith(")");
  value = value
    .replace(/[()]/g, "")
    .replace(/[$€£\s]/g, "")
    .replace(/,/g, "");

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return negativeByParentheses ? -Math.abs(parsed) : parsed;
}

function instrumentFromSymbol(raw: string): JournalInstrument | null {
  const upper = raw.trim().toUpperCase();
  const roots: JournalInstrument[] = ["MNQ", "MES", "NQ", "ES"];

  for (const root of roots) {
    const pattern = new RegExp(`(^|[^A-Z])${root}`);
    if (pattern.test(upper)) return root;
  }

  return null;
}

function applyAmPm(hour: number, suffix: string | undefined) {
  if (!suffix) return hour;
  const normalized = suffix.toUpperCase();
  if (normalized === "AM") return hour === 12 ? 0 : hour;
  return hour === 12 ? 12 : hour + 12;
}

function parseWallClock(raw: string): WallClock | null {
  const value = raw.trim();

  const ymd = value.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})[ T,]+(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?\s*(AM|PM)?$/i,
  );

  if (ymd) {
    return {
      year: Number(ymd[1]),
      month: Number(ymd[2]),
      day: Number(ymd[3]),
      hour: applyAmPm(Number(ymd[4]), ymd[8]),
      minute: Number(ymd[5]),
      second: Number(ymd[6] ?? 0),
      millisecond: Number((ymd[7] ?? "0").padEnd(3, "0")),
    };
  }

  const mdy = value.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T,]+(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?\s*(AM|PM)?$/i,
  );

  if (mdy) {
    return {
      year: Number(mdy[3]),
      month: Number(mdy[1]),
      day: Number(mdy[2]),
      hour: applyAmPm(Number(mdy[4]), mdy[8]),
      minute: Number(mdy[5]),
      second: Number(mdy[6] ?? 0),
      millisecond: Number((mdy[7] ?? "0").padEnd(3, "0")),
    };
  }

  return null;
}

function wallClockSerial(parts: WallClock) {
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond,
  );
}

function partsInZone(date: Date, timeZone: string): WallClock {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const values = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<string, number>;

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
    millisecond: date.getUTCMilliseconds(),
  };
}

function wallClockToIso(parts: WallClock, timeZone: DeepChartsImportTimeZone) {
  if (timeZone === "LOCAL") {
    const local = new Date(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      parts.millisecond,
    );
    return local.toISOString();
  }

  if (timeZone === "UTC") {
    return new Date(wallClockSerial(parts)).toISOString();
  }

  const target = wallClockSerial(parts);
  let guess = target;

  for (let iteration = 0; iteration < 3; iteration += 1) {
    const shown = partsInZone(new Date(guess), timeZone);
    guess += target - wallClockSerial(shown);
  }

  return new Date(guess).toISOString();
}

function parseDateTime(raw: string, timeZone: DeepChartsImportTimeZone) {
  const value = raw.trim();
  if (!value) return null;

  if (/(?:z|[+-]\d{2}:?\d{2})$/i.test(value)) {
    const direct = new Date(value);
    return Number.isNaN(direct.getTime()) ? null : direct.toISOString();
  }

  const parts = parseWallClock(value);
  if (!parts) return null;

  if (
    parts.month < 1 || parts.month > 12 ||
    parts.day < 1 || parts.day > 31 ||
    parts.hour < 0 || parts.hour > 23 ||
    parts.minute < 0 || parts.minute > 59 ||
    parts.second < 0 || parts.second > 59
  ) {
    return null;
  }

  return wallClockToIso(parts, timeZone);
}

function findColumn(headers: string[], aliases: readonly string[]) {
  const normalizedAliases = new Set(aliases.map(normalizeHeader));
  return headers.findIndex((header) => normalizedAliases.has(normalizeHeader(header)));
}

function tradeDirection(quantity: number): TradeDirection {
  return quantity < 0 ? "SHORT" : "LONG";
}

export function importTradeFingerprint(
  input: Pick<
    TradeEditableInput,
    "challengeId" | "instrument" | "direction" | "openedAt" | "closedAt" | "entryPrice" | "exitPrice" | "contracts"
  >,
) {
  return [
    input.challengeId ?? "",
    input.instrument,
    input.direction,
    new Date(input.openedAt).toISOString(),
    input.closedAt ? new Date(input.closedAt).toISOString() : "",
    input.entryPrice.toFixed(8),
    input.exitPrice == null ? "" : input.exitPrice.toFixed(8),
    String(input.contracts),
  ].join("|");
}

export function existingTradeFingerprint(trade: TradeApiModel) {
  return importTradeFingerprint({
    challengeId: trade.challengeId,
    instrument: trade.instrument,
    direction: trade.direction,
    openedAt: trade.openedAt,
    closedAt: trade.closedAt,
    entryPrice: trade.entryPrice,
    exitPrice: trade.exitPrice,
    contracts: trade.contracts,
  });
}

export function parseDeepChartsCsv(
  text: string,
  options: ParseOptions,
): DeepChartsParseResult {
  const csvRows = parseCsv(text);
  if (csvRows.length === 0) {
    return { rows: [], fatalErrors: ["The CSV file is empty."] };
  }

  const headers = csvRows[0];
  const columns = {
    symbol: findColumn(headers, REQUIRED_HEADERS.symbol),
    quantity: findColumn(headers, REQUIRED_HEADERS.quantity),
    entryDt: findColumn(headers, REQUIRED_HEADERS.entryDt),
    entryPrice: findColumn(headers, REQUIRED_HEADERS.entryPrice),
    exitDt: findColumn(headers, REQUIRED_HEADERS.exitDt),
    exitPrice: findColumn(headers, REQUIRED_HEADERS.exitPrice),
    profitLoss: findColumn(headers, REQUIRED_HEADERS.profitLoss),
  };

  const missing = Object.entries(columns)
    .filter(([, index]) => index < 0)
    .map(([key]) => key);

  if (missing.length > 0) {
    return {
      rows: [],
      fatalErrors: [
        `This does not look like a DeepCharts Trade List export. Missing columns: ${missing.join(", ")}.`,
      ],
    };
  }

  const rows: DeepChartsParsedRow[] = [];

  for (let index = 1; index < csvRows.length; index += 1) {
    const csvRow = csvRows[index];
    if (csvRow.every((value) => value.trim() === "")) continue;

    const rowNumber = index + 1;
    const rawSymbol = csvRow[columns.symbol] ?? "";
    const instrument = instrumentFromSymbol(rawSymbol);
    const quantity = parseNumber(csvRow[columns.quantity] ?? "");
    const entryPrice = parseNumber(csvRow[columns.entryPrice] ?? "");
    const exitPrice = parseNumber(csvRow[columns.exitPrice] ?? "");
    const reportedPnl = parseNumber(csvRow[columns.profitLoss] ?? "");
    const openedAt = parseDateTime(csvRow[columns.entryDt] ?? "", options.timeZone);
    const closedAt = parseDateTime(csvRow[columns.exitDt] ?? "", options.timeZone);
    const warnings: string[] = [];

    let error: string | null = null;

    if (!instrument) error = `Unsupported symbol "${rawSymbol || "(blank)"}". FFZ currently supports MNQ, MES, NQ and ES.`;
    else if (quantity == null || !Number.isInteger(quantity) || quantity === 0) error = "Quantity must be a non-zero whole number.";
    else if (entryPrice == null || entryPrice <= 0) error = "Entry Price is invalid.";
    else if (exitPrice == null || exitPrice <= 0) error = "Exit Price is invalid.";
    else if (!openedAt) error = "Entry DT is invalid. Check the CSV time-zone setting and file format.";
    else if (!closedAt) error = "Exit DT is invalid. Check the CSV time-zone setting and file format.";
    else if (new Date(closedAt).getTime() < new Date(openedAt).getTime()) error = "Exit DT is before Entry DT.";
    else if (reportedPnl == null) error = "ProfitLoss is invalid.";

    if (error || !instrument || quantity == null || entryPrice == null || exitPrice == null || !openedAt || !closedAt || reportedPnl == null) {
      rows.push({
        rowNumber,
        rawSymbol,
        reportedPnl,
        calculatedGrossPnl: null,
        commissionFees: null,
        warnings,
        error: error ?? "Unable to parse this row.",
        input: null,
      });
      continue;
    }

    const contracts = Math.abs(quantity);
    const direction = tradeDirection(quantity);
    const sign = direction === "LONG" ? 1 : -1;
    const calculatedGrossPnl = roundMoney(
      (exitPrice - entryPrice) * sign * INSTRUMENTS[instrument].pointValue * contracts,
    );

    const pnlDifference = roundMoney(calculatedGrossPnl - reportedPnl);
    let commissionFees = 0;

    if (pnlDifference > 0.02) {
      commissionFees = pnlDifference;
      warnings.push(`FFZ inferred ${pnlDifference.toFixed(2)} in commissions/fees so Journal net P&L matches DeepCharts ProfitLoss.`);
    } else if (pnlDifference < -0.02) {
      warnings.push(
        `DeepCharts ProfitLoss (${reportedPnl.toFixed(2)}) is higher than price-derived gross P&L (${calculatedGrossPnl.toFixed(2)}). FFZ will use 0 fees; review this trade after import.`,
      );
    }

    const input: TradeEditableInput = {
      challengeId: options.challengeId,
      tradingAccountId: null,
      instrument,
      direction,
      openedAt,
      closedAt,
      entryPrice,
      stopPrice: null,
      targetPrice: null,
      exitPrice,
      contracts,
      commissionFees,
      setup: null,
      tags: [],
      notes: null,
    };

    rows.push({
      rowNumber,
      rawSymbol,
      reportedPnl,
      calculatedGrossPnl,
      commissionFees,
      warnings,
      error: null,
      input,
    });
  }

  return { rows, fatalErrors: [] };
}
