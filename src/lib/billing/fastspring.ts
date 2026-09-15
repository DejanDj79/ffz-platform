import crypto from "node:crypto";
import { FOUNDER_TOTAL_SLOTS, type FounderOrderSnapshot } from "./founder";

export type FastSpringBillingInterval = "MONTHLY" | "ANNUAL";
export type FastSpringSubscriptionStatus =
  | "active"
  | "trial"
  | "canceled"
  | "overdue"
  | "paused"
  | "deactivated";

type FastSpringConfig = {
  storefront: string;
  monthlyProductPath: string;
  annualProductPath: string;
  founderProductPath: string;
  testMode: boolean;
};

export type FastSpringWebhookEvent = {
  id?: string;
  live?: boolean;
  processed?: boolean;
  type?: string;
  created?: number;
  data?: unknown;
};

export type FastSpringWebhookPayload = {
  events?: FastSpringWebhookEvent[];
};

export type FastSpringSubscriptionSnapshot = {
  subscriptionId: string;
  customerId: string;
  productId: string;
  status: FastSpringSubscriptionStatus;
  renewsAt: Date | null;
  endsAt: Date | null;
  testMode: boolean;
  providerUpdatedAt: Date;
  userId: string | null;
};

function required(name: string, value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`Missing FastSpring configuration: ${name}`);
  }
  return trimmed;
}

export function getFastSpringConfig(): FastSpringConfig {
  const storefront = required(
    "NEXT_PUBLIC_FASTSPRING_STOREFRONT",
    process.env.NEXT_PUBLIC_FASTSPRING_STOREFRONT,
  );

  return {
    storefront,
    monthlyProductPath: required(
      "FASTSPRING_PRO_MONTHLY_PATH",
      process.env.FASTSPRING_PRO_MONTHLY_PATH,
    ),
    annualProductPath: required(
      "FASTSPRING_PRO_YEARLY_PATH",
      process.env.FASTSPRING_PRO_YEARLY_PATH,
    ),
    founderProductPath: required(
      "FASTSPRING_FOUNDER_PATH",
      process.env.FASTSPRING_FOUNDER_PATH,
    ),
    testMode: storefront.includes(".test.onfastspring.com"),
  };
}

export function getFastSpringWebhookSecret() {
  return required("FASTSPRING_WEBHOOK_SECRET", process.env.FASTSPRING_WEBHOOK_SECRET);
}

export function fastSpringProductPathForInterval(
  interval: FastSpringBillingInterval,
  config = getFastSpringConfig(),
) {
  return interval === "MONTHLY"
    ? config.monthlyProductPath
    : config.annualProductPath;
}

