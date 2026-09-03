import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { listChallenges } from "@/lib/challenges/repository";
import { listLedgerEntries } from "@/lib/ledger/repository";
import { hasEntitlement } from "@/lib/monetization/entitlements";
import { calculatePropJourneyAnalytics } from "@/lib/prop-journey/analytics";

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

    if (!hasEntitlement(user.plan, "PROP_JOURNEY_ANALYTICS")) {
      return NextResponse.json(
        {
          error: "Prop Journey analytics require FFZ Pro.",
          code: "PRO_REQUIRED",
          upgradeUrl: "/upgrade",
        },
        { status: 403 },
      );
    }

    const [entries, challenges] = await Promise.all([
      listLedgerEntries(user.id),
      listChallenges(user.id, { syncFromJournal: false }),
    ]);

    return NextResponse.json({
      data: calculatePropJourneyAnalytics(entries, challenges),
    });
  } catch (error) {
    console.error("GET /api/prop-journey failed:", error);
    return NextResponse.json(
      { error: "Unable to load Prop Journey analytics." },
      { status: 500 },
    );
  }
}
