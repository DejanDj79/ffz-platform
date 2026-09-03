import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getLemonBillingAvailability } from "@/lib/billing/availability";
import {
  createLemonCheckout,
  type BillingInterval,
} from "@/lib/billing/lemon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isBillingInterval(value: unknown): value is BillingInterval {
  return value === "MONTHLY" || value === "ANNUAL";
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (user.plan === "PRO") {
      return NextResponse.json(
        { error: "This account already has FFZ Pro.", code: "ALREADY_PRO" },
        { status: 409 },
      );
    }

    const billingAvailability = getLemonBillingAvailability();
    if (!billingAvailability.available) {
      return NextResponse.json(
        {
          error: "FFZ Pro subscriptions are not available yet.",
          code: "BILLING_UNAVAILABLE",
        },
        { status: 503 },
      );
    }

    const body = await request.json() as { interval?: unknown };
    if (!isBillingInterval(body.interval)) {
      return NextResponse.json(
        { error: "Choose a valid FFZ Pro billing interval." },
        { status: 400 },
      );
    }

    const requestOrigin = request.headers.get("origin") || new URL(request.url).origin;
    const redirectUrl = new URL("/upgrade", requestOrigin);
    redirectUrl.searchParams.set("checkout", "success");

    const url = await createLemonCheckout({
      userId: user.id,
      email: user.email,
      name: user.displayName,
      interval: body.interval,
      redirectUrl: redirectUrl.toString(),
    });

    return NextResponse.json({ data: { url } });
  } catch (error) {
    console.error("POST /api/billing/checkout failed:", error);
    return NextResponse.json(
      { error: "Unable to start FFZ Pro checkout." },
      { status: 500 },
    );
  }
}
