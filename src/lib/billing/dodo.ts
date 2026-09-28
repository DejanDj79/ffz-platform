import crypto from "node:crypto";
import { FOUNDER_TOTAL_SLOTS, type FounderOrderSnapshot } from "./founder";

export type DodoBillingInterval = "MONTHLY" | "ANNUAL";
export type DodoEnvironment = "test_mode" | "live_mode";
export type DodoSubscriptionStatus =
  | "active"
  | "on_hold"
  | "paused"
  | "cancelled"
  | "failed"
  | "expired"
  | "pending";

export type DodoConfig = {
  apiKey: string;
  webhookKey: string | null;
  environment: DodoEnvironment;
  baseUrl: string;
  testMode: boolean;
  monthlyProductId: string;
  annualProductId: string;
  founderProductId: string;
};

export type DodoWebhookPayload = {
  business_id?: string;
  type?: string;
  timestamp?: string;
  data?: unknown;
};

export type DodoSubscriptionSnapshot = {
  subscriptionId: string;
  customerId: string;
  productId: string;
  status: DodoSubscriptionStatus;
  renewsAt: Date | null;
  endsAt: Date | null;
  testMode: boolean;
  providerUpdatedAt: Date;
  userId: string | null;
};

type DodoCheckoutResponse = {
  checkout_url?: string;
  session_id?: string;
  id?: string;
};

type DodoPortalResponse = {
  link?: string;
};

type DodoApiError = {
  message?: string;
  error?: string;
  detail?: string;
};

type DodoPaymentDetail = Record<string, unknown>;

function required(name: string, value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) throw new Error(`Missing Dodo Payments configuration: ${name}`);
  return trimmed;
}

export function dodoEnvironment(value = process.env.DODO_PAYMENTS_ENVIRONMENT): DodoEnvironment {
  return value?.trim().toLowerCase() === "live_mode" ? "live_mode" : "test_mode";
}

export function getDodoConfig(options: { requireWebhook?: boolean } = {}): DodoConfig {
  const environment = dodoEnvironment();
  return {
    apiKey: required("DODO_PAYMENTS_API_KEY", process.env.DODO_PAYMENTS_API_KEY),
    webhookKey: options.requireWebhook
      ? required("DODO_PAYMENTS_WEBHOOK_KEY", process.env.DODO_PAYMENTS_WEBHOOK_KEY)
      : process.env.DODO_PAYMENTS_WEBHOOK_KEY?.trim() || null,
    environment,
    baseUrl: environment === "live_mode"
      ? "https://live.dodopayments.com"
      : "https://test.dodopayments.com",
    testMode: environment === "test_mode",
    monthlyProductId: required(
      "DODO_PRO_MONTHLY_PRODUCT_ID",
      process.env.DODO_PRO_MONTHLY_PRODUCT_ID,
    ),
    annualProductId: required(
      "DODO_PRO_ANNUAL_PRODUCT_ID",
      process.env.DODO_PRO_ANNUAL_PRODUCT_ID,
    ),
    founderProductId: required(
      "DODO_FOUNDER_PRODUCT_ID",
      process.env.DODO_FOUNDER_PRODUCT_ID,
    ),
  };
}

export function dodoProductIdForInterval(
  interval: DodoBillingInterval,
  config = getDodoConfig(),
) {
  return interval === "MONTHLY" ? config.monthlyProductId : config.annualProductId;
}

function dodoHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    "User-Agent": "FFZ Platform/1.0 (https://ffz.app)",
  };
}

async function apiError(response: Response, fallback: string) {
  const raw = await response.text().catch(() => "");
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw) as DodoApiError;
    return parsed.detail || parsed.message || parsed.error || `${fallback}: ${raw}`;
  } catch {
    return `${fallback}: ${raw}`;
  }
}

