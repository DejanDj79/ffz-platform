import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getFounderBillingAvailability } from "@/lib/billing/availability";
import {
  createLemonFounderCheckout,
  founderCheckoutExpiresAt,
} from "@/lib/billing/founder";
import {
  attachFounderCheckoutUrl,
  releaseFounderReservation,
  reserveFounderSlot,
} from "@/lib/billing/founder-repository";
import {
  safeFeatureName,
  safeInternalReturnPath,
} from "@/lib/navigation/safe-return";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const availability = getFounderBillingAvailability();
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

  let reservation: Awaited<ReturnType<typeof reserveFounderSlot>> | null = null;
  let lemonCheckoutCreated = false;

  try {
    reservation = await reserveFounderSlot(user.id);

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
          error: "A Founder checkout is already being prepared for this account. Please try again shortly.",
          code: "FOUNDER_CHECKOUT_PENDING",
        },
        { status: 409 },
      );
    }

    const checkoutExpiresAt = founderCheckoutExpiresAt(reservation.expiresAt);

    if (reservation.checkoutUrl) {
      if (checkoutExpiresAt.getTime() <= Date.now()) {
        return NextResponse.json(
          {
            error: "Your previous Founder checkout just expired. Try again in a few minutes while FFZ finalizes the slot.",
            code: "FOUNDER_CHECKOUT_FINALIZING",
          },
          { status: 409 },
        );
      }

      return NextResponse.json({ data: { url: reservation.checkoutUrl } });
    }

    if (checkoutExpiresAt.getTime() <= Date.now()) {
      await releaseFounderReservation({
        userId: user.id,
        slotNo: reservation.slotNo,
        reservationToken: reservation.reservationToken,
      });
      return NextResponse.json(
        { error: "Founder reservation expired. Please try again.", code: "FOUNDER_RESERVATION_EXPIRED" },
        { status: 409 },
      );
    }

    const requestOrigin = request.headers.get("origin") || new URL(request.url).origin;
    const redirectUrl = new URL("/upgrade", requestOrigin);
    redirectUrl.searchParams.set("checkout", "founder-success");
    if (returnTo) redirectUrl.searchParams.set("from", returnTo);
    if (feature) redirectUrl.searchParams.set("feature", feature);

    const checkout = await createLemonFounderCheckout({
      userId: user.id,
      email: user.email,
      name: user.displayName,
      slotNo: reservation.slotNo,
      reservationToken: reservation.reservationToken,
      expiresAt: checkoutExpiresAt,
      redirectUrl: redirectUrl.toString(),
    });
    lemonCheckoutCreated = true;

    const attached = await attachFounderCheckoutUrl({
      userId: user.id,
      slotNo: reservation.slotNo,
      reservationToken: reservation.reservationToken,
      checkoutUrl: checkout.url,
    });

    if (!attached) {
      throw new Error("FOUNDER_RESERVATION_CHANGED");
    }

    return NextResponse.json({ data: { url: checkout.url } });
  } catch (error) {
    if (reservation?.kind === "RESERVED" && !lemonCheckoutCreated) {
      await releaseFounderReservation({
        userId: user.id,
        slotNo: reservation.slotNo,
        reservationToken: reservation.reservationToken,
      }).catch(() => undefined);
    }

    console.error("POST /api/billing/founder-checkout failed:", error);
    return NextResponse.json(
      { error: "Unable to start Founder Trader checkout." },
      { status: 500 },
    );
  }
}
