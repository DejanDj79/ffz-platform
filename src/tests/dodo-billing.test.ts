import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  cancelDodoSubscriptionAtPeriodEnd,
  createDodoCheckoutSession,
  createDodoCustomerPortalSession,
  dodoFounderOrderSnapshotFromWebhook,
  dodoFounderRefundSnapshotFromPayment,
  dodoSubscriptionSnapshotFromWebhook,
  isExpectedDodoFounder,
  isExpectedDodoSubscription,
  planForDodoStatus,
  verifyDodoWebhookSignature,
  type DodoConfig,
  type DodoWebhookPayload,
} from "@/lib/billing/dodo";

const config: DodoConfig = {
  apiKey: "test_api_key",
  webhookKey: "whsec_test",
  environment: "test_mode",
  baseUrl: "https://test.dodopayments.com",
  testMode: true,
  monthlyProductId: "pdt_monthly",
  annualProductId: "pdt_annual",
  founderProductId: "pdt_founder",
};

describe("Dodo Payments billing", () => {
  it("maps only active subscriptions to Pro", () => {
    expect(planForDodoStatus("active")).toBe("PRO");
    expect(planForDodoStatus("on_hold")).toBe("FREE");
    expect(planForDodoStatus("paused")).toBe("FREE");
    expect(planForDodoStatus("cancelled")).toBe("FREE");
    expect(planForDodoStatus("failed")).toBe("FREE");
    expect(planForDodoStatus("expired")).toBe("FREE");
  });

  it("verifies Standard Webhooks signatures and rejects stale timestamps", () => {
    const rawBody = JSON.stringify({ type: "subscription.active" });
    const webhookId = "msg_test_123";
    const timestamp = "1790596800";
    const rawSecret = Buffer.from("ffz-dodo-test-secret", "utf8");
    const secret = `whsec_${rawSecret.toString("base64")}`;
    const signature = crypto
      .createHmac("sha256", rawSecret)
      .update(`${webhookId}.${timestamp}.${rawBody}`, "utf8")
      .digest("base64");

    expect(verifyDodoWebhookSignature(
      rawBody,
      {
        webhookId,
        webhookTimestamp: timestamp,
        webhookSignature: `v1,${signature}`,
      },
      secret,
      Number(timestamp),
    )).toBe(true);

    expect(verifyDodoWebhookSignature(
      rawBody,
      {
        webhookId,
        webhookTimestamp: timestamp,
        webhookSignature: `v1,${signature}`,
      },
      secret,
      Number(timestamp) + 301,
    )).toBe(false);
  });

  it("extracts an active subscription and FFZ user metadata", () => {
    const payload: DodoWebhookPayload = {
      type: "subscription.active",
      timestamp: "2026-09-28T12:00:00.000Z",
      data: {
        payload_type: "Subscription",
        subscription_id: "sub_123",
        product_id: "pdt_annual",
        status: "active",
        customer: {
          customer_id: "cus_123",
          email: "demo@ffz.app",
        },
        next_billing_date: "2027-09-28T12:00:00.000Z",
        cancel_at_next_billing_date: false,
        metadata: {
          ffz_user_id: "user-123",
          ffz_plan: "PRO",
          billing_interval: "ANNUAL",
        },
      },
    };

    const snapshot = dodoSubscriptionSnapshotFromWebhook(payload, config);
    expect(snapshot).toMatchObject({
      subscriptionId: "sub_123",
      customerId: "cus_123",
      productId: "pdt_annual",
      status: "active",
      testMode: true,
      userId: "user-123",
    });
    expect(snapshot?.renewsAt?.toISOString()).toBe("2027-09-28T12:00:00.000Z");
    expect(snapshot?.endsAt).toBeNull();
    expect(isExpectedDodoSubscription(snapshot!, config)).toBe(true);
  });

  it("keeps Pro active but records the access end when cancellation is scheduled", () => {
    const payload: DodoWebhookPayload = {
      type: "subscription.updated",
      timestamp: "2026-09-28T12:00:00.000Z",
      data: {
        payload_type: "Subscription",
        subscription_id: "sub_123",
        product_id: "pdt_monthly",
        status: "active",
        customer_id: "cus_123",
        next_billing_date: "2026-10-28T12:00:00.000Z",
        cancel_at_next_billing_date: true,
        metadata: { ffz_user_id: "user-123" },
      },
    };

    const snapshot = dodoSubscriptionSnapshotFromWebhook(payload, config);
    expect(snapshot?.status).toBe("active");
    expect(snapshot?.renewsAt).toBeNull();
    expect(snapshot?.endsAt?.toISOString()).toBe("2026-10-28T12:00:00.000Z");
    expect(planForDodoStatus(snapshot!.status)).toBe("PRO");
  });

  it("extracts Founder linkage from a successful one-time payment", () => {
    const payload: DodoWebhookPayload = {
      type: "payment.succeeded",
      timestamp: "2026-09-28T12:00:00.000Z",
      data: {
        payload_type: "Payment",
        payment_id: "pay_founder",
        customer: { customer_id: "cus_founder" },
        product_cart: [{ product_id: "pdt_founder", quantity: 1 }],
        metadata: {
          ffz_user_id: "user-founder",
          ffz_plan: "FOUNDER",
          founder_slot: "17",
          founder_reservation_token: "4c0f159f-0cf4-4bb7-95e4-f23bce43a0a2",
        },
      },
    };

    const snapshot = dodoFounderOrderSnapshotFromWebhook(payload, config);
    expect(snapshot).toMatchObject({
      orderId: "pay_founder",
      customerId: "cus_founder",
      storeId: "DODO",
      productId: "pdt_founder",
      variantId: "pdt_founder",
      status: "succeeded",
      testMode: true,
      userId: "user-founder",
      slotNo: 17,
      reservationToken: "4c0f159f-0cf4-4bb7-95e4-f23bce43a0a2",
    });
    expect(isExpectedDodoFounder(snapshot!, config)).toBe(true);
  });

  it("revokes Founder only after the payment detail confirms a full refund", () => {
    const payload: DodoWebhookPayload = {
      type: "refund.succeeded",
      timestamp: "2026-09-28T13:00:00.000Z",
      data: {
        payload_type: "Refund",
        refund_id: "ref_123",
        payment_id: "pay_founder",
        amount: 19900,
      },
    };

    const full = dodoFounderRefundSnapshotFromPayment(payload, {
      payment_id: "pay_founder",
      refund_status: "full",
      customer: { customer_id: "cus_founder" },
      product_cart: [{ product_id: "pdt_founder", quantity: 1 }],
    }, config);
    expect(full).toMatchObject({
      orderId: "pay_founder",
      fullyRefunded: true,
      productId: "pdt_founder",
      status: "refunded",
    });

    const partial = dodoFounderRefundSnapshotFromPayment(payload, {
      payment_id: "pay_founder",
      refund_status: "partial",
      product_cart: [{ product_id: "pdt_founder", quantity: 1 }],
    }, config);
    expect(partial).toBeNull();
  });

  it("creates hosted checkout sessions with FFZ metadata", async () => {
    let requestedUrl = "";
    let requestedInit: RequestInit | undefined;
    const request = (async (input: string | URL | Request, init?: RequestInit) => {
      requestedUrl = String(input);
      requestedInit = init;
      return Response.json({
        checkout_url: "https://checkout.dodopayments.com/session/cks_123",
        session_id: "cks_123",
      });
    }) as typeof fetch;

    const result = await createDodoCheckoutSession({
      productId: "pdt_monthly",
      email: "demo@ffz.app",
      returnUrl: "https://ffz.app/upgrade?checkout=success",
      cancelUrl: "https://ffz.app/upgrade",
      metadata: {
        ffz_user_id: "user-123",
        ffz_plan: "PRO",
      },
    }, config, request);

    expect(result.url).toContain("checkout.dodopayments.com");
    expect(requestedUrl).toBe("https://test.dodopayments.com/checkouts");
    expect(requestedInit?.method).toBe("POST");
    expect(requestedInit?.headers).toMatchObject({
      Authorization: "Bearer test_api_key",
    });
    expect(JSON.parse(String(requestedInit?.body))).toMatchObject({
      product_cart: [{ product_id: "pdt_monthly", quantity: 1 }],
      customer: { email: "demo@ffz.app" },
      metadata: { ffz_user_id: "user-123", ffz_plan: "PRO" },
      feature_flags: {
        redirect_immediately: true,
        allow_discount_code: true,
      },
    });
  });

  it("surfaces Dodo checkout validation details", async () => {
    const request = (async () => Response.json({
      detail: [
        {
          loc: ["body", "product_cart", 0, "product_id"],
          msg: "Product not found in this environment",
          type: "value_error",
        },
      ],
    }, { status: 422 })) as typeof fetch;

    await expect(createDodoCheckoutSession({
      productId: "pdt_wrong_environment",
      email: "demo@ffz.app",
      returnUrl: "https://ffz.app/upgrade?checkout=success",
      metadata: {
        ffz_user_id: "user-123",
        ffz_plan: "PRO",
      },
    }, config, request)).rejects.toThrow(
      /Dodo Payments checkout creation failed \(422\).*Product not found in this environment/,
    );
  });

  it("creates a customer portal session and schedules cancellation at period end", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const request = (async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      if (String(input).includes("customer-portal")) {
        return Response.json({ link: "https://customer.dodopayments.com/session/test" });
      }
      return new Response(null, { status: 200 });
    }) as typeof fetch;

    const portal = await createDodoCustomerPortalSession("cus/123", config, request);
    expect(portal).toContain("customer.dodopayments.com");

    await cancelDodoSubscriptionAtPeriodEnd("sub/123", config, request);

    expect(calls[0]?.url).toBe(
      "https://test.dodopayments.com/customers/cus%2F123/customer-portal/session",
    );
    expect(calls[1]?.url).toBe(
      "https://test.dodopayments.com/subscriptions/sub%2F123",
    );
    expect(calls[1]?.init?.method).toBe("PATCH");
    expect(JSON.parse(String(calls[1]?.init?.body))).toEqual({
      cancel_at_next_billing_date: true,
    });
  });
});
