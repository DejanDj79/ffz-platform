import { z } from "zod";

const email = z
  .string()
  .trim()
  .email("Enter a valid email address.")
  .max(320)
  .transform((value) => value.toLowerCase());

const password = z
  .string()
  .min(8, "Password must contain at least 8 characters.")
  .max(128, "Password is too long.");

export const registerSchema = z.object({
  email,
  password,
  displayName: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => value || null),
});

export const loginSchema = z.object({
  email,
  password,
});
