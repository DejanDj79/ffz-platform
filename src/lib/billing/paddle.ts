import crypto from "node:crypto";
import type { UserPlan } from "@/lib/monetization/types";
import type { FounderOrderSnapshot } from "./founder";

export const PADDLE_SUBSCRIPTION_STATUSES = [
  "active",
  "canceled",
  "past_due",
  "paused",
  "trialing",
] as const;

export type PaddleSubscriptionStatus =
  (typeof PADDLE_SUBSCRIPTION_STATUSES)[number];

export type BillingInterval = "MONTHLY" | "ANNUAL";
export type PaddleEnvironment = "sandbox" | "production";

export type PaddleSubscriptionSnapshot = {
  subscriptionId: string;
  customerId: string;
  productId: string;
  priceId: string;
  status: PaddleSubscriptionStatus;
  renewsAt: Date | null;
  endsAt: Date | null;
  testMode: boolean;
  providerUpdatedAt: Date;
};

export type PaddleConfig = {
  clientToken: string;
  webhookSecret: string | null;
  apiKey: string | null;
  monthlyPriceId: string;
  annualPriceId: string;
  founderPriceId: string | null;
  environment: PaddleEnvironment;
  testMode: boolean;
};

type PaddlePrice = {
  id?: string;
  product_id?: string;
};

type PaddleItem = {
  price?: PaddlePrice;
  // Adjustment webhooks reuse `items` for adjustment items. Their `type`
  // tells us whether the related transaction item was refunded in full,
  // partially, as tax, or through proration.
  type?: string;
};

type PaddleSubscriptionData = {
  id?: string;
  status?: string;
  customer_id?: string;
  items?: PaddleItem[];
  next_billed_at?: string | null;
  canceled_at?: string | null;
  current_billing_period?: {
    starts_at?: string;
    ends_at?: string;
  } | null;
  scheduled_change?: {
    action?: string;
    effective_at?: string;
  } | null;
  custom_data?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
};

type PaddleTransactionData = {
  id?: string;
  status?: string;
  customer_id?: string | null;
  subscription_id?: string | null;
  items?: PaddleItem[];
  custom_data?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
};

type PaddleAdjustmentData = {
  id?: string;
  action?: string;
  type?: string | null;
  status?: string;
  transaction_id?: string;
  created_at?: string;
  updated_at?: string;
};

export type PaddleWebhookPayload = {
  event_id?: string;
  event_type?: string;
  occurred_at?: string;
  notification_id?: string;
  data?: PaddleSubscriptionData & PaddleTransactionData & PaddleAdjustmentData;
};

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function environmentFrom(raw: string | undefined): PaddleEnvironment {
  const value = raw?.trim().toLowerCase();
  if (!value || value === "sandbox") return "sandbox";
  if (value === "production" || value === "live") return "production";
  throw new Error("PADDLE_ENVIRONMENT must be sandbox or production.");
}

export function getPaddleConfig(
  options: { requireWebhookSecret?: boolean; requireApiKey?: boolean; requireFounder?: boolean } = {},
): PaddleConfig {
  const environment = environmentFrom(process.env.PADDLE_ENVIRONMENT);
  const clientToken = required("PADDLE_CLIENT_TOKEN");
  const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET?.trim() || null;
  const apiKey = process.env.PADDLE_API_KEY?.trim() || null;
  const founderPriceId = process.env.PADDLE_FOUNDER_PRICE_ID?.trim() || null;

  if (environment === "sandbox" && !clientToken.startsWith("test_")) {
    throw new Error("PADDLE_CLIENT_TOKEN must be a sandbox test_ token in sandbox mode.");
  }
  if (environment === "production" && !clientToken.startsWith("live_")) {
    throw new Error("PADDLE_CLIENT_TOKEN must be a live_ token in production mode.");
  }
  if (options.requireWebhookSecret && !webhookSecret) {
    throw new Error("PADDLE_WEBHOOK_SECRET is not configured.");
  }
  if (options.requireApiKey && !apiKey) {
    throw new Error("PADDLE_API_KEY is not configured.");
  }
  if (options.requireFounder && !founderPriceId) {
    throw new Error("PADDLE_FOUNDER_PRICE_ID is not configured.");
  }

  return {
    clientToken,
    webhookSecret,
    apiKey,
    monthlyPriceId: required("PADDLE_MONTHLY_PRICE_ID"),
    annualPriceId: required("PADDLE_ANNUAL_PRICE_ID"),
    founderPriceId,
    environment,
    testMode: environment === "sandbox",
  };
}

