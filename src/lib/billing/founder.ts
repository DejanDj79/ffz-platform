export const FOUNDER_TOTAL_SLOTS = 150;
export const FOUNDER_RESERVATION_MINUTES = 30;

export type FounderLemonConfig = {
  apiKey: string;
  storeId: string;
  variantId: string;
  testMode: boolean;
};

export type FounderOrderSnapshot = {
  orderId: string;
  customerId: string;
  storeId: string;
  productId: string;
  variantId: string;
  status: string;
  testMode: boolean;
  createdAt: Date;
  updatedAt: Date;
  fullyRefunded: boolean;
  userId: string | null;
  slotNo: number | null;
  reservationToken: string | null;
};

export type LemonOrderWebhookPayload = {
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
      status?: string;
      total?: number;
      refunded?: boolean;
      refunded_amount?: number;
      created_at?: string;
      updated_at?: string;
      test_mode?: boolean;
      first_order_item?: {
        product_id?: number | string;
        variant_id?: number | string;
        test_mode?: boolean;
      } | null;
    };
  };
};

type CheckoutResponse = {
  data?: {
    id?: string;
    attributes?: {
      url?: string;
    };
  };
  errors?: Array<{ detail?: string; title?: string }>;
};

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export function getFounderLemonConfig(): FounderLemonConfig {
  return {
    apiKey: required("LEMONSQUEEZY_API_KEY"),
    storeId: required("LEMONSQUEEZY_STORE_ID"),
    variantId: required("LEMONSQUEEZY_FOUNDER_VARIANT_ID"),
    testMode: (process.env.LEMONSQUEEZY_TEST_MODE ?? "true").trim().toLowerCase() === "true",
  };
}

function lemonHeaders(apiKey: string) {
  return {
    Accept: "application/vnd.api+json",
    "Content-Type": "application/vnd.api+json",
    Authorization: `Bearer ${apiKey}`,
  };
}

function errorMessage(payload: CheckoutResponse, fallback: string) {
  return payload.errors?.[0]?.detail || payload.errors?.[0]?.title || fallback;
}

export async function createLemonFounderCheckout(input: {
  userId: string;
  email: string;
  name?: string | null;
  slotNo: number;
  reservationToken: string;
  expiresAt: Date;
  redirectUrl: string;
}) {
  const config = getFounderLemonConfig();

  const response = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
    method: "POST",
    headers: lemonHeaders(config.apiKey),
    cache: "no-store",
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          expires_at: input.expiresAt.toISOString(),
          product_options: {
            redirect_url: input.redirectUrl,
          },
          checkout_options: {
            embed: false,
            media: true,
            logo: true,
            desc: true,
            discount: false,
          },
          checkout_data: {
            email: input.email,
            ...(input.name ? { name: input.name } : {}),
            custom: {
              user_id: input.userId,
              ffz_plan: "FOUNDER",
              founder_slot: String(input.slotNo),
              founder_reservation_token: input.reservationToken,
            },
          },
        },
        relationships: {
          store: {
            data: { type: "stores", id: config.storeId },
          },
          variant: {
            data: { type: "variants", id: config.variantId },
          },
        },
      },
    }),
  });

  const payload = await response.json() as CheckoutResponse;
  const url = payload.data?.attributes?.url;

  if (!response.ok || !url) {
    throw new Error(errorMessage(payload, `Unable to create Founder checkout (${response.status}).`));
  }

  return { url, checkoutId: payload.data?.id ?? null };
}

function optionalDate(value: string | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function customString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function customSlot(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= FOUNDER_TOTAL_SLOTS
    ? parsed
    : null;
}

export function founderOrderSnapshotFromWebhook(
  payload: LemonOrderWebhookPayload,
): FounderOrderSnapshot | null {
  const data = payload.data;
  const attributes = data?.attributes;
  const item = attributes?.first_order_item;

  if (data?.type !== "orders" || !data.id || !attributes || !item) return null;
  if (
    attributes.store_id == null ||
    attributes.customer_id == null ||
    item.product_id == null ||
    item.variant_id == null
  ) {
    return null;
  }

  const createdAt = optionalDate(attributes.created_at);
  const updatedAt = optionalDate(attributes.updated_at) ?? createdAt;
  if (!createdAt || !updatedAt) return null;

  const total = Number(attributes.total ?? 0);
  const refundedAmount = Number(attributes.refunded_amount ?? 0);
  const fullyRefunded = Boolean(attributes.refunded) || (total > 0 && refundedAmount >= total);
  const custom = payload.meta?.custom_data ?? {};

  return {
    orderId: String(data.id),
    customerId: String(attributes.customer_id),
    storeId: String(attributes.store_id),
    productId: String(item.product_id),
    variantId: String(item.variant_id),
    status: attributes.status ?? "",
    testMode: Boolean(attributes.test_mode ?? item.test_mode),
    createdAt,
    updatedAt,
    fullyRefunded,
    userId: customString(custom.user_id),
    slotNo: customSlot(custom.founder_slot),
    reservationToken: customString(custom.founder_reservation_token),
  };
}

export function isExpectedFounderOrder(
  snapshot: FounderOrderSnapshot,
  config: Pick<FounderLemonConfig, "storeId" | "variantId" | "testMode">,
) {
  return snapshot.storeId === config.storeId &&
    snapshot.variantId === config.variantId &&
    snapshot.testMode === config.testMode;
}
