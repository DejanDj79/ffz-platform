import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import {
  deleteLedgerEntry,
  getLedgerEntry,
  updateLedgerEntry,
} from "@/lib/ledger/repository";
import { updateLedgerEntrySchema } from "@/lib/ledger/validation";
import { hasEntitlement } from "@/lib/monetization/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    const { id } = await context.params;
    const entry = await getLedgerEntry(user.id, id);

    if (!entry) {
      return NextResponse.json(
        { error: "Ledger entry not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: entry });
  } catch (error) {
    console.error("GET /api/ledger/[id] failed:", error);

    return NextResponse.json(
      { error: "Unable to load ledger entry." },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    const { id } = await context.params;
    const input = updateLedgerEntrySchema.parse(
      await request.json(),
    );

    const entry = await updateLedgerEntry(
      user.id,
      id,
      input,
      {
        syncChallenges: hasEntitlement(user.plan, "AUTO_CHALLENGE_SYNC"),
      },
    );

    if (!entry) {
      return NextResponse.json(
        { error: "Ledger entry not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: entry });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid ledger entry.",
          issues: error.issues,
        },
        { status: 400 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "CHALLENGE_NOT_FOUND"
    ) {
      return NextResponse.json(
        { error: "Challenge not found." },
        { status: 400 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "TRADING_ACCOUNT_NOT_FOUND"
    ) {
      return NextResponse.json(
        { error: "Trading account not found." },
        { status: 400 },
      );
    }

    console.error("PATCH /api/ledger/[id] failed:", error);

    return NextResponse.json(
      { error: "Unable to update ledger entry." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext,
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    const { id } = await context.params;
    const deleted = await deleteLedgerEntry(user.id, id, {
      syncChallenges: hasEntitlement(user.plan, "AUTO_CHALLENGE_SYNC"),
    });

    if (!deleted) {
      return NextResponse.json(
        { error: "Ledger entry not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      id: deleted.id,
    });
  } catch (error) {
    console.error("DELETE /api/ledger/[id] failed:", error);

    return NextResponse.json(
      { error: "Unable to delete ledger entry." },
      { status: 500 },
    );
  }
}