export function priceIdForInterval(interval: BillingInterval, config = getPaddleConfig()) {
  return interval === "ANNUAL" ? config.annualPriceId : config.monthlyPriceId;
}

export function isPaddleSubscriptionStatus(value: unknown): value is PaddleSubscriptionStatus {
  return typeof value === "string" &&
    (PADDLE_SUBSCRIPTION_STATUSES as readonly string[]).includes(value);
}

export function planForPaddleStatus(status: PaddleSubscriptionStatus): UserPlan {
  return status === "canceled" || status === "paused" ? "FREE" : "PRO";
}

function optionalDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function customString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function customSlot(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 150 ? parsed : null;
}

function findExpectedItem(
  items: PaddleItem[] | undefined,
  priceIds: readonly string[],
) {
  return items?.find((item) => {
    const id = item.price?.id;
    return Boolean(id && priceIds.includes(id));
  }) ?? null;
}

export function paddleSubscriptionSnapshotFromWebhook(
  payload: PaddleWebhookPayload,
  config = getPaddleConfig(),
): PaddleSubscriptionSnapshot | null {
  const data = payload.data;
  if (!data?.id || !data.customer_id || !isPaddleSubscriptionStatus(data.status)) return null;

  const item = findExpectedItem(data.items, [config.monthlyPriceId, config.annualPriceId]);
  const priceId = item?.price?.id;
  const productId = item?.price?.product_id;
  if (!priceId || !productId) return null;

  const providerUpdatedAt = optionalDate(data.updated_at) ?? optionalDate(payload.occurred_at);
  if (!providerUpdatedAt) return null;

  const scheduledEnd = data.scheduled_change?.action === "cancel"
    ? optionalDate(data.scheduled_change.effective_at)
    : null;
  const canceledEnd = data.status === "canceled"
    ? optionalDate(data.canceled_at) ?? optionalDate(data.current_billing_period?.ends_at)
    : null;

  return {
    subscriptionId: data.id,
    customerId: data.customer_id,
    productId,
    priceId,
    status: data.status,
    renewsAt: optionalDate(data.next_billed_at),
    endsAt: canceledEnd ?? scheduledEnd,
    testMode: config.testMode,
    providerUpdatedAt,
  };
}

export function isExpectedPaddleSubscription(
  snapshot: PaddleSubscriptionSnapshot,
  config = getPaddleConfig(),
) {
  return [config.monthlyPriceId, config.annualPriceId].includes(snapshot.priceId) &&
    snapshot.testMode === config.testMode;
}

export function paddleFounderSnapshotFromWebhook(
  payload: PaddleWebhookPayload,
  config = getPaddleConfig({ requireFounder: true }),
): FounderOrderSnapshot | null {
  const data = payload.data;
  const founderPriceId = config.founderPriceId as string;
  if (!data?.id || !data.customer_id || data.status !== "completed") return null;
  if (data.subscription_id) return null;

  const item = findExpectedItem(data.items, [founderPriceId]);
  const productId = item?.price?.product_id;
  const priceId = item?.price?.id;
  if (!productId || !priceId) return null;

  const createdAt = optionalDate(data.created_at) ?? optionalDate(payload.occurred_at);
  const updatedAt = optionalDate(data.updated_at) ?? optionalDate(payload.occurred_at) ?? createdAt;
  if (!createdAt || !updatedAt) return null;

  const custom = data.custom_data ?? {};
  return {
    orderId: data.id,
    customerId: data.customer_id,
    storeId: "PADDLE",
    productId,
    variantId: priceId,
    status: data.status,
    testMode: config.testMode,
    createdAt,
    updatedAt,
    fullyRefunded: false,
    userId: customString(custom.ffz_user_id),
    slotNo: customSlot(custom.founder_slot),
    reservationToken: customString(custom.founder_reservation_token),
  };
}

