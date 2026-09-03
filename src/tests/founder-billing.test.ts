import { describe, expect, it } from "vitest";
import {
  founderCheckoutExpiresAt,
  founderOrderSnapshotFromWebhook,
  isExpectedFounderOrder,
} from "@/lib/billing/founder";

function orderPayload(overrides: Record<string, unknown> = {}) {
  return {
    meta: {
      event_name: "order_created",
      custom_data: {
        user_id: "user-123",
        founder_slot: "17",
        founder_reservation_token: "4c0f159f-0cf4-4bb7-95e4-f23bce43a0a2",
      },
    },
    data: {
      type: "orders",
      id: "991",
      attributes: {
        store_id: 466440,
        customer_id: 55,
        status: "paid",
        total: 19900,
        refunded: false,
        refunded_amount: 0,
        created_at: "2026-09-04T00:00:00.000Z",
        updated_at: "2026-09-04T00:00:01.000Z",
        test_mode: true,
        first_order_item: {
          product_id: 1336642,
          variant_id: 2088462,
          test_mode: true,
        },
        ...overrides,
      },
    },
  };
}

describe("Founder Lemon order handling", () => {
  it("parses a Founder order and preserves custom FFZ linkage", () => {
    const snapshot = founderOrderSnapshotFromWebhook(orderPayload());

    expect(snapshot).not.toBeNull();
    expect(snapshot).toMatchObject({
      orderId: "991",
      customerId: "55",
      storeId: "466440",
      productId: "1336642",
      variantId: "2088462",
      status: "paid",
      testMode: true,
      userId: "user-123",
      slotNo: 17,
      reservationToken: "4c0f159f-0cf4-4bb7-95e4-f23bce43a0a2",
      fullyRefunded: false,
    });
  });

  it("recognizes a full refund by refunded amount", () => {
    const snapshot = founderOrderSnapshotFromWebhook(orderPayload({
      refunded_amount: 19900,
    }));

    expect(snapshot?.fullyRefunded).toBe(true);
  });

  it("does not classify a partial refund as a full entitlement revocation", () => {
    const snapshot = founderOrderSnapshotFromWebhook(orderPayload({
      refunded_amount: 5000,
    }));

    expect(snapshot?.fullyRefunded).toBe(false);
  });

  it("validates store, variant and test mode before applying Founder access", () => {
    const snapshot = founderOrderSnapshotFromWebhook(orderPayload());
    expect(snapshot).not.toBeNull();

    expect(isExpectedFounderOrder(snapshot!, {
      storeId: "466440",
      variantId: "2088462",
      testMode: true,
    })).toBe(true);

    expect(isExpectedFounderOrder(snapshot!, {
      storeId: "466440",
      variantId: "wrong",
      testMode: true,
    })).toBe(false);
  });

  it("keeps a webhook grace window after checkout expiry", () => {
    const reservationExpiresAt = new Date("2026-09-04T00:35:00.000Z");
    expect(founderCheckoutExpiresAt(reservationExpiresAt).toISOString())
      .toBe("2026-09-04T00:30:00.000Z");
  });
});
