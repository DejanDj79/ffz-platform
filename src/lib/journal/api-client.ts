"use client";

import { isPlannedTrade } from "./planned";
import type {
  TradeApiModel,
  TradeEditableInput,
  UpdateTradeInput,
} from "./types";

export const JOURNAL_TRADES_CHANGED_EVENT = "ffz:journal-trades-changed";

async function parseResponse<T>(response: Response): Promise<T> {
  const json = await response.json();

  if (!response.ok) {
    const message =
      typeof json?.error === "string"
        ? json.error
        : `Journal API request failed (${response.status}).`;

    throw new Error(message);
  }

  return json as T;
}

function notifyJournalTradesChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(JOURNAL_TRADES_CHANGED_EVENT));
}

export async function fetchTrades(
  options: { includePlanned?: boolean } = {},
): Promise<TradeApiModel[]> {
  const query = options.includePlanned ? "?includePlanned=1" : "";
  const response = await fetch(`/api/journal/trades${query}`, {
    cache: "no-store",
  });

  const json = await parseResponse<{ data: TradeApiModel[] }>(response);
  return json.data;
}

export async function fetchTrade(tradeId: string): Promise<TradeApiModel> {
  const response = await fetch(`/api/journal/trades/${tradeId}`, {
    cache: "no-store",
  });

  const json = await parseResponse<{ data: TradeApiModel }>(response);
  return json.data;
}

export async function fetchPlannedTrades(): Promise<TradeApiModel[]> {
  const trades = await fetchTrades({ includePlanned: true });
  return trades.filter(isPlannedTrade);
}

export async function createTradeViaApi(
  input: TradeEditableInput,
): Promise<TradeApiModel> {
  const response = await fetch("/api/journal/trades", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const json = await parseResponse<{ data: TradeApiModel }>(response);
  notifyJournalTradesChanged();
  return json.data;
}

export async function importTradeViaApi(
  input: TradeEditableInput,
): Promise<TradeApiModel> {
  const response = await fetch("/api/journal/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const json = await parseResponse<{ data: TradeApiModel }>(response);
  notifyJournalTradesChanged();
  return json.data;
}

export async function updateTradeViaApi(
  tradeId: string,
  input: UpdateTradeInput,
): Promise<TradeApiModel> {
  const response = await fetch(`/api/journal/trades/${tradeId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const json = await parseResponse<{ data: TradeApiModel }>(response);

  if ("closedAt" in input || "exitPrice" in input) {
    notifyJournalTradesChanged();
  }

  return json.data;
}

export async function saveDisciplineReviewViaApi(
  tradeId: string,
  tags: string[],
): Promise<TradeApiModel> {
  const response = await fetch(`/api/journal/trades/${tradeId}/discipline`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tags }),
  });

  const json = await parseResponse<{ data: TradeApiModel }>(response);
  return json.data;
}

export async function deleteTradeViaApi(tradeId: string): Promise<void> {
  const response = await fetch(`/api/journal/trades/${tradeId}`, {
    method: "DELETE",
  });

  await parseResponse<{ ok: true; id: string }>(response);
  notifyJournalTradesChanged();
}

export async function fetchTradeAttachments(
  tradeId: string,
): Promise<import("./types").TradeAttachmentApiModel[]> {
  const response = await fetch(
    `/api/journal/trades/${tradeId}/attachments`,
    { cache: "no-store" },
  );

  const json = await parseResponse<{
    data: import("./types").TradeAttachmentApiModel[];
  }>(response);

  return json.data;
}

export async function uploadTradeAttachments(
  tradeId: string,
  files: File[],
): Promise<import("./types").TradeAttachmentApiModel[]> {
  const formData = new FormData();

  for (const file of files) {
    formData.append("files", file);
  }

  const response = await fetch(
    `/api/journal/trades/${tradeId}/attachments`,
    {
      method: "POST",
      body: formData,
    },
  );

  const json = await parseResponse<{
    data: import("./types").TradeAttachmentApiModel[];
  }>(response);

  return json.data;
}

export async function deleteTradeAttachmentViaApi(
  tradeId: string,
  attachmentId: string,
): Promise<void> {
  const response = await fetch(
    `/api/journal/trades/${tradeId}/attachments/${attachmentId}`,
    {
      method: "DELETE",
    },
  );

  await parseResponse<{
    ok: true;
    id: string;
  }>(response);
}

export function tradeAttachmentImageUrl(
  tradeId: string,
  attachmentId: string,
) {
  return `/api/journal/trades/${tradeId}/attachments/${attachmentId}/file`;
}
