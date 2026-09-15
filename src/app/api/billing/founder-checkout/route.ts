import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getFastSpringFounderAvailability } from "@/lib/billing/availability";
import { reserveFounderSlot } from "@/lib/billing/founder-repository";
import { getFastSpringConfig } from "@/lib/billing/fastspring";
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

  const availability = getFastSpringFounderAvailability();
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

    const config = getFastSpringConfig();

    return NextResponse.json({
      data: {
        checkout: {
          provider: "FASTSPRING",
          productPath: config.founderProductPath,
          customerEmail: user.email,
          testMode: config.testMode,
          tags: {
            ffz_user_id: user.id,
            ffz_plan: "FOUNDER",
            founder_slot: String(reservation.slotNo),
            founder_reservation_token: reservation.reservationToken,
            ...(returnTo ? { return_to: returnTo } : {}),
            ...(feature ? { feature } : {}),
          },
        },
      },
    });
  } catch (error) {
    console.error("POST /api/billing/founder-checkout failed:", error);
    return NextResponse.json(
      { error: "Unable to start Founder Trader checkout." },
      { status: 500 },
    );
  }
}
