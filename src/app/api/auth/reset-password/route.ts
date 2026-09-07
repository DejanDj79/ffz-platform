import { NextResponse } from "next/server";
import { resetPasswordSchema } from "@/lib/auth/validation";
import { completePasswordReset } from "@/lib/auth/password-reset";
import { consumeRateLimit, getClientAddress, hashRateLimitKey } from "@/lib/security/rate-limit";
import { rateLimitResponse } from "@/lib/security/auth-rate-limit";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const limit = consumeRateLimit(hashRateLimitKey(["reset-password", getClientAddress(request)]), {
    limit: 10, windowMs: 15 * 60 * 1000,
  });
  if (!limit.allowed) return rateLimitResponse(limit, "Too many attempts. Try again later.");
  const input = resetPasswordSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: input.error.issues[0]?.message ?? "Invalid reset data." }, { status: 400 });
  try {
    const changed = await completePasswordReset(input.data.token, input.data.password);
    if (!changed) return NextResponse.json({ error: "This reset link is invalid or has expired. Request a new link." }, { status: 400 });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("Password reset failed.");
    return NextResponse.json({ error: "Unable to reset password. Please try again." }, { status: 500 });
  }
}
