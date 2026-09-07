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

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/, "Invalid reset link."),
  password: password.refine(
    (value) => new TextEncoder().encode(value).length <= 72,
    "Password must be at most 72 bytes.",
  ),
});
