"use client";

import type {
  ScoreboardSettingsApiModel,
  UpdateScoreboardSettingsInput,
} from "./types";

async function parse<T>(response: Response): Promise<T> {
  const json = await response.json();

  if (!response.ok) {
    throw new Error(
      typeof json?.error === "string"
        ? json.error
        : `Scoreboard request failed (${response.status}).`,
    );
  }

  return json as T;
}

export async function fetchScoreboardSettings() {
  const response = await fetch("/api/scoreboard/settings", {
    cache: "no-store",
  });

  const json = await parse<{
    data: ScoreboardSettingsApiModel;
  }>(response);

  return json.data;
}

export async function saveScoreboardSettings(
  input: UpdateScoreboardSettingsInput,
) {
  const response = await fetch("/api/scoreboard/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const json = await parse<{
    data: ScoreboardSettingsApiModel;
  }>(response);

  return json.data;
}

export async function regenerateScoreboardLink() {
  const response = await fetch("/api/scoreboard/rotate-key", {
    method: "POST",
  });

  const json = await parse<{
    data: ScoreboardSettingsApiModel;
  }>(response);

  return json.data;
}
