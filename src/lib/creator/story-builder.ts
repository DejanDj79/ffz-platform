import { calculateWeeklyBehaviorSignals } from "@/lib/journal/behavior-signals";
import { listTrades } from "@/lib/journal/repository";
import type { TradeApiModel } from "@/lib/journal/types";
import { getTradingGuardrailSettings } from "@/lib/trading/guardrails-repository";
import type { CreatorStorySuggestion } from "./episodes-types";
import type { EpisodeBuilderFilters } from "./episode-builder";

type RankedStory = Omit<CreatorStorySuggestion, "role" | "strength"> & {
  score: number;
};

function inRange(value: string | null, from: Date, to: Date) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return time >= from.getTime() && time <= to.getTime();
}

function money(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function compactNote(value: string | null | undefined) {
  const note = value?.trim().replace(/\s+/g, " ");
  if (!note) return null;
  return note.length > 125 ? `${note.slice(0, 122)}...` : note;
}

function uniqueIds(values: string[]) {
  return [...new Set(values)].slice(0, 12);
}

function rankedTrades(trades: TradeApiModel[]) {
  return trades
    .filter((trade) => trade.netPnl != null)
    .slice()
    .sort((a, b) => (b.netPnl ?? 0) - (a.netPnl ?? 0));
}

function storyStrength(score: number): CreatorStorySuggestion["strength"] {
  if (score >= 82) return "STRONG";
  if (score >= 70) return "SOLID";
  return "SUPPORTING";
}

function finalizeStories(stories: RankedStory[]): CreatorStorySuggestion[] {
  const ranked = stories.slice().sort((a, b) => b.score - a.score);
  if (ranked.length === 0) return [];

  const primaryScore = ranked[0].score;
  let alternativeAssigned = false;

  return ranked.slice(0, 4).map((story, index) => {
    let role: CreatorStorySuggestion["role"] = "THREAD";
    if (index === 0) {
      role = "PRIMARY";
    } else if (!alternativeAssigned && story.score >= 72 && story.score >= primaryScore - 15) {
      role = "ALTERNATIVE";
      alternativeAssigned = true;
    }

    const { score, ...rest } = story;
    return {
      ...rest,
      role,
      strength: storyStrength(score),
    };
  });
}

function setupStory(trades: TradeApiModel[], periodNetPnl: number): RankedStory | null {
  const setups = new Map<string, { count: number; pnl: number; ids: string[] }>();
  for (const trade of trades) {
    const setup = trade.setup?.trim();
    if (!setup) continue;
    const current = setups.get(setup) ?? { count: 0, pnl: 0, ids: [] };
    current.count += 1;
    current.pnl += trade.netPnl ?? 0;
    current.ids.push(trade.id);
    setups.set(setup, current);
  }

  const ranked = [...setups.entries()]
    .filter(([, value]) => value.count >= 2)
    .sort((a, b) => {
      if (b[1].count !== a[1].count) return b[1].count - a[1].count;
      return Math.abs(b[1].pnl) - Math.abs(a[1].pnl);
    });

  const top = ranked[0];
  if (!top) return null;
  const [name, value] = top;
  const pnlWeight = Math.abs(periodNetPnl) > 0 && Math.abs(value.pnl) >= Math.abs(periodNetPnl) * 0.5 ? 5 : 0;
  const score = Math.min(82, 44 + value.count * 5 + pnlWeight);

  return {
    id: "setup-pattern",
    title: `${name} kept showing up — here is what I learned`,
    why: `You traded ${name} ${value.count} times for a combined ${money(value.pnl)}. That repetition makes the setup a useful thread, but it only becomes the episode's main story when the evidence is strong enough.`,
    keyMoments: [
      `${value.count} trades used the ${name} setup.`,
      `Combined result from the setup: ${money(value.pnl)}.`,
      "Compare what was consistent between the executions and what changed on the losing versions.",
    ],
    featuredTradeIds: uniqueIds(value.ids),
    tone: "LESSON",
    score,
  };
}

export async function buildCreatorStorySuggestions(
  userId: string,
  filters: EpisodeBuilderFilters,
): Promise<CreatorStorySuggestion[]> {
  const [allTrades, guardrails] = await Promise.all([
    listTrades(userId),
    getTradingGuardrailSettings(userId),
  ]);

  const trades = allTrades.filter((trade) => {
    if (trade.status !== "CLOSED") return false;
    if (!inRange(trade.closedAt ?? trade.openedAt, filters.from, filters.to)) return false;
    if (filters.challengeId && trade.challengeId !== filters.challengeId) return false;
    return true;
  });

  if (trades.length === 0) {
    return [{
      id: "no-trades-reset",
      title: "No trades this period — and why that can still be progress",
      why: "There are no closed trades in this episode period, so forcing a performance story would be artificial. A reset, preparation or process episode is more honest and useful.",
      keyMoments: [
        "Explain why there were no trades instead of hiding the quiet period.",
        "Show what you reviewed, prepared or deliberately avoided.",
        "End with the specific condition you want to see before the next trade.",
      ],
      featuredTradeIds: [],
      tone: "PROCESS",
      role: "PRIMARY",
      strength: "SOLID",
    }];
  }

  const netPnl = trades.reduce((sum, trade) => sum + (trade.netPnl ?? 0), 0);
  const signals = calculateWeeklyBehaviorSignals(trades, guardrails);
  const activeSignals = signals.filter(
    (signal) => (signal.tone === "warning" || signal.tone === "watch") && signal.events.length > 0,
  );
  const ranked = rankedTrades(trades);
  const best = ranked[0] ?? null;
  const worst = ranked.length > 1 ? ranked[ranked.length - 1] : null;
  const stories: RankedStory[] = [];

  if (activeSignals.length > 0) {
    const priority = activeSignals.find((signal) => signal.key === "PLAN_BREAKDOWN")
      ?? activeSignals.find((signal) => signal.key === "MINDSET_SHIFT")
      ?? activeSignals.find((signal) => signal.key === "RISK_ESCALATION")
      ?? activeSignals.find((signal) => signal.key === "RAPID_REENTRY")
      ?? activeSignals[0];
    const signalTradeIds = uniqueIds(
      activeSignals.flatMap((signal) => signal.events.flatMap((event) => event.trades.map((trade) => trade.id))),
    );
    const eventCount = activeSignals.reduce((sum, signal) => sum + signal.events.length, 0);
    const warningBonus = priority.tone === "warning" ? 5 : 0;
    const score = Math.min(98, 78 + Math.min(15, eventCount * 3) + warningBonus);

    stories.push({
      id: "discipline-under-pressure",
      title: netPnl >= 0
        ? "I made money, but my discipline was the real story"
        : "The loss was not the biggest problem — my discipline was",
      why: `${priority.label} was detected in this period. The episode has a stronger story if the result is the context and the behavior under pressure is the main lesson.`,
      keyMoments: [
        priority.summary,
        ...activeSignals
          .filter((signal) => signal.key !== priority.key)
          .slice(0, 2)
          .map((signal) => signal.summary),
        netPnl >= 0
          ? `The period still finished ${money(netPnl)}, which makes the discipline warning more important rather than less important.`
          : `The period finished ${money(netPnl)}, giving you a concrete result to connect with the behavior review.`,
      ],
      featuredTradeIds: signalTradeIds,
      tone: "DISCIPLINE",
      score,
    });
  }

  if (best && (best.netPnl ?? 0) > 0 && netPnl > 0 && netPnl - (best.netPnl ?? 0) <= 0) {
    stories.push({
      id: "one-trade-carried-period",
      title: "One trade carried the result — was the period actually good?",
      why: `The period made ${money(netPnl)}, but without the best trade (${money(best.netPnl ?? 0)}) the remaining trades would have been flat or negative. That creates a useful distinction between outcome and repeatable process.`,
      keyMoments: [
        `Best trade: ${best.instrument} ${best.direction} for ${money(best.netPnl ?? 0)}.`,
        `Result without that trade: ${money(netPnl - (best.netPnl ?? 0))}.`,
        compactNote(best.notes) ? `Journal note from the key trade: ${compactNote(best.notes)}` : "Review whether the best trade came from a repeatable setup or an exceptional move.",
      ],
      featuredTradeIds: uniqueIds([best.id, ...(worst ? [worst.id] : [])]),
      tone: "RESULT",
      score: 82,
    });
  }

  if (activeSignals.length === 0) {
    if (netPnl < 0) {
      stories.push({
        id: "clean-red-period",
        title: "I followed the process and still finished red",
        why: "No defined behavior warning was detected, yet the period lost money. That is a strong beginner-trading lesson: a red result does not automatically mean the process was wrong.",
        keyMoments: [
          `Period result: ${money(netPnl)} across ${trades.length} closed trades.`,
          worst ? `Largest losing trade: ${worst.instrument} ${worst.direction} for ${money(worst.netPnl ?? 0)}.` : "Review the losing trades without inventing a discipline problem that the journal does not support.",
          "Separate execution quality from short-term outcome and define what should remain unchanged next period.",
        ],
        featuredTradeIds: uniqueIds([...(worst ? [worst.id] : []), ...(best ? [best.id] : [])]),
        tone: "PROCESS",
        score: 76,
      });
    } else {
      stories.push({
        id: "process-green-period",
        title: "A green period without forcing trades — what actually worked",
        why: "The period finished positive without a detected behavior warning. This gives you a process-focused story that does not need exaggerated drama.",
        keyMoments: [
          `Period result: ${money(netPnl)} across ${trades.length} closed trades.`,
          best ? `Best trade: ${best.instrument} ${best.direction} for ${money(best.netPnl ?? 0)}.` : "Review the strongest execution of the period.",
          "Identify which parts of the process are repeatable and should carry into the next episode.",
        ],
        featuredTradeIds: uniqueIds([...(best ? [best.id] : []), ...(worst ? [worst.id] : [])]),
        tone: "PROCESS",
        score: 74,
      });
    }
  }

  const setup = setupStory(trades, netPnl);
  if (setup) stories.push(setup);

  return finalizeStories(stories);
}
