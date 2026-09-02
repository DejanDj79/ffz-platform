import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import {
  createLedgerEntry,
  listLedgerEntries,
} from "@/lib/ledger/repository";
import { ledgerEntrySchema } from "@/lib/ledger/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    return NextResponse.json({
      data: await listLedgerEntries(user.id),
    });
  } catch (error) {
    console.error("GET /api/ledger failed:", error);

    return NextResponse.json(
      { error: "Unable to load ledger entries." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    const input = ledgerEntrySchema.parse(await request.json());

    return NextResponse.json(
      {
        data: await createLedgerEntry(user.id, input),
      },
      { status: 201 },
    );
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

    console.error("POST /api/ledger failed:", error);

    return NextResponse.json(
      { error: "Unable to create ledger entry." },
      { status: 500 },
    );
  }
}
