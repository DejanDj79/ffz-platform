import { NextResponse } from "next/server";
import { getFounderBillingAvailability } from "@/lib/billing/availability";
import {
  completeFounderPurchase,
  refundFounderPurchase,
} from "@/lib/billing/founder-repository";
import {
  cancelPaddleSubscriptionAfterFounderPurchase,
  getPaddleConfig,
  isExpectedPaddleFounder,
  isExpectedPaddleSubscription,
  isPaddleSubscriptionStatus,
  paddleApprovedFullRefund,
  paddleFounderSnapshotFromWebhook,
  paddleSubscriptionSnapshotFromWebhook,
  verifyPaddleSignature,
  type PaddleWebhookPayload,
} from "@/lib/billing/paddle";
import {
  findUserIdByProviderSubscriptionId,
  getUserBillingState,
  syncPaddleSubscription,
} from "@/lib/billing/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function customUserId(payload: PaddleWebhookPayload) {
  const value = payload.data?.custom_data?.ffz_user_id;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const config = getPaddleConfig({ requireWebhookSecret: true });
    const secret = config.webhookSecret as string;

    if (!verifyPaddleSignature(rawBody, request.headers.get("paddle-signature"), secret)) {
      return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
    }

    const payload = JSON.parse(rawBody) as PaddleWebhookPayload;
    const eventName = payload.event_type ?? "";

    if (eventName.startsWith("subscription.")) {
      const snapshot = paddleSubscriptionSnapshotFromWebhook(payload, config);
      if (!snapshot) {
        return NextResponse.json({ ok: true, ignored: "payload_type" });
      }

      if (!isExpectedPaddleSubscription(snapshot, config)) {
        return NextResponse.json({ ok: true, ignored: "different_product_or_mode" });
      }

      let userId = customUserId(payload);
      if (!userId) {
        userId = await findUserIdByProviderSubscriptionId(snapshot.subscriptionId);
      }

      // Do not guess an FFZ account from customer email. Only subscriptions
      // opened by FFZ (or already linked by subscription ID) get entitlement.
      if (!userId) {
        console.warn("Paddle webhook could not be linked to an FFZ user:", snapshot.subscriptionId);
        return NextResponse.json({ ok: true, ignored: "unlinked_subscription" });
      }

      const result = await syncPaddleSubscription(userId, snapshot);
      return NextResponse.json({
        ok: true,
        event: eventName,
        status: snapshot.status,
        applied: result.applied,
        plan: result.plan,
      });
    }

    if (eventName === "transaction.completed") {
      const founderAvailability = getFounderBillingAvailability();
      if (!founderAvailability.available) {
        return NextResponse.json({ ok: true, ignored: "founder_billing_unavailable" });
      }

      const founderConfig = getPaddleConfig({ requireWebhookSecret: true, requireFounder: true });
      const snapshot = paddleFounderSnapshotFromWebhook(payload, founderConfig);
      if (!snapshot) {
        return NextResponse.json({ ok: true, ignored: "not_founder_transaction" });
      }

      if (!isExpectedPaddleFounder(snapshot, founderConfig)) {
        return NextResponse.json({ ok: true, ignored: "different_founder_price_or_mode" });
      }

      const result = await completeFounderPurchase(snapshot);

      if ("userId" in result && result.userId) {
        const billing = await getUserBillingState(result.userId);
        if (
          billing.provider === "PADDLE" &&
          billing.subscriptionId &&
          billing.status !== "canceled"
        ) {
          if (founderConfig.apiKey) {
            await cancelPaddleSubscriptionAfterFounderPurchase(billing.subscriptionId);
          } else {
            console.warn(
              "Founder activated but PADDLE_API_KEY is not configured; existing Pro subscription was not scheduled for cancellation.",
            );
          }
        }
      }

      return NextResponse.json({
        ok: true,
        event: eventName,
        applied: result.applied,
        reason: result.reason,
        ...("slotNo" in result ? { slotNo: result.slotNo } : {}),
      });
    }

    if (eventName === "adjustment.created" || eventName === "adjustment.updated") {
      const refund = paddleApprovedFullRefund(payload);
      if (!refund) {
        return NextResponse.json({ ok: true, ignored: "not_approved_full_refund" });
      }

      const result = await refundFounderPurchase({
        orderId: refund.transactionId,
        customerId: "",
        storeId: "PADDLE",
        productId: "",
        variantId: "",
        status: "refunded",
        testMode: config.testMode,
        createdAt: refund.updatedAt,
        updatedAt: refund.updatedAt,
        fullyRefunded: true,
        userId: null,
        slotNo: null,
        reservationToken: null,
      });

      // Founder can be bought by an existing Pro subscriber. If Founder is later
      // refunded, recompute access from the still-linked Paddle subscription so
      // the user keeps paid Pro access until that subscription actually ends.
      if ("userId" in result && result.userId) {
        const billing = await getUserBillingState(result.userId);
        if (
          billing.provider === "PADDLE" &&
          billing.subscriptionId &&
          billing.customerId &&
          billing.productId &&
          billing.variantId &&
          isPaddleSubscriptionStatus(billing.status)
        ) {
          await syncPaddleSubscription(result.userId, {
            subscriptionId: billing.subscriptionId,
            customerId: billing.customerId,
            productId: billing.productId,
            priceId: billing.variantId,
            status: billing.status,
            renewsAt: billing.renewsAt,
            endsAt: billing.endsAt,
            testMode: billing.testMode ?? config.testMode,
            providerUpdatedAt: billing.providerUpdatedAt ?? refund.updatedAt,
          });
        }
      }

      return NextResponse.json({
        ok: true,
        event: eventName,
        applied: result.applied,
        reason: result.reason,
        ...("plan" in result ? { plan: result.plan } : {}),
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
