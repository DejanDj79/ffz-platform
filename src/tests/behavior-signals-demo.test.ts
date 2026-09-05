import { describe, expect, it } from "vitest";
import { calculateWeeklyBehaviorSignals } from "@/lib/journal/behavior-signals";
import {
  BEHAVIOR_DEMO_GUARDRAILS,
  createBehaviorDemoTrades,
} from "@/lib/journal/behavior-signals-demo";

describe("behavior signal demo data", () => {
  it("activates the visual states needed for local behavior-signal review", () => {
    const trades = createBehaviorDemoTrades(new Date(2026, 8, 7));
    const signals = calculateWeeklyBehaviorSignals(trades, BEHAVIOR_DEMO_GUARDRAILS);
    const byKey = new Map(signals.map((signal) => [signal.key, signal]));

    expect(byKey.get("RAPID_REENTRY")?.events.length).toBeGreaterThan(0);
    expect(byKey.get("POST_LOSS_ACTIVITY")?.events.length).toBeGreaterThan(0);
    expect(Number(byKey.get("LOSS_STREAK")?.value)).toBeGreaterThanOrEqual(3);
    expect(byKey.get("OVERTRADING")?.events.length).toBeGreaterThan(0);
    expect(byKey.get("DAILY_LOSS_COUNT")?.events.length).toBeGreaterThan(0);
    expect(byKey.get("PLAN_BREAKDOWN")?.events.length).toBeGreaterThan(0);
    expect(byKey.get("MINDSET_SHIFT")?.events.length).toBeGreaterThan(0);
    expect(byKey.get("RISK_ESCALATION")?.events.length).toBeGreaterThan(0);
    expect(signals.some((signal) => signal.tone === "unavailable")).toBe(false);
  });
});
