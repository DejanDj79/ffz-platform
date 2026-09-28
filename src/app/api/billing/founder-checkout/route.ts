import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getDodoFounderAvailability } from "@/lib/billing/availability";
import {
  attachFounderCheckoutUrl,
  releaseFounderReservation,
  reserveFounderSlot,
} from "@/lib/billing/founder-repository";
import {
  createDodoCheckoutSession,
  getDodoConfig,
} from "@/lib/billing/dodo";
import {
  safeFeatureName,
  safeInternalReturnPath,
} from "@/lib/navigation/safe-return";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function appOrigin(request: Request) {
  return (process.env.FFZ_APP_URL?.trim() || new URL(request.url).origin).replace(/\/$/, "");
}

function founderReturnUrl(
  request: Request,
  returnTo: string | null,
  feature: string | null,
) {
  const query = new URLSearchParams({ checkout: "founder-success" });
  if (returnTo) query.set("from", returnTo);
  if (feature) query.set("feature", feature);
  return `${appOrigin(request)}/upgrade?${query.toString()}`;
}

function founderCancelUrl(
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
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (user.role === "CREATOR") {
    return NextResponse.json(
      { error: "Creator access already includes FFZ Pro.", code: "CREATOR_ACCESS" },
      { status: 409 },
    );
  }

  const availability = getDodoFounderAvailability();
  if (!availability.available) {
    return NextResponse.json(
      {
        error: "Founder Trader checkout is not available yet.",
        code: "FOUNDER_UNAVAILABLE",
      },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => ({})) as {
    returnTo?: unknown;
    feature?: unknown;
  };
  const returnTo = safeInternalReturnPath(body.returnTo);
  const feature = safeFeatureName(body.feature);

  let reserved:
    | {
        slotNo: number;
        reservationToken: string;
        expiresAt: Date;
        checkoutUrl: string | null;
      }
    | null = null;

  try {
    const reservation = await reserveFounderSlot(user.id);

    if (reservation.kind === "PURCHASED") {
      return NextResponse.json(
        { error: "This account already has Founder lifetime access.", code: "ALREADY_FOUNDER" },
        { status: 409 },
      );
    }

    if (reservation.kind === "REFUNDED") {
      return NextResponse.json(
        { error: "This account already used its Founder purchase slot.", code: "FOUNDER_REFUNDED" },
        { status: 409 },
      );
    }

    if (reservation.kind === "SOLD_OUT") {
      return NextResponse.json(
        { error: "Founder Trader is sold out.", code: "FOUNDER_SOLD_OUT" },
        { status: 409 },
      );
    }

    if (reservation.kind === "PENDING") {
      return NextResponse.json(
        {
          error: "A Founder checkout is already reserved for this account. Please try again after the reservation expires.",
          code: "FOUNDER_CHECKOUT_PENDING",
        },
        { status: 409 },
      );
    }

    reserved = reservation;

    if (reservation.checkoutUrl) {
      return NextResponse.json({ data: { url: reservation.checkoutUrl } });
    }

    const config = getDodoConfig({ requireFounder: true });
    const checkout = await createDodoCheckoutSession({
      productId: config.founderProductId,
      email: user.email,
      returnUrl: founderReturnUrl(request, returnTo, feature),
      cancelUrl: founderCancelUrl(request, returnTo, feature),
      metadata: {
        ffz_user_id: user.id,
        ffz_plan: "FOUNDER",
        founder_slot: String(reservation.slotNo),
        founder_reservation_token: reservation.reservationToken,
        ...(returnTo ? { return_to: returnTo } : {}),
        ...(feature ? { feature } : {}),
      },
    }, config);

    const attached = await attachFounderCheckoutUrl({
      userId: user.id,
      slotNo: reservation.slotNo,
      reservationToken: reservation.reservationToken,
      checkoutUrl: checkout.url,
    });

    if (!attached) {
      throw new Error("Founder reservation changed before checkout could be attached.");
    }

    return NextResponse.json({ data: { url: checkout.url } });
  } catch (error) {
    if (reserved) {
      await releaseFounderReservation({
        userId: user.id,
        slotNo: reserved.slotNo,
        reservationToken: reserved.reservationToken,
      }).catch((releaseError) => {
        console.error("Unable to release failed Founder reservation:", releaseError);
      });
    }

    console.error("POST /api/billing/founder-checkout failed:", error);
    return NextResponse.json(
      { error: "Unable to start Founder Trader checkout." },
      { status: 500 },
    );
  }
}
