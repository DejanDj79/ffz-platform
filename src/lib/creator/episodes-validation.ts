import { z } from "zod";
import {
  CREATOR_EPISODE_SOURCES,
  CREATOR_EPISODE_STATUSES,
} from "./episodes-types";

const isoDateTimeSchema = z.string().refine(
  (value) => !Number.isNaN(new Date(value).getTime()),
  "Invalid ISO date-time.",
);

const nullableTrimmedString = (max: number) => z.string().trim().max(max).nullable().optional();

export const creatorEpisodeCreateSchema = z.object({
  challengeId: z.string().uuid().nullable(),
  title: z.string().trim().min(1).max(180),
  source: z.enum(CREATOR_EPISODE_SOURCES),
  periodFrom: isoDateTimeSchema,
  periodTo: isoDateTimeSchema,
  brief: z.string().max(20000),
}).superRefine((value, ctx) => {
  if (new Date(value.periodFrom).getTime() > new Date(value.periodTo).getTime()) {
    ctx.addIssue({
      code: "custom",
      path: ["periodTo"],
      message: "periodTo must be after periodFrom.",
    });
  }
});

export const creatorEpisodeUpdateSchema = z.object({
  storyAngle: nullableTrimmedString(1000),
  script: z.string().max(100000).nullable().optional(),
  status: z.enum(CREATOR_EPISODE_STATUSES).optional(),
  featuredTradeIds: z.array(z.string().uuid()).max(20).optional(),
  publishTitle: nullableTrimmedString(180),
  thumbnailText: nullableTrimmedString(120),
  description: nullableTrimmedString(20000),
  chapters: nullableTrimmedString(10000),
  youtubeUrl: nullableTrimmedString(500),
}).refine(
  (value) => value.storyAngle !== undefined
    || value.script !== undefined
    || value.status !== undefined
    || value.featuredTradeIds !== undefined
    || value.publishTitle !== undefined
    || value.thumbnailText !== undefined
    || value.description !== undefined
    || value.chapters !== undefined
    || value.youtubeUrl !== undefined,
  "At least one episode field must be provided.",
);
