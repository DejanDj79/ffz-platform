import type {
  CreatorEpisodeApiModel,
  CreatorScriptDraft,
  CreatorScriptSection,
  CreatorStorySuggestion,
} from "./episodes-types";
import type { EpisodeSnapshot } from "./episode-builder";

type EpisodeTrade = EpisodeSnapshot["episodeTrades"][number];

function money(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function percent(value: number | null) {
  return value == null ? "—" : `${value.toFixed(1)}%`;
}

function wordCount(value: string) {
  const clean = value.trim();
  return clean ? clean.split(/\s+/).length : 0;
}

function durationFor(content: string, visualCue: CreatorScriptSection["visualCue"]) {
  const wordsPerMinute = visualCue === "CAMERA"
    ? 135
    : visualCue === "SCOREBOARD"
      ? 125
      : visualCue === "DEEPCHARTS"
        ? 110
        : 115;
  const minutes = wordCount(content) / wordsPerMinute;
  return Math.max(0.2, Math.round(minutes * 10) / 10);
}

function section(
  id: string,
  label: string,
  title: string,
  visualCue: CreatorScriptSection["visualCue"],
  content: string,
): CreatorScriptSection {
  return {
    id,
    label,
    title,
    durationMinutes: durationFor(content, visualCue),
    visualCue,
    content,
  };
}

function compactNote(value: string | null, maxLength = 240) {
  const note = value?.trim().replace(/\s+/g, " ");
  if (!note) return null;
  return note.length > maxLength ? `${note.slice(0, maxLength - 3)}...` : note;
}

function executionLabel(value: EpisodeTrade["execution"]) {
  if (value === "ON_PLAN") return "on plan";
  if (value === "DEVIATED") return "deviated";
  if (value === "UNPLANNED") return "unplanned";
  return null;
}

function mindsetLabel(value: EpisodeTrade["mindset"]) {
  if (!value) return null;
  return value.toLowerCase().replaceAll("_", " ");
}

function isPressureMindset(value: EpisodeTrade["mindset"]) {
  return value === "FOMO" || value === "REVENGE" || value === "FRUSTRATED" || value === "FEAR";
}

function selectKeyTradeIds(
  snapshot: EpisodeSnapshot,
  preferredIds: string[],
  tone: CreatorStorySuggestion["tone"] | null,
) {
  const preferred = new Set(preferredIds);
  const ranked = snapshot.episodeTrades.map((trade, index) => {
    let score = preferred.has(trade.id) ? 55 : 0;
    if (trade.execution === "DEVIATED" || trade.execution === "UNPLANNED") {
      score += tone === "DISCIPLINE" ? 38 : 20;
    }
    if (isPressureMindset(trade.mindset)) score += tone === "DISCIPLINE" ? 28 : 14;
    if (trade.notes?.trim()) score += 12;
    if (trade.outcome === "LOSS") score += tone === "DISCIPLINE" ? 12 : 6;
    if (Math.abs(trade.rMultiple ?? 0) >= 1) score += 5;
    score += Math.min(6, Math.abs(trade.netPnl) / 40);
    return { id: trade.id, index, score };
  }).sort((a, b) => b.score - a.score || a.index - b.index);

  const strong = ranked.filter((item) => item.score >= 55).slice(0, 3);
  if (strong.length > 0) return new Set(strong.map((item) => item.id));

  return new Set(ranked.slice(0, Math.min(2, ranked.length)).map((item) => item.id));
}

function tradeRecap(trade: EpisodeTrade, index: number, keyTrades: Set<string>) {
  const r = trade.rMultiple == null ? "with R not recorded" : `for ${trade.rMultiple.toFixed(2)}R`;
  const setup = trade.setup ? ` using ${trade.setup}` : "";
  const base = `Trade ${index + 1} was ${trade.instrument} ${trade.direction.toLowerCase()}${setup}. It finished ${money(trade.netPnl)}, ${r}.`;
  if (!keyTrades.has(trade.id)) return base;

  const reviewBits: string[] = [];
  const execution = executionLabel(trade.execution);
  const mindset = mindsetLabel(trade.mindset);
  if (execution) reviewBits.push(`I marked the execution as ${execution}`);
  if (mindset) reviewBits.push(`my mindset was ${mindset}`);

  const detail: string[] = [
    `${base} This is one of the trades I need to slow down on in the video.`,
  ];
  if (reviewBits.length > 0) detail.push(`${reviewBits.join(" and ")}.`);
  if (trade.initialRisk != null && trade.initialRisk > 0) {
    detail.push(`The recorded initial risk was $${trade.initialRisk.toFixed(2)}.`);
  }
  const note = compactNote(trade.notes);
  if (note) detail.push(`My journal note from this trade says: ${note}`);
  if (!note && reviewBits.length === 0) {
    detail.push("I need to use the chart here to explain the decision, what I expected to happen, and what changed once the trade was live.");
  }
  return detail.join(" ");
}

function firstPersonEvidence(value: string) {
  const text = value.trim();
  let match = text.match(/^(\d+) immediate same-day post-loss trades were explicitly marked (.+)\.$/i);
  if (match) return `I had ${match[1]} immediate same-day post-loss trades that I had marked ${match[2]}.`;

  match = text.match(/^(\d+) same-day follow-up trades were opened within (.+) of a loss and produced (.+)\.$/i);
  if (match) return `I went back into ${match[1]} same-day follow-up trades within ${match[2]} of a loss, and those trades produced ${match[3]}.`;

  match = text.match(/^(\d+) day had two or more additional trades after the first loss; (\d+) trades produced (.+)\.$/i);
  if (match) return `On ${match[1]} day I took two or more additional trades after the first loss; those ${match[2]} trades produced ${match[3]}.`;

  match = text.match(/^The period finished (.+), giving you (.+)\.$/i);
  if (match) return `I finished the period ${match[1]}, which gives me ${match[2]}.`;

  return text
    .replace(/^You traded /i, "I traded ")
    .replace(/^Your /i, "My ")
    .replace(/giving you/gi, "giving me");
}

function buildHook(
  snapshot: EpisodeSnapshot,
  selected: CreatorStorySuggestion | null,
  storyAngle: string,
) {
  if (selected?.tone === "DISCIPLINE") {
    return `I finished this period ${money(snapshot.netPnl)}, but when I went back through the journal, the money was not the part that bothered me most. The bigger problem was what I did after some of the losses. That is what I want to break down in this episode, because the result was red, but the behavior behind it is the part I can actually change.`;
  }
  if (selected?.tone === "RESULT") {
    return `The headline result for this period was ${money(snapshot.netPnl)}, but the number by itself gives the wrong impression. One part of the week carried much more weight than the rest, so I want to look past the P&L and ask whether the process was actually repeatable.`;
  }
  if (selected?.tone === "PROCESS") {
    return `This period finished ${money(snapshot.netPnl)}, but I do not want to judge the whole week from one number. I want to separate what happened from how I traded it, because that is the only way this review is useful for the next session.`;
  }
  return `This period finished ${money(snapshot.netPnl)}, and one pattern kept showing up when I reviewed the trades. The angle I want to test in this episode is: ${storyAngle}. I want to see whether the data really supports that lesson.`;
}

function buildPrimaryStory(
  snapshot: EpisodeSnapshot,
  selected: CreatorStorySuggestion | null,
  storyEvidence: string[],
  keyTrades: Set<string>,
) {
  const evidence = storyEvidence.map(firstPersonEvidence);
  const keyIndexes = snapshot.episodeTrades
    .map((trade, index) => keyTrades.has(trade.id) ? index + 1 : null)
    .filter((value): value is number => value != null);
  const keyReference = keyIndexes.length > 0
    ? `That is why I am slowing down on ${keyIndexes.length === 1 ? `Trade ${keyIndexes[0]}` : `Trades ${keyIndexes.join(", ")}`}.`
    : "The journal evidence is what needs to carry this section, not a general opinion about trading.";

  if (selected?.tone === "DISCIPLINE") {
    return [
      `When I looked back at the journal, the biggest issue was not simply that I finished ${money(snapshot.netPnl)}. It was that my behavior changed after losses.`,
      ...evidence,
      keyReference,
      "On those charts I want to be specific about the moment the decision changed: what the original plan was, whether I was still following it, and whether I was trying to solve the previous loss with the next trade. If I cannot explain that honestly from the journal and the chart, I should not invent a reason after the fact.",
      "For me, that is the real lesson from this period. A loss can be completely valid. A second decision made under pressure is a different problem, and that is the part I want to make visible before the next session starts.",
    ].join("\n\n");
  }

  if (selected?.tone === "RESULT") {
    return [
      `The result was ${money(snapshot.netPnl)}, but I need to separate the headline number from the quality of the whole period.`,
      ...evidence,
      keyReference,
      "The question I want to answer on the charts is whether the strongest result came from something I can repeat, or whether it simply made the rest of the week look better than it really was.",
    ].join("\n\n");
  }

  if (selected?.tone === "PROCESS") {
    return [
      `This section is about process rather than trying to turn ${money(snapshot.netPnl)} into a bigger story than it is.`,
      ...evidence,
      keyReference,
      "I want to compare the cleanest decisions with the weakest ones and keep the parts that were repeatable, even if the short-term outcome was not what I wanted.",
    ].join("\n\n");
  }

  return [
    ...evidence,
    keyReference,
    "I want to use the repeated examples, not one isolated trade, to decide whether this is actually a pattern worth changing.",
  ].join("\n\n");
}

function lessonCopy(tone: CreatorStorySuggestion["tone"] | null) {
  if (tone === "DISCIPLINE") {
    return "The takeaway for me is not that losses have to disappear. The thing I need to improve is the decision immediately after a loss. If the next setup is valid, it should still look valid after a short pause and after I check it against the plan. If it only feels urgent because I just lost money, that is exactly the behavior this review exposed.";
  }
  if (tone === "RESULT") {
    return "The takeaway is that final P&L and execution quality are not the same thing. I want to know which parts of the result came from repeatable decisions and which parts came from one exceptional trade, because only the repeatable part deserves to influence the next plan.";
  }
  if (tone === "PROCESS") {
    return "The takeaway is to keep outcome and process separate. A green period does not prove every decision was good, and a red period does not prove every decision was wrong. The useful part of this review is identifying what I can repeat and what I can measure again next time.";
  }
  return "The takeaway is to look for repetition instead of reacting to one isolated trade. If the same setup, decision or mistake keeps appearing, that gives me something concrete to review again in the next sample.";
}

function nextStepCopy(snapshot: EpisodeSnapshot, tone: CreatorStorySuggestion["tone"] | null) {
  if (tone === "DISCIPLINE") {
    const guardrailParts: string[] = [];
    if (snapshot.guardrails.maxDailyLosses != null) {
      guardrailParts.push(`my current Max Daily Losses guardrail is ${snapshot.guardrails.maxDailyLosses}`);
    }
    if (snapshot.guardrails.maxTradesPerDay != null) {
      guardrailParts.push(`my Max Trades per Day guardrail is ${snapshot.guardrails.maxTradesPerDay}`);
    }
    const existing = guardrailParts.length > 0
      ? `I already have a measurable boundary in FFZ: ${guardrailParts.join(" and ")}. `
      : "I do not want the next step to be a vague promise to be more disciplined. ";
    return `${existing}For the next period I want to use that boundary deliberately after a loss, pause before the next entry, and journal whether the next trade was still on plan. Then the next episode can compare behavior, not just P&L.`;
  }
  if (tone === "RESULT") {
    return "For the next period I want to track how much of the result comes from repeatable execution versus one exceptional trade. That gives me something concrete to compare without letting one winner or loser define the whole review.";
  }
  if (tone === "PROCESS") {
    return "For the next period I want to keep the same process markers and compare them again before changing anything. One period is information, not proof, so the next step is another clean sample with the same measurements.";
  }
  return "For the next period I want to keep tracking the same setup and execution details so I can compare another sample instead of changing the plan because of one result.";
}

function renderSection(item: CreatorScriptSection) {
  const minutes = item.durationMinutes.toFixed(item.durationMinutes % 1 === 0 ? 0 : 1);
  return `[${item.label} · ~${minutes} MIN · ${item.visualCue}]\n${item.content}`;
}

export function buildCreatorScriptDraft(
  episode: CreatorEpisodeApiModel,
  snapshot: EpisodeSnapshot,
  suggestions: CreatorStorySuggestion[],
): CreatorScriptDraft {
  const primary = suggestions.find((item) => item.role === "PRIMARY") ?? suggestions[0] ?? null;
  const selected = suggestions.find((item) => item.title === episode.storyAngle) ?? primary;
  const storyAngle = episode.storyAngle?.trim() || primary?.title || "What this period taught me about my trading";
  const storyEvidence = selected?.keyMoments ?? primary?.keyMoments ?? [];
  const supporting = suggestions
    .filter((item) => item.id !== selected?.id && item.role === "THREAD")
    .slice(0, 2);
  const preferredTradeIds = episode.featuredTradeIds.length > 0
    ? episode.featuredTradeIds
    : selected?.featuredTradeIds ?? [];
  const keyTrades = selectKeyTradeIds(snapshot, preferredTradeIds, selected?.tone ?? primary?.tone ?? null);

  const challengeContext = snapshot.challenge
    ? `For this review I am looking at my ${snapshot.challenge.propFirm} ${snapshot.challenge.name} account. It is ${snapshot.challenge.status.replaceAll("_", " ").toLowerCase()} now, with a balance of $${snapshot.challenge.currentBalance.toFixed(2)} from a $${snapshot.challenge.startingBalance.toFixed(2)} start.`
    : "For this review I am looking at all of my closed trading activity in the selected period rather than one specific account.";

  const overviewParts = [
    `There were ${snapshot.tradeCount} closed ${snapshot.tradeCount === 1 ? "trade" : "trades"}: ${snapshot.wins} wins, ${snapshot.losses} losses and ${snapshot.breakeven} breakeven.`,
    `Net P&L was ${money(snapshot.netPnl)} and the win rate was ${percent(snapshot.winRate)}${snapshot.averageR == null ? "" : `. Average result was ${snapshot.averageR.toFixed(2)}R across trades with recorded risk`}.`,
    snapshot.topSetup ? `${snapshot.topSetup} was the setup I used most often.` : "There was no single setup label that dominated the period.",
  ];

  const tradeCopy = snapshot.episodeTrades.length > 0
    ? [
        "I am keeping every closed trade in order. Most of them only need a quick recap, and I will slow down only where the journal gives me a reason to.",
        ...snapshot.episodeTrades.map((trade, index) => tradeRecap(trade, index, keyTrades)),
        `Out of ${snapshot.tradeCount} trades, ${keyTrades.size} ${keyTrades.size === 1 ? "trade is" : "trades are"} worth the deeper pause. That keeps the sequence honest without pretending every trade deserves the same amount of screen time.`,
      ].join("\n\n")
    : "There were no closed trades in this period, so there is no trade sequence to force into the episode. The focus should stay on preparation, restraint and what I am waiting to see before trading again.";

  const threadCopy = supporting.length > 0
    ? supporting.map((item) => {
        const why = item.why.replace(/^You traded /i, "I traded ");
        return `${item.title}. ${why} I want to keep this as supporting context rather than let it compete with the main story.`;
      }).join("\n\n")
    : "";

  const tone = selected?.tone ?? primary?.tone ?? null;
  const sections: CreatorScriptSection[] = [
    section(
      "hook",
      "HOOK",
      "Open on the real tension",
      "CAMERA",
      buildHook(snapshot, selected, storyAngle),
    ),
    section(
      "context",
      "CONTEXT",
      "Set the episode in the FFZ journey",
      "CAMERA",
      `This is part of my Futures From Zero journey, and I am documenting the process while I am still learning it. I am not trying to make the week look cleaner than it was; I want the journal, the charts and the actual decisions to do the talking. ${challengeContext}`,
    ),
    section(
      "overview",
      "PERIOD OVERVIEW",
      "Give the numbers once",
      "SCOREBOARD",
      overviewParts.join(" "),
    ),
    section(
      "trades",
      "TRADE BREAKDOWN",
      "Recap every trade and slow down on the real key moments",
      "DEEPCHARTS",
      tradeCopy,
    ),
    section(
      "story",
      "PRIMARY STORY",
      storyAngle,
      "JOURNAL",
      buildPrimaryStory(snapshot, selected, storyEvidence, keyTrades),
    ),
  ];

  if (supporting.length > 0) {
    sections.push(section(
      "threads",
      "OTHER THREADS",
      "Use supporting patterns without losing the main story",
      "DEEPCHARTS",
      threadCopy,
    ));
  }

  sections.push(
    section(
      "lesson",
      "LESSON",
      "Say what changes because of the review",
      "CAMERA",
      lessonCopy(tone),
    ),
    section(
      "next-step",
      "NEXT STEP",
      "Tie the lesson to an existing measurable rule",
      "JOURNAL",
      nextStepCopy(snapshot, tone),
    ),
    section(
      "outro",
      "OUTRO",
      "Close the loop without repeating the hook",
      "CAMERA",
      "The useful test is what happens next. In the next review I want to come back to the same behavior and see whether it changed under pressure, even if the P&L tells a different story. I will keep showing the wins, the losses and the mistakes as they happen, because that is the point of documenting this from zero.",
    ),
  );

  const totalMinutes = Math.round(sections.reduce((sum, item) => sum + item.durationMinutes, 0) * 10) / 10;
  const text = sections.map(renderSection).join("\n\n");

  return { sections, totalMinutes, text };
}