export function verifyFastSpringSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
) {
  if (!signatureHeader) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");

  const actualBuffer = Buffer.from(signatureHeader.trim(), "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return actualBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(actualBuffer, expectedBuffer);
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

function dateFromTimestamp(value: unknown) {
  const numeric = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim()
      ? Number(value)
      : Number.NaN;
  if (!Number.isFinite(numeric) || numeric <= 0) return null;

  const millis = numeric < 100_000_000_000 ? numeric * 1000 : numeric;
  const date = new Date(millis);
  return Number.isNaN(date.getTime()) ? null : date;
}

function eventDate(event: FastSpringWebhookEvent, data: Record<string, unknown>) {
  return dateFromTimestamp(data.changed) ??
    dateFromTimestamp(data.changedValue) ??
    dateFromTimestamp(event.created) ??
    new Date();
}

function accountId(value: unknown) {
  const direct = stringValue(value);
  if (direct) return direct;
  const account = objectValue(value);
  return stringValue(account?.id) ?? stringValue(account?.account);
}

function productPath(value: unknown) {
  const direct = stringValue(value);
  if (direct) return direct;
  const product = objectValue(value);
  return stringValue(product?.product) ?? stringValue(product?.id);
}

function tagsFrom(...sources: Array<Record<string, unknown> | null>) {
  for (const source of sources) {
    if (!source) continue;
    const tags = objectValue(source.tags) ??
      objectValue(source.orderTags) ??
      objectValue(source.custom);
    if (tags) return tags;
  }
  return {} as Record<string, unknown>;
}

function customUserId(tags: Record<string, unknown>) {
  return stringValue(tags.ffz_user_id) ?? stringValue(tags.user_id);
}

function customSlot(tags: Record<string, unknown>) {
  const raw = tags.founder_slot;
  const parsed = typeof raw === "number" ? raw : Number(raw);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= FOUNDER_TOTAL_SLOTS
    ? parsed
    : null;
}

function eventTestMode(
  event: FastSpringWebhookEvent,
  data: Record<string, unknown>,
  fallback: boolean,
) {
  const live = booleanValue(event.live) ?? booleanValue(data.live);
  return live == null ? fallback : !live;
}

function statusForEvent(eventType: string, state: string | null): FastSpringSubscriptionStatus | null {
  const normalized = state?.trim().toLowerCase();
  if (
    normalized === "active" ||
    normalized === "trial" ||
    normalized === "canceled" ||
    normalized === "overdue" ||
    normalized === "paused" ||
    normalized === "deactivated"
  ) {
    return normalized;
  }

  switch (eventType) {
    case "subscription.activated":
    case "subscription.uncanceled":
    case "subscription.resumed":
    case "subscription.charge.completed":
      return "active";
    case "subscription.canceled":
      return "canceled";
    case "subscription.charge.failed":
    case "subscription.payment.overdue":
      return "overdue";
    case "subscription.paused":
      return "paused";
    case "subscription.deactivated":
      return "deactivated";
    default:
      return null;
  }
}

export function isFastSpringSubscriptionStatus(value: string | null | undefined): value is FastSpringSubscriptionStatus {
  return value === "active" ||
    value === "trial" ||
    value === "canceled" ||
    value === "overdue" ||
    value === "paused" ||
    value === "deactivated";
}

export function planForFastSpringStatus(status: FastSpringSubscriptionStatus) {
  return status === "deactivated" ? "FREE" as const : "PRO" as const;
}

function subscriptionRecord(data: Record<string, unknown>) {
  return objectValue(data.subscription) ?? data;
}

export function fastSpringSubscriptionSnapshotFromEvent(
  event: FastSpringWebhookEvent,
  config = getFastSpringConfig(),
): FastSpringSubscriptionSnapshot | null {
  const data = objectValue(event.data);
  if (!data || !event.type?.startsWith("subscription.")) return null;

  const subscription = subscriptionRecord(data);
  const nestedOrder = objectValue(data.order);
  const subscriptionId = stringValue(subscription.id) ??
    stringValue(subscription.subscription) ??
    stringValue(data.subscription) ??
    stringValue(data.id);
  const customerId = accountId(subscription.account) ??
    accountId(data.account) ??
    accountId(nestedOrder?.account);
  const productId = productPath(subscription.product) ??
    productPath(data.product);
  const status = statusForEvent(
    event.type,
    stringValue(subscription.state) ?? stringValue(data.state),
  );

  if (!subscriptionId || !customerId || !productId || !status) return null;

  const tags = tagsFrom(subscription, data, nestedOrder);
  const providerUpdatedAt = eventDate(event, subscription);
  const renewsAt = status === "canceled" || status === "deactivated"
    ? null
    : dateFromTimestamp(subscription.nextChargeDate) ?? dateFromTimestamp(subscription.next);
  const endsAt = status === "canceled" || status === "deactivated"
    ? dateFromTimestamp(subscription.deactivationDate) ?? dateFromTimestamp(subscription.end)
    : null;

  return {
    subscriptionId,
    customerId,
    productId,
    status,
    renewsAt,
    endsAt,
    testMode: eventTestMode(event, subscription, config.testMode),
    providerUpdatedAt,
    userId: customUserId(tags),
  };
}

export function fastSpringSubscriptionSnapshotFromOrder(
  event: FastSpringWebhookEvent,
  config = getFastSpringConfig(),
): FastSpringSubscriptionSnapshot | null {
  if (event.type !== "order.completed") return null;
  const data = objectValue(event.data);
  if (!data) return null;

  const items = Array.isArray(data.items)
    ? data.items.map(objectValue).filter((item): item is Record<string, unknown> => Boolean(item))
    : [];
  const item = items.find((candidate) => {
    const product = productPath(candidate.product);
    return product === config.monthlyProductPath || product === config.annualProductPath;
  });
  if (!item) return null;

  const subscriptionId = stringValue(item.subscription);
  const customerId = accountId(data.account);
  const productId = productPath(item.product);
  if (!subscriptionId || !customerId || !productId) return null;

  const tags = tagsFrom(data);
  return {
    subscriptionId,
    customerId,
    productId,
    status: "active",
    renewsAt: null,
    endsAt: null,
    testMode: eventTestMode(event, data, config.testMode),
    providerUpdatedAt: eventDate(event, data),
    userId: customUserId(tags),
  };
}

export function isExpectedFastSpringSubscription(
  snapshot: FastSpringSubscriptionSnapshot,
  config = getFastSpringConfig(),
) {
  return (
    snapshot.productId === config.monthlyProductPath ||
    snapshot.productId === config.annualProductPath
  ) && snapshot.testMode === config.testMode;
}

export function fastSpringFounderOrderSnapshotFromEvent(
  event: FastSpringWebhookEvent,
  config = getFastSpringConfig(),
): FounderOrderSnapshot | null {
  if (event.type !== "order.completed") return null;
  const data = objectValue(event.data);
  if (!data) return null;

  const items = Array.isArray(data.items)
    ? data.items.map(objectValue).filter((item): item is Record<string, unknown> => Boolean(item))
    : [];
  const founderItem = items.find(
    (item) => productPath(item.product) === config.founderProductPath,
  );
  if (!founderItem) return null;

  const orderId = stringValue(data.id) ?? stringValue(data.order);
  if (!orderId) return null;

  const tags = tagsFrom(data);
  const changedAt = eventDate(event, data);
  return {
    orderId,
    customerId: accountId(data.account) ?? "",
    storeId: "FASTSPRING",
    productId: config.founderProductPath,
    variantId: config.founderProductPath,
    status: "completed",
    testMode: eventTestMode(event, data, config.testMode),
    createdAt: changedAt,
    updatedAt: changedAt,
    fullyRefunded: false,
    userId: customUserId(tags),
    slotNo: customSlot(tags),
    reservationToken: stringValue(tags.founder_reservation_token),
  };
}

export function fastSpringFounderRefundSnapshotFromEvent(
  event: FastSpringWebhookEvent,
  config = getFastSpringConfig(),
): FounderOrderSnapshot | null {
  if (event.type !== "return.created") return null;
  const data = objectValue(event.data);
  if (!data) return null;

  const items = Array.isArray(data.items)
    ? data.items.map(objectValue).filter((item): item is Record<string, unknown> => Boolean(item))
    : [];
  const founderItems = items.filter(
    (item) => productPath(item.product) === config.founderProductPath,
  );
  if (founderItems.length === 0) return null;

  const original = objectValue(data.original);
  const orderId = stringValue(original?.id) ?? stringValue(original?.order);
  if (!orderId) return null;

  const fullyRefunded = founderItems.every((item) =>
    (stringValue(item.refundType) ?? "").toLowerCase().includes("full"),
  );
  const changedAt = eventDate(event, data);

  return {
    orderId,
    customerId: accountId(data.account) ?? accountId(original?.account) ?? "",
    storeId: "FASTSPRING",
    productId: config.founderProductPath,
    variantId: config.founderProductPath,
    status: "refunded",
    testMode: eventTestMode(event, data, config.testMode),
    createdAt: changedAt,
    updatedAt: changedAt,
    fullyRefunded,
    userId: null,
    slotNo: null,
    reservationToken: null,
  };
}

export function isExpectedFastSpringFounder(
  snapshot: FounderOrderSnapshot,
  config = getFastSpringConfig(),
) {
  return snapshot.productId === config.founderProductPath &&
    snapshot.testMode === config.testMode;
}
