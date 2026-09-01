import type { RiskLevel } from "./types";

export function classifyRiskLevel(drawdownUsagePct: number | null): RiskLevel {
  if (drawdownUsagePct === null || !Number.isFinite(drawdownUsagePct)) return "N/A";
  if (drawdownUsagePct <= 5) return "LOW";
  if (drawdownUsagePct <= 10) return "MODERATE";
  return "HIGH";
}
