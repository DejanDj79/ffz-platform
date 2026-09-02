import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { deleteTrade, getTrade, updateTrade } from "@/lib/journal/repository";
import { updateTradeSchema } from "@/lib/journal/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { id } = await context.params;
    const trade = await getTrade(user.id, id);

    if (!trade) {
      return NextResponse.json({ error: "Trade not found." }, { status: 404 });
    }

    return NextResponse.json({ data: trade });
  } catch (error) {
    console.error("GET /api/journal/trades/[id] failed:", error);
    return NextResponse.json({ error: "Unable to load trade." }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { id } = await context.params;
    const input = updateTradeSchema.parse(await request.json());
    const trade = await updateTrade(user.id, id, input);

    if (!trade) {
      return NextResponse.json({ error: "Trade not found." }, { status: 404 });
    }

    return NextResponse.json({ data: trade });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid trade data.", issues: error.issues },
        { status: 400 },
      );
    }

    const known: Record<string, string> = {
      CHALLENGE_NOT_FOUND: "Challenge not found.",
      TRADING_ACCOUNT_NOT_FOUND: "Trading account not found.",
      INVALID_CLOSED_STATE: "Closed trades require both Exit Price and Closed At.",
      INVALID_CLOSED_TIME: "Closed At cannot be before Opened At.",
    };

    if (error instanceof Error && known[error.message]) {
      return NextResponse.json({ error: known[error.message] }, { status: 400 });
    }

    console.error("PATCH /api/journal/trades/[id] failed:", error);
    return NextResponse.json({ error: "Unable to update trade." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { id } = await context.params;
    const deleted = await deleteTrade(user.id, id);

    if (!deleted) {
      return NextResponse.json({ error: "Trade not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, id: deleted.id });
  } catch (error) {
    console.error("DELETE /api/journal/trades/[id] failed:", error);
    return NextResponse.json({ error: "Unable to delete trade." }, { status: 500 });
  }
}