export async function createDodoCheckoutSession(
  input: {
    productId: string;
    email: string;
    name?: string | null;
    returnUrl: string;
    cancelUrl?: string | null;
    metadata: Record<string, string>;
  },
  config = getDodoConfig(),
  request: typeof fetch = fetch,
) {
  const response = await request(`${config.baseUrl}/checkouts`, {
    method: "POST",
    headers: dodoHeaders(config.apiKey),
    cache: "no-store",
    body: JSON.stringify({
      product_cart: [{ product_id: input.productId, quantity: 1 }],
      customer: {
        email: input.email,
        ...(input.name?.trim() ? { name: input.name.trim() } : {}),
      },
      return_url: input.returnUrl,
      ...(input.cancelUrl ? { cancel_url: input.cancelUrl } : {}),
      metadata: input.metadata,
      feature_flags: {
        redirect_immediately: true,
      },
    }),
  });

  const payload = await response.json().catch(() => ({})) as DodoCheckoutResponse;
  if (!response.ok || !payload.checkout_url) {
    throw new Error(await apiError(
      response,
      `Dodo Payments checkout creation failed (${response.status})`,
    ));
  }

  return {
    url: payload.checkout_url,
    sessionId: payload.session_id ?? payload.id ?? null,
  };
}

export async function createDodoCustomerPortalSession(
  customerId: string,
  config = getDodoConfig(),
  request: typeof fetch = fetch,
) {
  const response = await request(
    `${config.baseUrl}/customers/${encodeURIComponent(customerId)}/customer-portal/session`,
    {
      method: "POST",
      headers: dodoHeaders(config.apiKey),
      cache: "no-store",
    },
  );

  const payload = await response.json().catch(() => ({})) as DodoPortalResponse;
  if (!response.ok || !payload.link) {
    throw new Error(await apiError(
      response,
      `Dodo Payments customer portal creation failed (${response.status})`,
    ));
  }

  return payload.link;
}

export async function cancelDodoSubscriptionAtPeriodEnd(
  subscriptionId: string,
  config = getDodoConfig(),
  request: typeof fetch = fetch,
) {
  const response = await request(
    `${config.baseUrl}/subscriptions/${encodeURIComponent(subscriptionId)}`,
    {
      method: "PATCH",
      headers: dodoHeaders(config.apiKey),
      cache: "no-store",
      body: JSON.stringify({ cancel_at_next_billing_date: true }),
    },
  );

  if (!response.ok) {
    throw new Error(await apiError(
      response,
      `Dodo Payments subscription cancellation failed (${response.status})`,
    ));
  }
}

