import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getPaddleCustomerPortal } from "@/lib/billing/paddle";
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
    if (billing.provider !== "PADDLE" || !billing.customerId) {
      return NextResponse.json(
        { error: "No Paddle subscription is connected to this FFZ account." },
        { status: 404 },
      );
    }

    const url = await getPaddleCustomerPortal(billing.customerId, billing.subscriptionId);
    return NextResponse.json({ data: { url } });
  } catch (error) {
    console.error("POST /api/billing/portal failed:", error);
    return NextResponse.json(
      { error: "Unable to open subscription management." },
      { status: 500 },
    );
  }
}
