import type { EpisodeSnapshot } from "./episode-builder";
import type { CreatorEpisodeApiModel, CreatorPublishDraft } from "./episodes-types";

function money(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toFixed(0)}`;
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function trimTitle(value: string, max = 100) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function chapterTitle(label: string) {
  const normalized = label.trim().toUpperCase();
  const labels: Record<string, string> = {
    HOOK: "The real problem",
    CONTEXT: "Futures From Zero context",
    "PERIOD OVERVIEW": "Period overview",
    "TRADE BREAKDOWN": "Every trade in order",
    "PRIMARY STORY": "The main story",
    "KEY TRADE DEEP DIVES": "Key trade deep dives",
    "OTHER THREADS": "Supporting pattern",
    LESSON: "What I learned",
    "NEXT STEP": "What changes next",
    OUTRO: "Outro",
  };
  return labels[normalized] ?? label.trim();
}

function timestamp(totalSeconds: number) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function buildChapters(script: string | null) {
  if (!script) return "00:00 Episode start";

  let elapsedSeconds = 0;
  const chapters: string[] = [];
  for (const rawLine of script.split("\n")) {
    const line = rawLine.trim();
    const match = line.match(/^\[(.+?) · ~([\d.]+) MIN · .+?\]$/);
    if (!match) continue;
    const minutes = Number(match[2]);
    chapters.push(`${timestamp(elapsedSeconds)} ${chapterTitle(match[1])}`);
    if (Number.isFinite(minutes)) elapsedSeconds += minutes * 60;
  }

  return chapters.length > 0 ? chapters.join("\n") : "00:00 Episode start";
}

function buildTitleIdeas(episode: CreatorEpisodeApiModel, snapshot: EpisodeSnapshot) {
  const story = episode.storyAngle?.trim() || "What this period taught me about trading";
  const result = money(snapshot.netPnl);
  const tradeSummary = `${snapshot.tradeCount} ${snapshot.tradeCount === 1 ? "Trade" : "Trades"}, ${snapshot.losses} ${snapshot.losses === 1 ? "Loss" : "Losses"}`;

  if (/discipline|post-loss|after.*loss/i.test(story)) {
    return unique([
      trimTitle(`I Finished ${result} — But the Bigger Problem Was My Discipline`),
      trimTitle(`${tradeSummary} — What My Trading Journal Exposed`),
      trimTitle(`What Happened After My Losses | Futures From Zero`),
    ]);
  }

  if (/one trade|carried|headline result/i.test(story)) {
    return unique([
      trimTitle(`One Trade Changed the Whole Result — Was the Period Actually Good?`),
      trimTitle(`${result} on the Period — But the P&L Hid the Real Story`),
      trimTitle(`Was My Trading Actually Good, or Did One Trade Save It?`),
    ]);
  }

  if (/setup|opening range|vwap|pullback|liquidity/i.test(story)) {
    return unique([
      trimTitle(`${story} | Futures From Zero`),
      trimTitle(`${tradeSummary} — The Setup Pattern I Need to Understand`),
      trimTitle(`What My Repeated Setups Are Actually Teaching Me`),
    ]);
  }

  return unique([
    trimTitle(`${story} | Futures From Zero`),
    trimTitle(`${result} Across ${snapshot.tradeCount} Trades — What I Learned`),
    trimTitle(`${tradeSummary}: What I Need to Fix Next`),
  ]);
}

function buildThumbnailIdeas(episode: CreatorEpisodeApiModel, snapshot: EpisodeSnapshot) {
  const story = episode.storyAngle?.toLowerCase() ?? "";
  if (story.includes("discipline")) {
    return ["DISCIPLINE BROKE", "AFTER THE LOSS", `${money(snapshot.netPnl)} PERIOD`];
  }
  if (story.includes("one trade") || story.includes("carried")) {
    return ["ONE TRADE SAVED IT", "GOOD WEEK?", "THE P&L LIED"];
  }
  if (/setup|opening range|vwap|pullback|liquidity/.test(story)) {
    return ["SAME SETUP. AGAIN.", "WHAT AM I MISSING?", "SETUP REVIEW"];
  }
  return ["WHAT I GOT WRONG", `${money(snapshot.netPnl)} PERIOD`, "THE REAL LESSON"];
}

function buildDescription(episode: CreatorEpisodeApiModel, snapshot: EpisodeSnapshot) {
  const story = episode.storyAngle?.trim() || "what this period taught me about my trading";
  const account = snapshot.challenge
    ? `${snapshot.challenge.propFirm} ${snapshot.challenge.name}`
    : "my selected futures trading activity";
  const averageR = snapshot.averageR == null ? "not available" : `${snapshot.averageR.toFixed(2)}R`;

  return [
    "I'm documenting my futures trading journey from zero — the wins, losses, mistakes and the process of trying to become more consistent.",
    "",
    `In this episode I review ${snapshot.tradeCount} closed ${snapshot.tradeCount === 1 ? "trade" : "trades"} from ${account}. The period finished ${money(snapshot.netPnl)} with ${snapshot.wins} wins, ${snapshot.losses} losses and a ${snapshot.winRate == null ? "—" : `${snapshot.winRate.toFixed(1)}%`} win rate. Average result across trades with recorded risk was ${averageR}.`,
    "",
    `The main story from the journal is: ${story}.`,
    "",
    "Instead of hiding the bad trades or judging everything from P&L, I'm using the journal and charts to understand what actually happened and what I need to change next.",
    "",
    `Period: ${dateLabel(episode.periodFrom)} → ${dateLabel(episode.periodTo)}`,
    "",
    "Futures From Zero documents my personal trading journey and learning process. Nothing in this video is financial advice.",
  ].join("\n");
}

export function buildCreatorPublishDraft(
  episode: CreatorEpisodeApiModel,
  snapshot: EpisodeSnapshot,
): CreatorPublishDraft {
  return {
    titleIdeas: buildTitleIdeas(episode, snapshot),
    thumbnailIdeas: buildThumbnailIdeas(episode, snapshot),
    description: buildDescription(episode, snapshot),
    chapters: buildChapters(episode.script),
  };
}
