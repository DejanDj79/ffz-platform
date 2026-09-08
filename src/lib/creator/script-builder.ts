import type {
  CreatorEpisodeApiModel,
  CreatorScriptDraft,
  CreatorScriptSection,
  CreatorStorySuggestion,
} from "./episodes-types";
import type { EpisodeSnapshot } from "./episode-builder";

function money(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function percent(value: number | null) {
  return value == null ? "—" : `${value.toFixed(1)}%`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function section(
  id: string,
  label: string,
  title: string,
  durationMinutes: number,
  visualCue: CreatorScriptSection["visualCue"],
  content: string,
): CreatorScriptSection {
  return { id, label, title, durationMinutes, visualCue, content };
}

function tradeLine(
  trade: EpisodeSnapshot["episodeTrades"][number],
  index: number,
  featured: Set<string>,
) {
  const r = trade.rMultiple == null ? "R not recorded" : `${trade.rMultiple.toFixed(2)}R`;
  const setup = trade.setup ? `, setup ${trade.setup}` : "";
  const key = featured.has(trade.id) ? " [KEY TRADE]" : "";
  return `Trade ${index + 1}: ${trade.instrument} ${trade.direction}, ${money(trade.netPnl)}, ${r}${setup}.${key}`;
}

function lessonCopy(tone: CreatorStorySuggestion["tone"] | null) {
  if (tone === "DISCIPLINE") {
    return [
      "The biggest lesson here is not that I need to avoid losses. Losses are part of trading.",
      "The part I can control is what happens after a loss: whether I stay inside the plan, whether I force the next trade, and whether my risk or mindset changes because I want the money back.",
      "That is the part of this period I want to carry forward, because improving the process matters more than trying to erase one red result.",
    ].join(" ");
  }

  if (tone === "RESULT") {
    return [
      "The lesson for me is to separate the final P&L from the quality of the whole period.",
      "One strong trade can make the result look better than the rest of the execution, just like one bad trade can make a decent process look worse.",
      "I want to judge the next period by what was repeatable, not by one number at the end.",
    ].join(" ");
  }

  if (tone === "PROCESS") {
    return [
      "The lesson is to keep outcome and process separate.",
      "A green period does not prove every decision was good, and a red period does not prove every decision was wrong.",
      "What I want to keep is the part of the process that I can repeat and measure again next time.",
    ].join(" ");
  }

  return [
    "The main lesson is to look for repetition instead of judging one isolated trade.",
    "If the same setup, decision or mistake keeps showing up, that gives me something concrete to work on.",
    "The next period is where I find out whether this was just a short-term result or a pattern I can actually improve.",
  ].join(" ");
}

function nextStepCopy(tone: CreatorStorySuggestion["tone"] | null) {
  if (tone === "DISCIPLINE") {
    return "For the next period, I want one clear post-loss rule in front of me before the session starts, and I want to journal whether I followed it after every losing trade. The goal is not to promise a perfect week. The goal is to make the behavior measurable.";
  }
  if (tone === "RESULT") {
    return "For the next period, I want to track how much of the result comes from repeatable execution versus one exceptional trade. That should make the next review less about the headline P&L and more about consistency.";
  }
  if (tone === "PROCESS") {
    return "For the next period, I want to keep the same process markers and compare them again before changing anything. One period is information, not proof, so the next step is to collect another clean sample.";
  }
  return "For the next period, I want to keep tracking the same setup and execution details so I can compare another sample instead of changing the plan from one result.";
}

function renderSection(section: CreatorScriptSection) {
  const minutes = section.durationMinutes.toFixed(section.durationMinutes % 1 === 0 ? 0 : 1);
  return `[${section.label} · ~${minutes} MIN · ${section.visualCue}]\n${section.content}`;
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
    .filter((item) => item.id !== selected?.id && item.role !== "PRIMARY")
    .slice(0, 2);
  const featured = new Set(episode.featuredTradeIds);

  const tradeDuration = clamp(3 + snapshot.tradeCount * 0.35, 3.5, 6.5);
  const storyDuration = selected?.strength === "STRONG" ? 3.5 : 3;
  const threadDuration = supporting.length > 0 ? 1.5 : 0;

  const challengeContext = snapshot.challenge
    ? `I'm trading the ${snapshot.challenge.propFirm} ${snapshot.challenge.name} account. It is currently ${snapshot.challenge.status.replaceAll("_", " ").toLowerCase()}, with a balance of $${snapshot.challenge.currentBalance.toFixed(2)} from a $${snapshot.challenge.startingBalance.toFixed(2)} start.`
    : "This episode covers all of my closed trading activity in the selected period rather than one specific account.";

  const overviewParts = [
    `I closed ${snapshot.tradeCount} ${snapshot.tradeCount === 1 ? "trade" : "trades"}: ${snapshot.wins} wins, ${snapshot.losses} losses and ${snapshot.breakeven} breakeven.`,
    `Net P&L was ${money(snapshot.netPnl)}, with a ${percent(snapshot.winRate)} win rate${snapshot.averageR == null ? "" : ` and ${snapshot.averageR.toFixed(2)}R average result across trades with recorded risk`}.`,
    snapshot.topSetup ? `${snapshot.topSetup} was the most-used setup in the period.` : "There was no single setup label that dominated the period.",
  ];

  const tradeCopy = snapshot.episodeTrades.length > 0
    ? [
        "I want to go through every closed trade in order, because skipping the ugly ones would make the review useless.",
        ...snapshot.episodeTrades.map((trade, index) => tradeLine(trade, index, featured)),
        "The key trades are the ones I will slow down on, but every trade stays in the sequence so the story matches what actually happened.",
      ].join("\n")
    : "There were no closed trades in this period, so there is no trade sequence to force into the episode. The focus should stay on preparation, restraint and what I am waiting to see before trading again.";

  const evidenceCopy = storyEvidence.length > 0
    ? [
        `The central story I saved for this episode is: ${storyAngle}.`,
        "The data behind that story is:",
        ...storyEvidence.map((moment) => `- ${moment}`),
        "I want to explain what I was thinking in those moments, what was inside the plan, what was not, and what I would want to do differently if the same situation appears again.",
      ].join("\n")
    : `The central story I saved for this episode is: ${storyAngle}. I need to keep the discussion tied to the trades and journal evidence from this period instead of turning it into a general trading claim.`;

  const threadCopy = supporting.length > 0
    ? [
        "There are also a few secondary threads that are useful, but they are not the main episode.",
        ...supporting.map((item) => `${item.title}: ${item.why}`),
        "I will use these as supporting context, not as competing stories.",
      ].join("\n")
    : "There is no second story strong enough to compete with the main angle, so I am keeping this episode focused instead of adding a topic just to fill time.";

  const sections: CreatorScriptSection[] = [
    section(
      "hook",
      "HOOK",
      "Open on the real tension",
      0.75,
      "CAMERA",
      `This period finished ${money(snapshot.netPnl)}. I could make this episode only about the money, but that would miss the point. The story I actually want to focus on is this: ${storyAngle}.`,
    ),
    section(
      "context",
      "CONTEXT",
      "Set expectations for the journey",
      1.25,
      "CAMERA",
      `I'm documenting this while I am still learning and building consistency, so this is not a victory lap and it is not a lesson from a guru. It is a review of what I actually did, what the journal shows, and what I need to improve. ${challengeContext}`,
    ),
    section(
      "overview",
      "PERIOD OVERVIEW",
      "Give the numbers once",
      1.5,
      "SCOREBOARD",
      overviewParts.join(" "),
    ),
    section(
      "trades",
      "TRADE BREAKDOWN",
      "Walk every closed trade in order",
      tradeDuration,
      "DEEPCHARTS",
      tradeCopy,
    ),
    section(
      "story",
      "PRIMARY STORY",
      storyAngle,
      storyDuration,
      "JOURNAL",
      evidenceCopy,
    ),
  ];

  if (supporting.length > 0) {
    sections.push(section(
      "threads",
      "OTHER THREADS",
      "Use supporting patterns without losing focus",
      threadDuration,
      "DEEPCHARTS",
      threadCopy,
    ));
  }

  sections.push(
    section(
      "lesson",
      "LESSON",
      "Separate the lesson from the result",
      1.5,
      "CAMERA",
      lessonCopy(selected?.tone ?? primary?.tone ?? null),
    ),
    section(
      "next-step",
      "NEXT STEP",
      "Turn the review into one measurable action",
      1,
      "JOURNAL",
      nextStepCopy(selected?.tone ?? primary?.tone ?? null),
    ),
    section(
      "outro",
      "OUTRO",
      "Close the loop",
      0.5,
      "CAMERA",
      "That is where this period leaves me. In the next episode I want to come back to the same process and see whether the behavior actually changed, not just whether the P&L changed. If you are following this journey from the beginning, I will keep showing the wins, the losses and the mistakes as they happen.",
    ),
  );

  const totalMinutes = sections.reduce((sum, item) => sum + item.durationMinutes, 0);
  const text = sections.map(renderSection).join("\n\n");

  return { sections, totalMinutes, text };
}
