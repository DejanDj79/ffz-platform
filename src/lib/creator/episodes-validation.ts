import { z } from "zod";
import { CREATOR_EPISODE_SOURCES } from "./episodes-types";

const isoDateTimeSchema = z.string().refine(
  (value) => !Number.isNaN(new Date(value).getTime()),
  "Invalid ISO date-time.",
);

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
