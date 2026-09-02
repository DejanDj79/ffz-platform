"use client";

import type {
  TradeApiModel,
  TradeEditableInput,
  UpdateTradeInput,
} from "./types";

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

export async function fetchTrades(): Promise<TradeApiModel[]> {
  const response = await fetch("/api/journal/trades", {
    cache: "no-store",
  });

  const json = await parseResponse<{ data: TradeApiModel[] }>(response);
  return json.data;
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
  return json.data;
}

export async function deleteTradeViaApi(tradeId: string): Promise<void> {
  const response = await fetch(`/api/journal/trades/${tradeId}`, {
    method: "DELETE",
  });

  await parseResponse<{ ok: true; id: string }>(response);
}
