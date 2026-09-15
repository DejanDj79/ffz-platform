import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  fastSpringFounderOrderSnapshotFromEvent,
  fastSpringFounderRefundSnapshotFromEvent,
  fastSpringSubscriptionSnapshotFromEvent,
  fastSpringSubscriptionSnapshotFromOrder,
  isExpectedFastSpringFounder,
  isExpectedFastSpringSubscription,
  planForFastSpringStatus,
  verifyFastSpringSignature,
  type FastSpringWebhookEvent,
} from "@/lib/billing/fastspring";

const config = {
  storefront: "ffzplatform.test.onfastspring.com/popup-ffzplatform",
  monthlyProductPath: "pro-monthly",
  annualProductPath: "pro-yearly",
  founderProductPath: "founder-trader",
  testMode: true,
};

describe("FastSpring billing", () => {
  it("maps lifecycle states while preserving access until deactivation", () => {
    expect(planForFastSpringStatus("active")).toBe("PRO");
    expect(planForFastSpringStatus("trial")).toBe("PRO");
    expect(planForFastSpringStatus("overdue")).toBe("PRO");
    expect(planForFastSpringStatus("canceled")).toBe("PRO");
    expect(planForFastSpringStatus("deactivated")).toBe("FREE");
  });

  it("verifies FastSpring HMAC SHA256 signatures using the raw body", () => {
    const body = JSON.stringify({ events: [{ type: "order.completed" }] });
    const signature = crypto
      .createHmac("sha256", "secret")
      .update(body, "utf8")
      .digest("base64");

    expect(verifyFastSpringSignature(body, signature, "secret")).toBe(true);
    expect(verifyFastSpringSignature(body, "invalid", "secret")).toBe(false);
    expect(verifyFastSpringSignature(body, null, "secret")).toBe(false);
  });

  it("extracts an expanded subscription activation with FFZ order tags", () => {
    const event: FastSpringWebhookEvent = {
      id: "evt-sub-1",
      type: "subscription.activated",
      live: false,
      created: 1_789_257_600_000,
      data: {
        id: "sub_123",
        subscription: "sub_123",
        active: true,
        state: "active",
        live: false,
        changed: 1_789_257_601_000,
        account: {
          id: "acct_123",
          account: "acct_123",
        },
        product: {
          product: "pro-yearly",
        },
        next: 1_820_793_600_000,
        nextChargeDate: 1_820_793_600_000,
        tags: {
          ffz_user_id: "user-123",
          ffz_plan: "PRO",
          billing_interval: "ANNUAL",
        },
      },
    };

    const snapshot = fastSpringSubscriptionSnapshotFromEvent(event, config);
    expect(snapshot).toMatchObject({
      subscriptionId: "sub_123",
      customerId: "acct_123",
      productId: "pro-yearly",
      status: "active",
      testMode: true,
      userId: "user-123",
    });
    expect(snapshot?.renewsAt?.toISOString()).toBe("2027-09-13T00:00:00.000Z");
    expect(isExpectedFastSpringSubscription(snapshot!, config)).toBe(true);
  });

  it("extracts a subscription from the initial completed order", () => {
    const event: FastSpringWebhookEvent = {
      id: "evt-order-pro",
      type: "order.completed",
      live: false,
      data: {
        id: "order_pro",
        changed: 1_789_257_601_000,
        live: false,
        account: {
          id: "acct_123",
        },
        tags: {
          ffz_user_id: "user-123",
          ffz_plan: "PRO",
        },
        items: [
          {
            product: "pro-monthly",
            quantity: 1,
            subscription: "sub_123",
          },
        ],
      },
    };

    const snapshot = fastSpringSubscriptionSnapshotFromOrder(event, config);
    expect(snapshot).toMatchObject({
      subscriptionId: "sub_123",
      customerId: "acct_123",
      productId: "pro-monthly",
      status: "active",
      testMode: true,
      userId: "user-123",
    });
    expect(isExpectedFastSpringSubscription(snapshot!, config)).toBe(true);
  });

  it("extracts Founder reservation linkage from a completed order", () => {
    const event: FastSpringWebhookEvent = {
      id: "evt-order-founder",
      type: "order.completed",
      live: false,
      data: {
        id: "order_founder",
        changed: 1_789_257_601_000,
        live: false,
        account: {
          id: "acct_founder",
        },
        tags: {
          ffz_user_id: "user-founder",
          ffz_plan: "FOUNDER",
          founder_slot: "17",
          founder_reservation_token: "4c0f159f-0cf4-4bb7-95e4-f23bce43a0a2",
        },
        items: [
          {
            product: "founder-trader",
            quantity: 1,
          },
        ],
      },
    };

    const snapshot = fastSpringFounderOrderSnapshotFromEvent(event, config);
    expect(snapshot).toMatchObject({
      orderId: "order_founder",
      customerId: "acct_founder",
      productId: "founder-trader",
      variantId: "founder-trader",
      status: "completed",
      testMode: true,
      userId: "user-founder",
      slotNo: 17,
      reservationToken: "4c0f159f-0cf4-4bb7-95e4-f23bce43a0a2",
    });
    expect(isExpectedFastSpringFounder(snapshot!, config)).toBe(true);
  });

  it("recognizes a full Founder return against the original order", () => {
    const event: FastSpringWebhookEvent = {
      id: "evt-return-founder",
      type: "return.created",
      live: false,
      data: {
        return: "return_123",
        changed: 1_789_261_200_000,
        live: false,
        account: {
          id: "acct_founder",
        },
        original: {
          id: "order_founder",
          order: "order_founder",
          account: "acct_founder",
        },
        items: [
          {
            product: "founder-trader",
            quantity: 1,
            refundType: "Full Refund",
          },
        ],
      },
    };

    const snapshot = fastSpringFounderRefundSnapshotFromEvent(event, config);
    expect(snapshot).toMatchObject({
      orderId: "order_founder",
      customerId: "acct_founder",
      productId: "founder-trader",
      status: "refunded",
      fullyRefunded: true,
      testMode: true,
    });
  });

  it("ignores unrelated product paths", () => {
    const event: FastSpringWebhookEvent = {
      type: "subscription.activated",
      live: false,
      data: {
        id: "sub_other",
        state: "active",
        account: "acct_123",
        product: "other-product",
        live: false,
      },
    };

    const snapshot = fastSpringSubscriptionSnapshotFromEvent(event, config);
    expect(snapshot).not.toBeNull();
    expect(isExpectedFastSpringSubscription(snapshot!, config)).toBe(false);
  });
});
