"use client";

import type { CustomRulePreset, CustomRulePresetInput } from "./custom-types";

function assertOk(response: Response) {
  if (!response.ok) {
    throw new Error(`Custom preset API request failed (${response.status}).`);
  }
}

export async function fetchCustomRulePresets(): Promise<CustomRulePreset[]> {
  const response = await fetch("/api/prop-firm-rules/custom", { cache: "no-store" });
  assertOk(response);
  const json = await response.json() as { data: CustomRulePreset[] };
  return json.data;
}

export async function createCustomRulePresetViaApi(input: CustomRulePresetInput) {
  const response = await fetch("/api/prop-firm-rules/custom", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  assertOk(response);
  const json = await response.json() as { data: CustomRulePreset };
  return json.data;
}

export async function updateCustomRulePresetViaApi(
  presetId: string,
  input: Partial<CustomRulePresetInput>,
) {
  const response = await fetch(`/api/prop-firm-rules/custom/${presetId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  assertOk(response);
  const json = await response.json() as { data: CustomRulePreset };
  return json.data;
}

export async function deleteCustomRulePresetViaApi(presetId: string) {
  const response = await fetch(`/api/prop-firm-rules/custom/${presetId}`, { method: "DELETE" });
  assertOk(response);
}
