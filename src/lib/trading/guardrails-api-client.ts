"use client";

import type {
  TradingGuardrailSettings,
  TradingGuardrailSettingsApiModel,
} from "./guardrails-types";

async function parseResponse(response: Response) {
  const json = await response.json();
  if (!response.ok) {
    throw new Error(
      typeof json?.error === "string"
        ? json.error
        : `Trading guardrails request failed (${response.status}).`,
    );
  }
  return json.data as TradingGuardrailSettingsApiModel;
}

export async function fetchTradingGuardrailSettings() {
  return parseResponse(
    await fetch("/api/trading-guardrails", { cache: "no-store" }),
  );
}

export async function saveTradingGuardrailSettingsViaApi(
  settings: TradingGuardrailSettings,
) {
  return parseResponse(
    await fetch("/api/trading-guardrails", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    }),
  );
}
