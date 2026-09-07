import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { PLANNED_TRADE_TAG } from "@/lib/journal/planned";
import { createTrade } from "@/lib/journal/repository";
import { tradeEditableSchema } from "@/lib/journal/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const parsed = tradeEditableSchema.parse(await request.json());
    const input = {
      ...parsed,
      closedAt: null,
      exitPrice: null,
      tags: [...new Set([...parsed.tags, PLANNED_TRADE_TAG])],
    };

    return NextResponse.json(
      {
        data: await createTrade(user.id, input, { syncChallenges: false }),
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid planned trade data.", issues: error.issues },
        { status: 400 },
      );
    }

    if (error instanceof Error && error.message === "CHALLENGE_NOT_FOUND") {
      return NextResponse.json({ error: "Challenge not found." }, { status: 400 });
    }

    if (error instanceof Error && error.message === "TRADING_ACCOUNT_NOT_FOUND") {
      return NextResponse.json({ error: "Trading account not found." }, { status: 400 });
    }

    console.error("POST /api/journal/plans failed:", error);
    return NextResponse.json({ error: "Unable to save planned trade." }, { status: 500 });
  }
}
