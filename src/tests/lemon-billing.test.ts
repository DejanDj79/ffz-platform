import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  normalizeLemonTestLifecycleEvent,
  planForLemonStatus,
  subscriptionSnapshotFromWebhook,
  verifyLemonSignature,
  type LemonWebhookPayload,
} from "@/lib/billing/lemon";

describe("Lemon Squeezy billing", () => {
  it("keeps access for every subscription state except expired", () => {
    expect(planForLemonStatus("on_trial")).toBe("PRO");
    expect(planForLemonStatus("active")).toBe("PRO");
    expect(planForLemonStatus("paused")).toBe("PRO");
    expect(planForLemonStatus("past_due")).toBe("PRO");
    expect(planForLemonStatus("unpaid")).toBe("PRO");
    expect(planForLemonStatus("cancelled")).toBe("PRO");
    expect(planForLemonStatus("expired")).toBe("FREE");
  });

  it("verifies Lemon webhook HMAC signatures", () => {
    const body = JSON.stringify({ hello: "ffz" });
    const secret = "test-signing-secret";
    const signature = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    expect(verifyLemonSignature(body, signature, secret)).toBe(true);
    expect(verifyLemonSignature(body, "invalid", secret)).toBe(false);
    expect(verifyLemonSignature(body, null, secret)).toBe(false);
  });

  it("extracts subscription state from a Lemon webhook", () => {
    const payload: LemonWebhookPayload = {
      meta: {
        event_name: "subscription_updated",
        custom_data: { user_id: "a-user-id" },
      },
      data: {
        type: "subscriptions",
        id: "12345",
        attributes: {
          store_id: 466440,
          customer_id: 91,
          product_id: 1336641,
          variant_id: 2088449,
          status: "cancelled",
          renews_at: "2026-10-03T00:00:00.000Z",
          ends_at: "2026-10-03T00:00:00.000Z",
          updated_at: "2026-09-03T15:00:00.000Z",
          test_mode: true,
        },
      },
    };

    const snapshot = subscriptionSnapshotFromWebhook(payload);

    expect(snapshot).not.toBeNull();
    expect(snapshot?.subscriptionId).toBe("12345");
    expect(snapshot?.customerId).toBe("91");
    expect(snapshot?.variantId).toBe("2088449");
    expect(snapshot?.status).toBe("cancelled");
    expect(snapshot?.testMode).toBe(true);
    expect(snapshot?.endsAt?.toISOString()).toBe("2026-10-03T00:00:00.000Z");
  });

  it("normalizes simulated test lifecycle events without changing live events", () => {
    const baseSnapshot = {
      subscriptionId: "12345",
      customerId: "91",
      productId: "1336641",
      variantId: "2088449",
      status: "active" as const,
      renewsAt: new Date("2026-10-03T00:00:00.000Z"),
      endsAt: null,
      testMode: true,
      providerUpdatedAt: new Date("2026-09-03T15:00:00.000Z"),
    };

    const expired = normalizeLemonTestLifecycleEvent("subscription_expired", baseSnapshot);
    expect(expired.snapshot.status).toBe("expired");
    expect(expired.bypassStaleGuard).toBe(true);
    expect(planForLemonStatus(expired.snapshot.status)).toBe("FREE");

    const cancelled = normalizeLemonTestLifecycleEvent("subscription_cancelled", baseSnapshot);
    expect(cancelled.snapshot.status).toBe("cancelled");
    expect(cancelled.bypassStaleGuard).toBe(true);
    expect(planForLemonStatus(cancelled.snapshot.status)).toBe("PRO");

    const liveSnapshot = { ...baseSnapshot, testMode: false };
    const liveExpired = normalizeLemonTestLifecycleEvent("subscription_expired", liveSnapshot);
    expect(liveExpired.snapshot.status).toBe("active");
    expect(liveExpired.bypassStaleGuard).toBe(false);
  });

  it("ignores non-subscription webhook payloads", () => {
    const payload: LemonWebhookPayload = {
      meta: { event_name: "order_created" },
      data: {
        type: "orders",
        id: "1",
        attributes: {
          store_id: 466440,
          customer_id: 91,
          product_id: 1336641,
          variant_id: 2088449,
          status: "active",
          updated_at: "2026-09-03T15:00:00.000Z",
          test_mode: true,
        },
      },
    };

    expect(subscriptionSnapshotFromWebhook(payload)).toBeNull();
  });
});
