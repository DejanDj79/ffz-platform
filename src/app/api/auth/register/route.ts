import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { claimLegacyDevData } from "@/lib/auth/dev-data";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { registerSchema } from "@/lib/auth/validation";
import {
  consumeRegisterIpLimit,
  rateLimitResponse,
} from "@/lib/security/auth-rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const registerLimit =
      consumeRegisterIpLimit(request);

    if (!registerLimit.allowed) {
      return rateLimitResponse(
        registerLimit,
        "Too many registration attempts. Try again later.",
      );
    }

    const input = registerSchema.parse(
      await request.json(),
    );

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);

    if (existing[0]) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 },
      );
    }

    const passwordHash = await hashPassword(input.password);

    const inserted = await db
      .insert(users)
      .values({
        email: input.email,
        displayName: input.displayName,
        passwordHash,
      })
      .returning({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        role: users.role,
      });

    const user = inserted[0];

    await claimLegacyDevData(user.id, user.email);
    await createSession(user.id);

    return NextResponse.json({ data: user }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid registration data.", issues: error.issues },
        { status: 400 },
      );
    }

    console.error("POST /api/auth/register failed:", error);
    return NextResponse.json(
      { error: "Unable to create account." },
      { status: 500 },
    );
  }
}
