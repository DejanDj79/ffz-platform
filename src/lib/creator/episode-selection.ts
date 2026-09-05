export const MAX_EPISODE_TRADE_SELECTION = 5;

export function normalizeEpisodeTradeIds(
  value: string | null | undefined,
  limit = MAX_EPISODE_TRADE_SELECTION,
) {
  const ids = (value ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0 && id.length <= 128);

  return Array.from(new Set(ids)).slice(0, Math.max(0, limit));
}

export function orderSelectedEpisodeTrades<T extends { id: string }>(
  trades: T[],
  selectedIds: string[],
) {
  if (selectedIds.length === 0) return [];

  const byId = new Map(trades.map((trade) => [trade.id, trade]));
  return selectedIds
    .map((id) => byId.get(id))
    .filter((trade): trade is T => trade != null);
}