export function isExpectedPaddleFounder(
  snapshot: FounderOrderSnapshot,
  config = getPaddleConfig({ requireFounder: true }),
) {
  return snapshot.variantId === config.founderPriceId && snapshot.testMode === config.testMode;
}

export function paddleApprovedFullRefund(payload: PaddleWebhookPayload) {
  const data = payload.data;
  if (
    !data?.transaction_id ||
    data.action !== "refund" ||
    data.type !== "full" ||
    data.status !== "approved"
  ) {
    return null;
  }

  return {
    transactionId: data.transaction_id,
    updatedAt: optionalDate(data.updated_at) ?? optionalDate(payload.occurred_at) ?? new Date(),
  };
}

function parsePaddleSignature(signatureHeader: string | null) {
  if (!signatureHeader) return null;
  const parts = signatureHeader.split(";");
  let timestamp: string | null = null;
  const signatures: string[] = [];

  for (const part of parts) {
    const [key, value] = part.split("=", 2);
    if (!key || !value) continue;
    if (key.trim() === "ts") timestamp = value.trim();
    if (key.trim() === "h1") signatures.push(value.trim());
  }

  return timestamp && signatures.length > 0 ? { timestamp, signatures } : null;
}

export function verifyPaddleSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  options: { nowMs?: number; toleranceSeconds?: number } = {},
) {
  const parsed = parsePaddleSignature(signatureHeader);
  if (!parsed) return false;

  const timestampSeconds = Number(parsed.timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;

  const toleranceSeconds = options.toleranceSeconds ?? 5;
  const nowMs = options.nowMs ?? Date.now();
  if (Math.abs(nowMs - timestampSeconds * 1000) > toleranceSeconds * 1000) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${parsed.timestamp}:${rawBody}`)
    .digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");

  return parsed.signatures.some((signature) => {
    const signatureBuffer = Buffer.from(signature, "utf8");
    return expectedBuffer.length === signatureBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
  });
}

function paddleApiBase(environment: PaddleEnvironment) {
  return environment === "sandbox"
    ? "https://sandbox-api.paddle.com"
    : "https://api.paddle.com";
}

async function paddleApi<T>(path: string, init: RequestInit = {}) {
  const config = getPaddleConfig({ requireApiKey: true });
  const response = await fetch(`${paddleApiBase(config.environment)}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      ...init.headers,
    },
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({})) as T & {
    error?: { detail?: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.detail || `Paddle API request failed (${response.status}).`);
  }
  return payload;
}

export async function getPaddleCustomerPortal(customerId: string, subscriptionId?: string | null) {
  const payload = await paddleApi<{
    data?: {
      urls?: {
        general?: { overview?: string | null };
      };
    };
  }>(`/customers/${encodeURIComponent(customerId)}/portal-sessions`, {
    method: "POST",
    body: JSON.stringify(subscriptionId ? { subscription_ids: [subscriptionId] } : {}),
  });

  const url = payload.data?.urls?.general?.overview;
  if (!url) throw new Error("Paddle did not return a customer portal URL.");
  return url;
}

export async function cancelPaddleSubscriptionAfterFounderPurchase(subscriptionId: string) {
  await paddleApi(`/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, {
    method: "POST",
    body: JSON.stringify({ effective_from: "next_billing_period" }),
  });
}