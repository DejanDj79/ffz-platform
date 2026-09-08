export const CREATOR_EPISODE_STATUSES = [
  "DRAFT",
  "SCRIPT_READY",
  "RECORDED",
  "EDITED",
  "PUBLISHED",
] as const;

export const CREATOR_EPISODE_SOURCES = ["BUILDER", "WEEKLY_REVIEW"] as const;

export type CreatorEpisodeStatus = (typeof CREATOR_EPISODE_STATUSES)[number];
export type CreatorEpisodeSource = (typeof CREATOR_EPISODE_SOURCES)[number];

export type CreatorEpisodeApiModel = {
  id: string;
  challengeId: string | null;
  title: string;
  status: CreatorEpisodeStatus;
  source: CreatorEpisodeSource;
  periodFrom: string;
  periodTo: string;
  brief: string;
  storyAngle: string | null;
  script: string | null;
  featuredTradeIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type CreateCreatorEpisodeInput = {
  challengeId: string | null;
  title: string;
  source: CreatorEpisodeSource;
  periodFrom: string;
  periodTo: string;
  brief: string;
};

export type UpdateCreatorEpisodeInput = {
  storyAngle?: string | null;
  script?: string | null;
  status?: CreatorEpisodeStatus;
  featuredTradeIds?: string[];
};

export type CreatorStorySuggestion = {
  id: string;
  title: string;
  why: string;
  keyMoments: string[];
  featuredTradeIds: string[];
  tone: "PROCESS" | "DISCIPLINE" | "RESULT" | "LESSON";
  role: "PRIMARY" | "ALTERNATIVE" | "THREAD";
  strength: "STRONG" | "SOLID" | "SUPPORTING";
};

export type CreatorScriptSection = {
  id: string;
  label: string;
  title: string;
  durationMinutes: number;
  visualCue: "CAMERA" | "SCOREBOARD" | "DEEPCHARTS" | "JOURNAL";
  content: string;
};

export type CreatorScriptDraft = {
  sections: CreatorScriptSection[];
  totalMinutes: number;
  text: string;
};
