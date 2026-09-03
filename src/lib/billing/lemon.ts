import crypto from "node:crypto";
import type { UserPlan } from "@/lib/monetization/types";

export const LEMON_SUBSCRIPTION_STATUSES = [
  "on_trial",
  "active",
  "paused",
  "past_due",
  "unpaid",
  "cancelled",
  "expired",
] as const;

export type LemonSubscriptionStatus =
  (typeof LEMON_SUBSCRIPTION_STATUSES)[number];

export type BillingInterval = "MONTHLY" | "ANNUAL";

export type LemonSubscriptionSnapshot = {
  subscriptionId: string;
  customerId: string;
  productId: string;
  variantId: string;
  status: LemonSubscriptionStatus;
  renewsAt: Date | null;
  endsAt: Date | null;
  testMode: boolean;
  providerUpdatedAt: Date;
};

type LemonConfig = {
  apiKey: string;
  webhookSecret: string | null;
  storeId: string;
  productId: string;
  monthlyVariantId: string;
  annualVariantId: string;
  testMode: boolean;
};

type CheckoutResponse = {
  data?: {
    attributes?: {
      url?: string;
    };
  };
  errors?: Array<{ detail?: string; title?: string }>;
};

type SubscriptionResponse = {
  data?: {
    attributes?: {
      urls?: {
        customer_portal?: string | null;
      };
    };
  };
  errors?: Array<{ detail?: string; title?: string }>;
};

export type LemonWebhookPayload = {
  meta?: {
    event_name?: string;
    custom_data?: Record<string, unknown>;
  };
  data?: {
    type?: string;
    id?: string;
    attributes?: {
      store_id?: number | string;
      customer_id?: number | string;
      product_id?: number | string;
      variant_id?: number | string;
      status?: string;
      renews_at?: string | null;
      ends_at?: string | null;
      updated_at?: string;
      test_mode?: boolean;
    };
  };
};

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export function getLemonConfig(options: { requireWebhookSecret?: boolean } = {}): LemonConfig {
  const webhookSecret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET?.trim() || null;

  if (options.requireWebhookSecret && !webhookSecret) {
    throw new Error("LEMONSQUEEZY_WEBHOOK_SECRET is not configured.");
  }

  return {
    apiKey: required("LEMONSQUEEZY_API_KEY"),
    webhookSecret,
    storeId: required("LEMONSQUEEZY_STORE_ID"),
    productId: required("LEMONSQUEEZY_PRODUCT_ID"),
    monthlyVariantId: required("LEMONSQUEEZY_MONTHLY_VARIANT_ID"),
    annualVariantId: required("LEMONSQUEEZY_ANNUAL_VARIANT_ID"),
    testMode: (process.env.LEMONSQUEEZY_TEST_MODE ?? "true").toLowerCase() === "true",
  };
}

function lemonHeaders(apiKey: string) {
  return {
    Accept: "application/vnd.api+json",
    "Content-Type": "application/vnd.api+json",
    Authorization: `Bearer ${apiKey}`,
  };
}

function errorMessage(payload: { errors?: Array<{ detail?: string; title?: string }> }, fallback: string) {
  return payload.errors?.[0]?.detail || payload.errors?.[0]?.title || fallback;
}

export async function createLemonCheckout(input: {
  userId: string;
  email: string;
  name?: string | null;
  interval: BillingInterval;
  redirectUrl: string;
}) {
  const config = getLemonConfig();
  const variantId = input.interval === "ANNUAL"
    ? config.annualVariantId
    : config.monthlyVariantId;

  const response = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
    method: "POST",
    headers: lemonHeaders(config.apiKey),
    cache: "no-store",
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          product_options: {
            redirect_url: input.redirectUrl,
          },
          checkout_options: {
            embed: false,
            media: true,
            logo: true,
            desc: true,
            discount: true,
            subscription_preview: true,
          },
          checkout_data: {
            email: input.email,
            ...(input.name ? { name: input.name } : {}),
            custom: {
              user_id: input.userId,
              ffz_plan: "PRO",
              billing_interval: input.interval,
            },
          },
        },
        relationships: {
          store: {
            data: { type: "stores", id: config.storeId },
          },
          variant: {
            data: { type: "variants", id: variantId },
          },
        },
      },
    }),
  });

  const payload = await response.json() as CheckoutResponse;
  const url = payload.data?.attributes?.url;

  if (!response.ok || !url) {
    throw new Error(errorMessage(payload, `Unable to create Lemon Squeezy checkout (${response.status}).`));
  }

  return url;
}

export async function getLemonCustomerPortal(subscriptionId: string) {
  const config = getLemonConfig();
  const response = await fetch(
    `https://api.lemonsqueezy.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
    {
      headers: lemonHeaders(config.apiKey),
      cache: "no-store",
    },
  );

  const payload = await response.json() as SubscriptionResponse;
  const url = payload.data?.attributes?.urls?.customer_portal;

  if (!response.ok || !url) {
    throw new Error(errorMessage(payload, `Unable to open Lemon Squeezy customer portal (${response.status}).`));
  }

  return url;
}

export function isLemonSubscriptionStatus(value: unknown): value is LemonSubscriptionStatus {
  return typeof value === "string" &&
    (LEMON_SUBSCRIPTION_STATUSES as readonly string[]).includes(value);
}

export function planForLemonStatus(status: LemonSubscriptionStatus): UserPlan {
  return status === "expired" ? "FREE" : "PRO";
}

export function verifyLemonSignature(rawBody: string, signature: string | null, secret: string) {
  if (!signature) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "utf8");
  const signatureBuffer = Buffer.from(signature, "utf8");

  return expectedBuffer.length === signatureBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

function optionalDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function subscriptionSnapshotFromWebhook(payload: LemonWebhookPayload) {
  const data = payload.data;
  const attributes = data?.attributes;

  if (data?.type !== "subscriptions" || !data.id || !attributes) return null;
  if (!isLemonSubscriptionStatus(attributes.status)) return null;
  if (attributes.customer_id == null || attributes.product_id == null || attributes.variant_id == null) {
    return null;
  }

  const providerUpdatedAt = optionalDate(attributes.updated_at);
  if (!providerUpdatedAt) return null;

  return {
    subscriptionId: String(data.id),
    customerId: String(attributes.customer_id),
    productId: String(attributes.product_id),
    variantId: String(attributes.variant_id),
    status: attributes.status,
    renewsAt: optionalDate(attributes.renews_at),
    endsAt: optionalDate(attributes.ends_at),
    testMode: Boolean(attributes.test_mode),
    providerUpdatedAt,
    storeId: String(attributes.store_id ?? ""),
  } satisfies LemonSubscriptionSnapshot & { storeId: string };
}

export function isExpectedLemonSubscription(
  snapshot: LemonSubscriptionSnapshot & { storeId: string },
  config = getLemonConfig(),
) {
  return snapshot.storeId === config.storeId &&
    snapshot.productId === config.productId &&
    [config.monthlyVariantId, config.annualVariantId].includes(snapshot.variantId) &&
    snapshot.testMode === config.testMode;
}
