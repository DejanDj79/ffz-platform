import { after, NextResponse } from "next/server";
import { forgotPasswordSchema } from "@/lib/auth/validation";
import { requestPasswordReset } from "@/lib/auth/password-reset";
import { passwordResetMailConfig } from "@/lib/auth/reset-mail";
import { consumeRateLimit, getClientAddress, hashRateLimitKey } from "@/lib/security/rate-limit";
import { rateLimitResponse } from "@/lib/security/auth-rate-limit";

export const runtime = "nodejs";
const message = "If an account exists for this email, you will receive a password reset link. Check your inbox and spam folder.";

export async function POST(request: Request) {
  const limit = consumeRateLimit(hashRateLimitKey(["forgot-password", getClientAddress(request)]), {
    limit: 5, windowMs: 15 * 60 * 1000,
  });
  if (!limit.allowed) return rateLimitResponse(limit, "Too many requests. Try again later.");
  const input = forgotPasswordSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  try {
    passwordResetMailConfig();
  } catch {
    return NextResponse.json({ error: "Password recovery is temporarily unavailable. Please try again later." }, { status: 503 });
  }
  // Same response and timing regardless of account existence or SMTP latency.
  after(async () => {
    try { await requestPasswordReset(input.data.email); }
    catch { console.error("Password recovery failed. Check database and SMTP configuration."); }
  });
  return NextResponse.json({ message }, { headers: { "Cache-Control": "no-store" } });
}