export async function getDodoPaymentDetail(
  paymentId: string,
  config = getDodoConfig(),
  request: typeof fetch = fetch,
): Promise<DodoPaymentDetail> {
  const response = await request(
    `${config.baseUrl}/payments/${encodeURIComponent(paymentId)}`,
    {
      method: "GET",
      headers: dodoHeaders(config.apiKey),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(await apiError(
      response,
      `Dodo Payments payment lookup failed (${response.status})`,
    ));
  }

  return await response.json() as DodoPaymentDetail;
}

function webhookSecretBytes(secret: string) {
  const trimmed = secret.trim();
  if (trimmed.startsWith("whsec_")) {
    return Buffer.from(trimmed.slice("whsec_".length), "base64");
  }
  return Buffer.from(trimmed, "utf8");
}

function matchesSignature(expected: Buffer, signature: string) {
  let actual: Buffer;
  try {
    actual = Buffer.from(signature, "base64");
  } catch {
    return false;
  }

  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export function verifyDodoWebhookSignature(
  rawBody: string,
  headers: {
    webhookId: string | null;
    webhookTimestamp: string | null;
    webhookSignature: string | null;
  },
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  const webhookId = headers.webhookId?.trim();
  const timestamp = headers.webhookTimestamp?.trim();
  const signatureHeader = headers.webhookSignature?.trim();
  if (!webhookId || !timestamp || !signatureHeader) return false;

  const numericTimestamp = Number(timestamp);
  if (!Number.isFinite(numericTimestamp)) return false;
  if (Math.abs(nowSeconds - numericTimestamp) > 5 * 60) return false;

  const signed = `${webhookId}.${timestamp}.${rawBody}`;
  const expected = crypto
    .createHmac("sha256", webhookSecretBytes(secret))
    .update(signed, "utf8")
    .digest();

  return signatureHeader.split(/\s+/).some((candidate) => {
    const [version, signature] = candidate.split(",", 2);
    return version === "v1" && Boolean(signature) && matchesSignature(expected, signature);
  });
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function booleanValue(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function dateValue(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function eventDate(payload: DodoWebhookPayload, data: Record<string, unknown>) {
  return dateValue(payload.timestamp) ??
    dateValue(data.updated_at) ??
    dateValue(data.created_at) ??
    new Date();
}

function metadataFrom(data: Record<string, unknown>) {
  return objectValue(data.metadata) ?? {};
}

function customUserId(metadata: Record<string, unknown>) {
  return stringValue(metadata.ffz_user_id) ?? stringValue(metadata.user_id);
}

function customSlot(metadata: Record<string, unknown>) {
  const raw = metadata.founder_slot;
  const parsed = typeof raw === "number" ? raw : Number(raw);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= FOUNDER_TOTAL_SLOTS
    ? parsed
    : null;
}

function customerIdFrom(data: Record<string, unknown>) {
  const customer = objectValue(data.customer);
  return stringValue(customer?.customer_id) ??
    stringValue(customer?.id) ??
    stringValue(data.customer_id);
}

function productIdsFrom(data: Record<string, unknown>) {
  const ids = new Set<string>();
  const direct = stringValue(data.product_id);
  if (direct) ids.add(direct);

  for (const field of ["product_cart", "items", "products"] as const) {
    const raw = data[field];
    if (!Array.isArray(raw)) continue;
    for (const item of raw) {
      const object = objectValue(item);
      const productId = stringValue(object?.product_id) ??
        stringValue(object?.id);
      if (productId) ids.add(productId);
    }
  }

  return [...ids];
}

function normalizedSubscriptionStatus(value: unknown): DodoSubscriptionStatus | null {
  const normalized = stringValue(value)?.toLowerCase();
  if (
    normalized === "active" ||
    normalized === "on_hold" ||
    normalized === "paused" ||
    normalized === "cancelled" ||
    normalized === "failed" ||
    normalized === "expired" ||
    normalized === "pending"
  ) {
    return normalized;
  }
  return null;
}

function statusForSubscriptionEvent(
  eventType: string,
  data: Record<string, unknown>,
): DodoSubscriptionStatus | null {
  const explicit = normalizedSubscriptionStatus(data.status);
  if (explicit) return explicit;

  switch (eventType) {
    case "subscription.active":
    case "subscription.renewed":
      return "active";
    case "subscription.on_hold":
      return "on_hold";
    case "subscription.paused":
      return "paused";
    case "subscription.cancelled":
      return "cancelled";
    case "subscription.failed":
      return "failed";
    case "subscription.expired":
      return "expired";
    default:
      return null;
  }
}

export function isDodoSubscriptionStatus(
  value: string | null | undefined,
): value is DodoSubscriptionStatus {
  return value === "active" ||
    value === "on_hold" ||
    value === "paused" ||
    value === "cancelled" ||
    value === "failed" ||
    value === "expired" ||
    value === "pending";
}

export function planForDodoStatus(status: DodoSubscriptionStatus) {
  return status === "active" ? "PRO" as const : "FREE" as const;
}

export function dodoSubscriptionSnapshotFromWebhook(
  payload: DodoWebhookPayload,
  config = getDodoConfig(),
): DodoSubscriptionSnapshot | null {
  const eventType = payload.type ?? "";
  if (!eventType.startsWith("subscription.")) return null;

  const data = objectValue(payload.data);
  if (!data || stringValue(data.payload_type) !== "Subscription") return null;

  const subscriptionId = stringValue(data.subscription_id) ?? stringValue(data.id);
  const customerId = customerIdFrom(data);
  const productId = stringValue(data.product_id);
  const status = statusForSubscriptionEvent(eventType, data);
  if (!subscriptionId || !customerId || !productId || !status) return null;

  const nextBilling = dateValue(data.next_billing_date);
  const cancelAtNextBilling = booleanValue(data.cancel_at_next_billing_date) === true;
  const terminalEnd = dateValue(data.cancelled_at) ?? dateValue(data.expires_at);
  const endsAt = status === "active" && cancelAtNextBilling
    ? nextBilling
    : status === "active"
      ? null
      : terminalEnd ?? nextBilling;

  return {
    subscriptionId,
    customerId,
    productId,
    status,
    renewsAt: status === "active" && !cancelAtNextBilling ? nextBilling : null,
    endsAt,
    testMode: config.testMode,
    providerUpdatedAt: eventDate(payload, data),
    userId: customUserId(metadataFrom(data)),
  };
}

export function isExpectedDodoSubscription(
  snapshot: DodoSubscriptionSnapshot,
  config = getDodoConfig(),
) {
  return snapshot.testMode === config.testMode && (
    snapshot.productId === config.monthlyProductId ||
    snapshot.productId === config.annualProductId
  );
}

export function dodoFounderOrderSnapshotFromWebhook(
  payload: DodoWebhookPayload,
  config = getDodoConfig(),
): FounderOrderSnapshot | null {
  if (payload.type !== "payment.succeeded") return null;

  const data = objectValue(payload.data);
  if (!data || stringValue(data.payload_type) !== "Payment") return null;

  const metadata = metadataFrom(data);
  if (stringValue(metadata.ffz_plan)?.toUpperCase() !== "FOUNDER") return null;

  const productId = productIdsFrom(data).find((id) => id === config.founderProductId);
  const paymentId = stringValue(data.payment_id) ?? stringValue(data.id);
  if (!productId || !paymentId) return null;

  const changedAt = eventDate(payload, data);
  return {
    orderId: paymentId,
    customerId: customerIdFrom(data) ?? "",
    storeId: "DODO",
    productId,
    variantId: productId,
    status: "succeeded",
    testMode: config.testMode,
    createdAt: dateValue(data.created_at) ?? changedAt,
    updatedAt: changedAt,
    fullyRefunded: false,
    userId: customUserId(metadata),
    slotNo: customSlot(metadata),
    reservationToken: stringValue(metadata.founder_reservation_token),
  };
}

export function isExpectedDodoFounder(
  snapshot: FounderOrderSnapshot,
  config = getDodoConfig(),
) {
  return snapshot.storeId === "DODO" &&
    snapshot.productId === config.founderProductId &&
    snapshot.testMode === config.testMode;
}

export function dodoFounderRefundPaymentId(payload: DodoWebhookPayload) {
  if (payload.type !== "refund.succeeded") return null;
  const data = objectValue(payload.data);
  if (!data || stringValue(data.payload_type) !== "Refund") return null;
  return stringValue(data.payment_id);
}

export function dodoFounderRefundSnapshotFromPayment(
  payload: DodoWebhookPayload,
  payment: DodoPaymentDetail,
  config = getDodoConfig(),
): FounderOrderSnapshot | null {
  const paymentId = dodoFounderRefundPaymentId(payload);
  if (!paymentId) return null;

  const refundStatus = stringValue(payment.refund_status)?.toLowerCase();
  if (refundStatus !== "full") return null;

  const productId = productIdsFrom(payment).find((id) => id === config.founderProductId);
  if (!productId) return null;

  const changedAt = eventDate(payload, objectValue(payload.data) ?? {});
  return {
    orderId: paymentId,
    customerId: customerIdFrom(payment) ?? "",
    storeId: "DODO",
    productId,
    variantId: productId,
    status: "refunded",
    testMode: config.testMode,
    createdAt: dateValue(payment.created_at) ?? changedAt,
    updatedAt: changedAt,
    fullyRefunded: true,
    userId: null,
    slotNo: null,
    reservationToken: null,
  };
}
