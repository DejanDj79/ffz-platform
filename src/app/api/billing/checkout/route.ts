import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getDodoBillingAvailability } from "@/lib/billing/availability";
import {
  createDodoCheckoutSession,
  dodoProductIdForInterval,
  getDodoConfig,
  type DodoBillingInterval,
} from "@/lib/billing/dodo";
import {
  safeFeatureName,
  safeInternalReturnPath,
} from "@/lib/navigation/safe-return";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isBillingInterval(value: unknown): value is DodoBillingInterval {
  return value === "MONTHLY" || value === "ANNUAL";
}

function appOrigin(request: Request) {
  return (process.env.FFZ_APP_URL?.trim() || new URL(request.url).origin).replace(/\/$/, "");
}

function checkoutReturnUrl(
  request: Request,
  kind: "success" | "founder-success",
  returnTo: string | null,
  feature: string | null,
) {
  const query = new URLSearchParams({ checkout: kind });
  if (returnTo) query.set("from", returnTo);
  if (feature) query.set("feature", feature);
  return `${appOrigin(request)}/upgrade?${query.toString()}`;
}

function checkoutCancelUrl(
  request: Request,
  returnTo: string | null,
  feature: string | null,
) {
  const query = new URLSearchParams();
  if (returnTo) query.set("from", returnTo);
  if (feature) query.set("feature", feature);
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return `${appOrigin(request)}/upgrade${suffix}`;
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

    const billingAvailability = getDodoBillingAvailability();
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
    const config = getDodoConfig({ requireSubscriptions: true });
    const checkout = await createDodoCheckoutSession({
      productId: dodoProductIdForInterval(body.interval, config),
      email: user.email,
      returnUrl: checkoutReturnUrl(request, "success", returnTo, feature),
      cancelUrl: checkoutCancelUrl(request, returnTo, feature),
      metadata: {
        ffz_user_id: user.id,
        ffz_plan: "PRO",
        billing_interval: body.interval,
        ...(returnTo ? { return_to: returnTo } : {}),
        ...(feature ? { feature } : {}),
      },
    }, config);

    return NextResponse.json({ data: { url: checkout.url } });
  } catch (error) {
    console.error("POST /api/billing/checkout failed:", error);
    return NextResponse.json(
      { error: "Unable to start FFZ Pro checkout." },
      { status: 500 },
    );
  }
}
