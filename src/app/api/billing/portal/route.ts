import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getLemonCustomerPortal } from "@/lib/billing/lemon";
import { getUserBillingState } from "@/lib/billing/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const billing = await getUserBillingState(user.id);
    if (billing.provider !== "LEMON_SQUEEZY" || !billing.subscriptionId) {
      return NextResponse.json(
        { error: "No Lemon Squeezy subscription is connected to this FFZ account." },
        { status: 404 },
      );
    }

    const url = await getLemonCustomerPortal(billing.subscriptionId);
    return NextResponse.json({ data: { url } });
  } catch (error) {
    console.error("POST /api/billing/portal failed:", error);
    return NextResponse.json(
      { error: "Unable to open subscription management." },
      { status: 500 },
    );
  }
}
