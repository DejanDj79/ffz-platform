import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { loginSchema } from "@/lib/auth/validation";
import {
  consumeLoginAccountLimit,
  consumeLoginIpLimit,
  loginAccountRateLimitKey,
  rateLimitResponse,
} from "@/lib/security/auth-rate-limit";
import { clearRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const ipLimit =
      consumeLoginIpLimit(request);

    if (!ipLimit.allowed) {
      return rateLimitResponse(
        ipLimit,
        "Too many sign-in attempts. Try again later.",
      );
    }

    const input = loginSchema.parse(
      await request.json(),
    );

    const accountLimitKey =
      loginAccountRateLimitKey(
        request,
        input.email,
      );

    const accountLimit =
      consumeLoginAccountLimit(
        accountLimitKey,
      );

    if (!accountLimit.allowed) {
      return rateLimitResponse(
        accountLimit,
        "Too many sign-in attempts. Try again later.",
      );
    }

    const rows = await db
      .select()
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);

    const user = rows[0];

    if (!user?.passwordHash) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 },
      );
    }

    const valid = await verifyPassword(input.password, user.passwordHash);

    if (!valid) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 },
      );
    }

    await createSession(user.id);
    clearRateLimit(accountLimitKey);

    return NextResponse.json({
      data: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid login data.", issues: error.issues },
        { status: 400 },
      );
    }

    console.error("POST /api/auth/login failed:", error);
    return NextResponse.json(
      { error: "Unable to sign in." },
      { status: 500 },
    );
  }
}
