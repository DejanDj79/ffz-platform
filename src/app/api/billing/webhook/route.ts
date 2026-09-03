import { NextResponse } from "next/server";
import { getFounderBillingAvailability } from "@/lib/billing/availability";
import {
  cancelSubscriptionAfterFounderPurchase,
  founderOrderSnapshotFromWebhook,
  getFounderLemonConfig,
  isExpectedFounderOrder,
  type LemonOrderWebhookPayload,
} from "@/lib/billing/founder";
import {
  completeFounderPurchase,
  refundFounderPurchase,
} from "@/lib/billing/founder-repository";
import {
  getLemonConfig,
  isExpectedLemonSubscription,
  normalizeLemonTestLifecycleEvent,
  subscriptionSnapshotFromWebhook,
  verifyLemonSignature,
  type LemonWebhookPayload,
} from "@/lib/billing/lemon";
import {
  findUserIdByProviderSubscriptionId,
  getUserBillingState,
  syncLemonSubscription,
} from "@/lib/billing/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const config = getLemonConfig({ requireWebhookSecret: true });
    const secret = config.webhookSecret as string;

    if (!verifyLemonSignature(rawBody, request.headers.get("x-signature"), secret)) {
      return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
    }

    const payload = JSON.parse(rawBody) as LemonWebhookPayload & LemonOrderWebhookPayload;
    const eventName = payload.meta?.event_name ?? "";

    if (eventName.startsWith("subscription_")) {
      const rawSnapshot = subscriptionSnapshotFromWebhook(payload);
      if (!rawSnapshot) {
        return NextResponse.json({ ok: true, ignored: "payload_type" });
      }

      if (!isExpectedLemonSubscription(rawSnapshot, config)) {
        return NextResponse.json({ ok: true, ignored: "different_product_or_mode" });
      }

      const lifecycle = normalizeLemonTestLifecycleEvent(eventName, rawSnapshot);
      const snapshot = lifecycle.snapshot;

      const customUserId = payload.meta?.custom_data?.user_id;
      let userId = typeof customUserId === "string" ? customUserId : null;

      if (!userId) {
        userId = await findUserIdByProviderSubscriptionId(snapshot.subscriptionId);
      }

      // A direct Lemon store purchase does not contain our FFZ user ID. Do not
      // guess by email; only FFZ-created checkouts are automatically entitled.
      if (!userId) {
        console.warn("Lemon webhook could not be linked to an FFZ user:", snapshot.subscriptionId);
        return NextResponse.json({ ok: true, ignored: "unlinked_subscription" });
      }

      const result = await syncLemonSubscription(userId, snapshot, {
        bypassStaleGuard: lifecycle.bypassStaleGuard,
      });

      return NextResponse.json({
        ok: true,
        event: eventName,
        status: snapshot.status,
        applied: result.applied,
        plan: result.plan,
      });
    }

    if (eventName === "order_created" || eventName === "order_refunded") {
      const founderAvailability = getFounderBillingAvailability();
      if (!founderAvailability.available) {
        return NextResponse.json({ ok: true, ignored: "founder_billing_unavailable" });
      }

      const snapshot = founderOrderSnapshotFromWebhook(payload);
      if (!snapshot) {
        return NextResponse.json({ ok: true, ignored: "payload_type" });
      }

      const founderConfig = getFounderLemonConfig();
      if (!isExpectedFounderOrder(snapshot, founderConfig)) {
        return NextResponse.json({ ok: true, ignored: "different_founder_variant_or_mode" });
      }

      if (eventName === "order_refunded") {
        const result = await refundFounderPurchase(snapshot);
        return NextResponse.json({
          ok: true,
          event: eventName,
          applied: result.applied,
          reason: result.reason,
        });
      }

      if (snapshot.status !== "paid") {
        return NextResponse.json({ ok: true, ignored: "order_not_paid" });
      }

      const result = await completeFounderPurchase(snapshot);

      if ("userId" in result && result.userId) {
        const billing = await getUserBillingState(result.userId);
        if (
          billing.provider === "LEMON_SQUEEZY" &&
          billing.subscriptionId &&
          billing.status !== "cancelled" &&
          billing.status !== "expired"
        ) {
          await cancelSubscriptionAfterFounderPurchase(billing.subscriptionId);
        }
      }

      return NextResponse.json({
        ok: true,
        event: eventName,
        applied: result.applied,
        reason: result.reason,
        ...( "slotNo" in result ? { slotNo: result.slotNo } : {}),
      });
    }

    return NextResponse.json({ ok: true, ignored: "event_type" });
  } catch (error) {
    console.error("POST /api/billing/webhook failed:", error);
    return NextResponse.json(
      { error: "Unable to process billing webhook." },
      { status: 500 },
    );
  }
}
