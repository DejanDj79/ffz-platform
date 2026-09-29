import { NextResponse } from "next/server";
import {
  completeFounderPurchase,
  refundFounderPurchase,
} from "@/lib/billing/founder-repository";
import {
  cancelDodoSubscriptionAtPeriodEnd,
  dodoFounderOrderSnapshotFromWebhook,
  dodoFounderRefundPaymentId,
  dodoFounderRefundSnapshotFromPayment,
  dodoSubscriptionSnapshotFromWebhook,
  getDodoConfig,
  getDodoPaymentDetail,
  isDodoSubscriptionStatus,
  isExpectedDodoFounder,
  isExpectedDodoSubscription,
  verifyDodoWebhookSignature,
  type DodoWebhookPayload,
} from "@/lib/billing/dodo";
import {
  findUserIdByProviderSubscriptionId,
  getUserBillingState,
  syncDodoSubscription,
} from "@/lib/billing/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function syncSubscription(payload: DodoWebhookPayload) {
  const config = getDodoConfig({
    requireWebhook: true,
    requireSubscriptions: true,
    requireFounder: true,
  });
  const snapshot = dodoSubscriptionSnapshotFromWebhook(payload, config);
  if (!snapshot || !isExpectedDodoSubscription(snapshot, config)) {
    return "ignored_subscription_payload";
  }

  const userId = snapshot.userId ??
    await findUserIdByProviderSubscriptionId(snapshot.subscriptionId);
  if (!userId) {
    console.warn(
      "Dodo subscription webhook could not be linked to an FFZ user:",
      snapshot.subscriptionId,
    );
    return "unlinked_subscription";
  }

  const result = await syncDodoSubscription(userId, snapshot);
  return result.applied ? `subscription_${snapshot.status}` : "stale_subscription_event";
}

async function scheduleExistingProCancellation(userId: string) {
  const billing = await getUserBillingState(userId);
  if (billing.provider !== "DODO" || !billing.subscriptionId) {
    return "no_dodo_subscription";
  }

  if (
    billing.status === "cancelled" ||
    billing.status === "expired" ||
    billing.status === "failed"
  ) {
    return "subscription_already_ending";
  }

  await cancelDodoSubscriptionAtPeriodEnd(billing.subscriptionId);
  return "subscription_cancellation_requested";
}

async function processFounderPayment(payload: DodoWebhookPayload) {
  const config = getDodoConfig({
    requireWebhook: true,
    requireSubscriptions: true,
    requireFounder: true,
  });
  const snapshot = dodoFounderOrderSnapshotFromWebhook(payload, config);
  if (!snapshot || !isExpectedDodoFounder(snapshot, config)) {
    return "ignored_payment";
  }

  const result = await completeFounderPurchase(snapshot);
  if ("userId" in result && result.userId) {
    const cancellation = await scheduleExistingProCancellation(result.userId);
    return result.applied
      ? `founder_activated_${cancellation}`
      : `founder_${result.reason}_${cancellation}`;
  }

  return result.applied ? "founder_activated" : `founder_${result.reason}`;
}

async function processFounderRefund(payload: DodoWebhookPayload) {
  const paymentId = dodoFounderRefundPaymentId(payload);
  if (!paymentId) return "ignored_refund";

  const config = getDodoConfig({
    requireWebhook: true,
    requireSubscriptions: true,
    requireFounder: true,
  });
  const payment = await getDodoPaymentDetail(paymentId, config);
  const snapshot = dodoFounderRefundSnapshotFromPayment(payload, payment, config);
  if (!snapshot || !isExpectedDodoFounder(snapshot, config)) {
    return "ignored_partial_or_non_founder_refund";
  }

  const result = await refundFounderPurchase(snapshot);

  // Founder can be purchased by an existing Pro subscriber. If Founder is
  // later fully refunded, restore access from any still-linked Dodo
  // subscription instead of leaving the account at FREE.
  if ("userId" in result && result.userId) {
    const billing = await getUserBillingState(result.userId);
    if (
      billing.provider === "DODO" &&
      billing.subscriptionId &&
      billing.customerId &&
      billing.productId &&
      isDodoSubscriptionStatus(billing.status)
    ) {
      await syncDodoSubscription(result.userId, {
        subscriptionId: billing.subscriptionId,
        customerId: billing.customerId,
        productId: billing.productId,
        status: billing.status,
        renewsAt: billing.renewsAt,
        endsAt: billing.endsAt,
        testMode: billing.testMode ?? config.testMode,
        providerUpdatedAt: billing.providerUpdatedAt ?? snapshot.updatedAt,
        userId: result.userId,
      });
    }
  }

  return result.applied ? "founder_refunded" : `founder_refund_${result.reason}`;
}

async function processPayload(payload: DodoWebhookPayload) {
  const eventType = payload.type ?? "";

  if (eventType.startsWith("subscription.")) {
    return syncSubscription(payload);
  }

  if (eventType === "payment.succeeded") {
    return processFounderPayment(payload);
  }

  if (eventType === "refund.succeeded") {
    return processFounderRefund(payload);
  }

  return "ignored_event_type";
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const config = getDodoConfig({
      requireWebhook: true,
      requireSubscriptions: true,
      requireFounder: true,
    });
    const webhookKey = config.webhookKey as string;

    const valid = verifyDodoWebhookSignature(
      rawBody,
      {
        webhookId: request.headers.get("webhook-id"),
        webhookTimestamp: request.headers.get("webhook-timestamp"),
        webhookSignature: request.headers.get("webhook-signature"),
      },
      webhookKey,
    );

    if (!valid) {
      return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
    }

    const payload = JSON.parse(rawBody) as DodoWebhookPayload;
    if (!payload.type || !payload.data) {
      return NextResponse.json({ error: "Invalid Dodo webhook payload." }, { status: 400 });
    }

    const result = await processPayload(payload);
    return NextResponse.json({
      ok: true,
      event: payload.type,
      webhookId: request.headers.get("webhook-id"),
      result,
    });
  } catch (error) {
    console.error("POST /api/billing/webhook failed:", error);
    return NextResponse.json(
      { error: "Unable to process Dodo Payments webhook." },
      { status: 500 },
    );
  }
}
