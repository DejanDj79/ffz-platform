import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  isExpectedPaddleFounder,
  isExpectedPaddleSubscription,
  paddleApprovedFullRefund,
  paddleFounderSnapshotFromWebhook,
  paddleSubscriptionSnapshotFromWebhook,
  planForPaddleStatus,
  verifyPaddleSignature,
  type PaddleConfig,
  type PaddleWebhookPayload,
} from "@/lib/billing/paddle";

const config: PaddleConfig = {
  clientToken: "test_ffz",
  webhookSecret: "secret",
  apiKey: null,
  monthlyPriceId: "pri_monthly",
  annualPriceId: "pri_annual",
  founderPriceId: "pri_founder",
  environment: "sandbox",
  testMode: true,
};

describe("Paddle billing", () => {
  it("maps active lifecycle states to PRO and terminal/paused states to FREE", () => {
    expect(planForPaddleStatus("active")).toBe("PRO");
    expect(planForPaddleStatus("trialing")).toBe("PRO");
    expect(planForPaddleStatus("past_due")).toBe("PRO");
    expect(planForPaddleStatus("paused")).toBe("FREE");
    expect(planForPaddleStatus("canceled")).toBe("FREE");
  });

  it("verifies Paddle webhook signatures", () => {
    const body = JSON.stringify({ event_type: "subscription.updated" });
    const timestamp = "1789257600";
    const signature = crypto
      .createHmac("sha256", "secret")
      .update(`${timestamp}:${body}`)
      .digest("hex");

    expect(verifyPaddleSignature(
      body,
      `ts=${timestamp};h1=${signature}`,
      "secret",
      { nowMs: Number(timestamp) * 1000 },
    )).toBe(true);
    expect(verifyPaddleSignature(
      body,
      `ts=${timestamp};h1=bad`,
      "secret",
      { nowMs: Number(timestamp) * 1000 },
    )).toBe(false);
  });

  it("extracts an expected subscription snapshot", () => {
    const payload: PaddleWebhookPayload = {
      event_type: "subscription.updated",
      occurred_at: "2026-09-13T12:00:00.000Z",
      data: {
        id: "sub_123",
        customer_id: "ctm_123",
        status: "active",
        items: [{
          price: {
            id: "pri_monthly",
            product_id: "pro_123",
          },
        }],
        next_billed_at: "2026-10-13T12:00:00.000Z",
        current_billing_period: {
          starts_at: "2026-09-13T12:00:00.000Z",
          ends_at: "2026-10-13T12:00:00.000Z",
        },
        custom_data: {
          ffz_user_id: "user-123",
        },
        updated_at: "2026-09-13T12:00:01.000Z",
      },
    };

    const snapshot = paddleSubscriptionSnapshotFromWebhook(payload, config);
    expect(snapshot).not.toBeNull();
    expect(snapshot).toMatchObject({
      subscriptionId: "sub_123",
      customerId: "ctm_123",
      productId: "pro_123",
      priceId: "pri_monthly",
      status: "active",
      testMode: true,
    });
    expect(snapshot?.renewsAt?.toISOString()).toBe("2026-10-13T12:00:00.000Z");
    expect(isExpectedPaddleSubscription(snapshot!, config)).toBe(true);
  });

  it("ignores subscriptions for unrelated prices", () => {
    const payload: PaddleWebhookPayload = {
      event_type: "subscription.updated",
      occurred_at: "2026-09-13T12:00:00.000Z",
      data: {
        id: "sub_other",
        customer_id: "ctm_123",
        status: "active",
        items: [{ price: { id: "pri_other", product_id: "pro_other" } }],
        updated_at: "2026-09-13T12:00:01.000Z",
      },
    };

    expect(paddleSubscriptionSnapshotFromWebhook(payload, config)).toBeNull();
  });

  it("extracts Founder custom linkage from a completed one-time transaction", () => {
    const payload: PaddleWebhookPayload = {
      event_type: "transaction.completed",
      occurred_at: "2026-09-13T12:00:00.000Z",
      data: {
        id: "txn_founder",
        customer_id: "ctm_123",
        subscription_id: null,
        status: "completed",
        items: [{
          price: {
            id: "pri_founder",
            product_id: "pro_founder",
          },
        }],
        custom_data: {
          ffz_user_id: "user-123",
          ffz_plan: "FOUNDER",
          founder_slot: "17",
          founder_reservation_token: "4c0f159f-0cf4-4bb7-95e4-f23bce43a0a2",
        },
        created_at: "2026-09-13T12:00:00.000Z",
        updated_at: "2026-09-13T12:00:01.000Z",
      },
    };

    const snapshot = paddleFounderSnapshotFromWebhook(payload, config);
    expect(snapshot).not.toBeNull();
    expect(snapshot).toMatchObject({
      orderId: "txn_founder",
      customerId: "ctm_123",
      productId: "pro_founder",
      variantId: "pri_founder",
      status: "completed",
      testMode: true,
      userId: "user-123",
      slotNo: 17,
      reservationToken: "4c0f159f-0cf4-4bb7-95e4-f23bce43a0a2",
    });
    expect(isExpectedPaddleFounder(snapshot!, config)).toBe(true);
  });

  it("extracts a directly full approved Founder refund", () => {
    const payload: PaddleWebhookPayload = {
      event_type: "adjustment.updated",
      occurred_at: "2026-09-13T12:30:00.000Z",
      data: {
        id: "adj_123",
        action: "refund",
        type: "full",
        status: "approved",
        transaction_id: "txn_founder",
        updated_at: "2026-09-13T12:30:00.000Z",
      },
    };

    expect(paddleApprovedFullRefund(payload)).toMatchObject({
      transactionId: "txn_founder",
    });
  });

  it("does not treat recurring completed transactions as Founder purchases", () => {
    const payload: PaddleWebhookPayload = {
      event_type: "transaction.completed",
      occurred_at: "2026-09-13T12:00:00.000Z",
      data: {
        id: "txn_recurring",
        customer_id: "ctm_123",
        subscription_id: "sub_123",
        status: "completed",
        items: [{ price: { id: "pri_founder", product_id: "pro_founder" } }],
        updated_at: "2026-09-13T12:00:01.000Z",
      },
    };

    expect(paddleFounderSnapshotFromWebhook(payload, config)).toBeNull();
  });
});
