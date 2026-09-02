"use client";

import type {
  LedgerEntryApiModel,
  LedgerEntryInput,
  UpdateLedgerEntryInput,
} from "./types";

async function parseResponse<T>(response: Response): Promise<T> {
  const json = await response.json();

  if (!response.ok) {
    const message =
      typeof json?.error === "string"
        ? json.error
        : `Ledger API request failed (${response.status}).`;

    throw new Error(message);
  }

  return json as T;
}

export async function fetchLedgerEntries(): Promise<LedgerEntryApiModel[]> {
  const response = await fetch("/api/ledger", {
    cache: "no-store",
  });

  const json = await parseResponse<{ data: LedgerEntryApiModel[] }>(response);
  return json.data;
}

export async function createLedgerEntryViaApi(
  input: LedgerEntryInput,
): Promise<LedgerEntryApiModel> {
  const response = await fetch("/api/ledger", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const json = await parseResponse<{ data: LedgerEntryApiModel }>(response);
  return json.data;
}

export async function updateLedgerEntryViaApi(
  entryId: string,
  input: UpdateLedgerEntryInput,
): Promise<LedgerEntryApiModel> {
  const response = await fetch(`/api/ledger/${entryId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const json = await parseResponse<{ data: LedgerEntryApiModel }>(response);
  return json.data;
}

export async function deleteLedgerEntryViaApi(entryId: string): Promise<void> {
  const response = await fetch(`/api/ledger/${entryId}`, {
    method: "DELETE",
  });

  await parseResponse<{ ok: true; id: string }>(response);
}
