import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { createTrade, listTrades } from "@/lib/journal/repository";
import { tradeEditableSchema } from "@/lib/journal/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includePlanned = searchParams.get("includePlanned") === "1";

    return NextResponse.json({
      data: await listTrades(user.id, { includePlanned }),
    });
  } catch (error) {
    console.error("GET /api/journal/trades failed:", error);
    return NextResponse.json({ error: "Unable to load trades." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const input = tradeEditableSchema.parse(await request.json());
    return NextResponse.json(
      { data: await createTrade(user.id, input) },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid trade data.", issues: error.issues },
        { status: 400 },
      );
    }

    if (error instanceof Error && error.message === "CHALLENGE_NOT_FOUND") {
      return NextResponse.json({ error: "Challenge not found." }, { status: 400 });
    }

    if (error instanceof Error && error.message === "TRADING_ACCOUNT_NOT_FOUND") {
      return NextResponse.json({ error: "Trading account not found." }, { status: 400 });
    }

    console.error("POST /api/journal/trades failed:", error);
    return NextResponse.json({ error: "Unable to create trade." }, { status: 500 });
  }
}
