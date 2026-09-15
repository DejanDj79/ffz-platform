import { NextResponse } from "next/server";
import {
  completeFounderPurchase,
  refundFounderPurchase,
} from "@/lib/billing/founder-repository";
import {
  cancelFastSpringSubscriptionAtPeriodEnd,
  fastSpringFounderOrderSnapshotFromEvent,
  fastSpringFounderRefundSnapshotFromEvent,
  fastSpringSubscriptionSnapshotFromEvent,
  fastSpringSubscriptionSnapshotFromOrder,
  getFastSpringConfig,
  getFastSpringWebhookSecret,
  isExpectedFastSpringFounder,
  isExpectedFastSpringSubscription,
  isFastSpringSubscriptionStatus,
  verifyFastSpringSignature,
  type FastSpringWebhookEvent,
  type FastSpringWebhookPayload,
} from "@/lib/billing/fastspring";
import {
  findUserIdByProviderSubscriptionId,
  getUserBillingState,
  syncFastSpringSubscription,
} from "@/lib/billing/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EventResult = {
  eventId: string | null;
  type: string;
  result: string;
};

async function syncSubscriptionEvent(event: FastSpringWebhookEvent) {
  const config = getFastSpringConfig();
  const snapshot = fastSpringSubscriptionSnapshotFromEvent(event, config);
  if (!snapshot || !isExpectedFastSpringSubscription(snapshot, config)) {
    return "ignored_subscription_payload";
  }

  const userId = snapshot.userId ??
    await findUserIdByProviderSubscriptionId(snapshot.subscriptionId);
  if (!userId) {
    console.warn(
      "FastSpring subscription webhook could not be linked to an FFZ user:",
      snapshot.subscriptionId,
    );
    return "unlinked_subscription";
  }

  const result = await syncFastSpringSubscription(userId, snapshot);
  return result.applied ? `subscription_${snapshot.status}` : "stale_subscription_event";
}

async function scheduleExistingProCancellation(userId: string) {
  const billing = await getUserBillingState(userId);
  if (billing.provider !== "FASTSPRING" || !billing.subscriptionId) {
    return "no_fastspring_subscription";
  }

  if (billing.status === "canceled" || billing.status === "deactivated") {
    return "subscription_already_ending";
  }

  if (!isFastSpringSubscriptionStatus(billing.status)) {
    return "subscription_status_not_cancelable";
  }

  await cancelFastSpringSubscriptionAtPeriodEnd(billing.subscriptionId);
  return "subscription_cancellation_requested";
}

async function processCompletedOrder(event: FastSpringWebhookEvent) {
  const config = getFastSpringConfig();

  const founder = fastSpringFounderOrderSnapshotFromEvent(event, config);
  if (founder && isExpectedFastSpringFounder(founder, config)) {
    const result = await completeFounderPurchase(founder);

    // Retrying an order webhook after a transient API failure is safe: the
    // Founder purchase is idempotent, and already-processed results include
    // the user id so the Pro cancellation can be retried independently.
    if ("userId" in result && result.userId) {
      const cancellation = await scheduleExistingProCancellation(result.userId);
      return result.applied
        ? `founder_activated_${cancellation}`
        : `founder_${result.reason}_${cancellation}`;
    }

    return result.applied ? "founder_activated" : `founder_${result.reason}`;
  }

  const subscription = fastSpringSubscriptionSnapshotFromOrder(event, config);
  if (!subscription || !isExpectedFastSpringSubscription(subscription, config)) {
    return "ignored_order";
  }

  const userId = subscription.userId ??
    await findUserIdByProviderSubscriptionId(subscription.subscriptionId);
  if (!userId) {
    console.warn(
      "FastSpring order webhook could not be linked to an FFZ user:",
      subscription.subscriptionId,
    );
    return "unlinked_order";
  }

  const result = await syncFastSpringSubscription(userId, subscription);
  return result.applied ? "pro_activated_from_order" : "stale_order_event";
}

async function processReturn(event: FastSpringWebhookEvent) {
  const config = getFastSpringConfig();
  const refund = fastSpringFounderRefundSnapshotFromEvent(event, config);
  if (!refund || !isExpectedFastSpringFounder(refund, config)) {
    return "ignored_return";
  }

  const result = await refundFounderPurchase(refund);

  // A Founder buyer may also have an active FastSpring Pro subscription.
  // refundFounderPurchase removes the Founder entitlement first; restore Pro
  // immediately when a linked subscription is still entitled to access.
  if ("userId" in result && result.userId) {
    const billing = await getUserBillingState(result.userId);
    if (
      billing.provider === "FASTSPRING" &&
      billing.subscriptionId &&
      billing.customerId &&
      billing.productId &&
      isFastSpringSubscriptionStatus(billing.status)
    ) {
      await syncFastSpringSubscription(result.userId, {
        subscriptionId: billing.subscriptionId,
        customerId: billing.customerId,
        productId: billing.productId,
        status: billing.status,
        renewsAt: billing.renewsAt,
        endsAt: billing.endsAt,
        testMode: billing.testMode ?? config.testMode,
        providerUpdatedAt: refund.updatedAt,
        userId: result.userId,
      });
    }
  }

  return result.applied ? "founder_refunded" : `founder_refund_${result.reason}`;
}

async function processEvent(event: FastSpringWebhookEvent) {
  const type = event.type ?? "";

  if (type === "order.completed") {
    return processCompletedOrder(event);
  }

  if (type === "return.created") {
    return processReturn(event);
  }

  if (type.startsWith("subscription.")) {
    return syncSubscriptionEvent(event);
  }

  return "ignored_event_type";
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const secret = getFastSpringWebhookSecret();

    if (!verifyFastSpringSignature(rawBody, request.headers.get("x-fs-signature"), secret)) {
      return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
    }

    const payload = JSON.parse(rawBody) as FastSpringWebhookPayload;
    if (!Array.isArray(payload.events)) {
      return NextResponse.json({ error: "Invalid FastSpring webhook payload." }, { status: 400 });
    }

    const results: EventResult[] = [];
    for (const event of payload.events) {
      results.push({
        eventId: event.id ?? null,
        type: event.type ?? "unknown",
        result: await processEvent(event),
      });
    }

    return NextResponse.json({ ok: true, processed: results.length, results });
  } catch (error) {
    console.error("POST /api/billing/fastspring/webhook failed:", error);
    return NextResponse.json(
      { error: "Unable to process FastSpring webhook." },
      { status: 500 },
    );
  }
}
