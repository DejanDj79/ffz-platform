import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getDodoManagementAvailability } from "@/lib/billing/availability";
import {
  createDodoCustomerPortalSession,
  getDodoConfig,
} from "@/lib/billing/dodo";
import { getUserBillingState } from "@/lib/billing/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const availability = getDodoManagementAvailability();
    if (!availability.available) {
      return NextResponse.json(
        { error: "Subscription management is not available yet." },
        { status: 503 },
      );
    }

    const billing = await getUserBillingState(user.id);
    if (billing.provider !== "DODO" || !billing.customerId) {
      return NextResponse.json(
        { error: "No Dodo Payments subscription is connected to this FFZ account." },
        { status: 404 },
      );
    }

    const url = await createDodoCustomerPortalSession(
      billing.customerId,
      getDodoConfig(),
    );
    return NextResponse.json({ data: { url } });
  } catch (error) {
    console.error("POST /api/billing/portal failed:", error);
    return NextResponse.json(
      { error: "Unable to open subscription management." },
      { status: 500 },
    );
  }
}
