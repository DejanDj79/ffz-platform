import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getPaddleBillingAvailability } from "@/lib/billing/availability";
import {
  getPaddleConfig,
  priceIdForInterval,
  type BillingInterval,
} from "@/lib/billing/paddle";
import {
  safeFeatureName,
  safeInternalReturnPath,
} from "@/lib/navigation/safe-return";

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

    const billingAvailability = getPaddleBillingAvailability();
    if (!billingAvailability.available) {
      return NextResponse.json(
        {
          error: "FFZ Pro subscriptions are not available yet.",
          code: "BILLING_UNAVAILABLE",
        },
        { status: 503 },
      );
    }

    const body = await request.json() as {
      interval?: unknown;
      returnTo?: unknown;
      feature?: unknown;
    };
    if (!isBillingInterval(body.interval)) {
      return NextResponse.json(
        { error: "Choose a valid FFZ Pro billing interval." },
        { status: 400 },
      );
    }

    const returnTo = safeInternalReturnPath(body.returnTo);
    const feature = safeFeatureName(body.feature);
    const requestOrigin = request.headers.get("origin") || new URL(request.url).origin;
    const successUrl = new URL("/upgrade", requestOrigin);
    successUrl.searchParams.set("checkout", "success");
    if (returnTo) successUrl.searchParams.set("from", returnTo);
    if (feature) successUrl.searchParams.set("feature", feature);

    const config = getPaddleConfig({ requireWebhookSecret: true });

    return NextResponse.json({
      data: {
        checkout: {
          provider: "PADDLE",
          clientToken: config.clientToken,
          environment: config.environment,
          priceId: priceIdForInterval(body.interval, config),
          customerEmail: user.email,
          successUrl: successUrl.toString(),
          customData: {
            ffz_user_id: user.id,
            ffz_plan: "PRO",
            billing_interval: body.interval,
          },
        },
      },
    });
  } catch (error) {
    console.error("POST /api/billing/checkout failed:", error);
    return NextResponse.json(
      { error: "Unable to start FFZ Pro checkout." },
      { status: 500 },
    );
  }
}
