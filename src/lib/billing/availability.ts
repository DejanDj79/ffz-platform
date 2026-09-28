const REQUIRED_DODO_BILLING_VARS = [
  "DODO_PAYMENTS_API_KEY",
  "DODO_PAYMENTS_WEBHOOK_KEY",
  "DODO_PRO_MONTHLY_PRODUCT_ID",
  "DODO_PRO_ANNUAL_PRODUCT_ID",
] as const;

const REQUIRED_DODO_FOUNDER_VARS = [
  "DODO_PAYMENTS_API_KEY",
  "DODO_PAYMENTS_WEBHOOK_KEY",
  "DODO_FOUNDER_PRODUCT_ID",
] as const;

const REQUIRED_DODO_MANAGEMENT_VARS = [
  "DODO_PAYMENTS_API_KEY",
] as const;

const REQUIRED_LEMON_BILLING_VARS = [
  "LEMONSQUEEZY_API_KEY",
  "LEMONSQUEEZY_STORE_ID",
  "LEMONSQUEEZY_PRODUCT_ID",
  "LEMONSQUEEZY_MONTHLY_VARIANT_ID",
  "LEMONSQUEEZY_ANNUAL_VARIANT_ID",
  "LEMONSQUEEZY_WEBHOOK_SECRET",
] as const;

const REQUIRED_PADDLE_BILLING_VARS = [
  "PADDLE_CLIENT_TOKEN",
  "PADDLE_MONTHLY_PRICE_ID",
  "PADDLE_ANNUAL_PRICE_ID",
  "PADDLE_WEBHOOK_SECRET",
] as const;

const REQUIRED_PADDLE_FOUNDER_VARS = [
  "PADDLE_CLIENT_TOKEN",
  "PADDLE_FOUNDER_PRICE_ID",
  "PADDLE_WEBHOOK_SECRET",
] as const;

const REQUIRED_PADDLE_MANAGEMENT_VARS = [
  "PADDLE_API_KEY",
] as const;

const REQUIRED_FASTSPRING_BILLING_VARS = [
  "NEXT_PUBLIC_FASTSPRING_STOREFRONT",
  "FASTSPRING_PRO_MONTHLY_PATH",
  "FASTSPRING_PRO_YEARLY_PATH",
] as const;

const REQUIRED_FASTSPRING_FOUNDER_VARS = [
  "NEXT_PUBLIC_FASTSPRING_STOREFRONT",
  "FASTSPRING_FOUNDER_PATH",
] as const;

type BillingEnv = Record<string, string | undefined>;

export type BillingAvailability = {
  available: boolean;
  testMode: boolean;
  reason: "READY" | "MISSING_CONFIGURATION" | "TEST_MODE_BLOCKED_IN_PRODUCTION" | "TOKEN_MODE_MISMATCH";
};

function configured(requiredVars: readonly string[], env: BillingEnv) {
  return requiredVars.every((name) => Boolean(env[name]?.trim()));
}

function dodoTestMode(env: BillingEnv) {
  return (env.DODO_PAYMENTS_ENVIRONMENT ?? "test_mode").trim().toLowerCase() !== "live_mode";
}

function dodoAvailabilityFor(
  requiredVars: readonly string[],
  env: BillingEnv,
): BillingAvailability {
  const testMode = dodoTestMode(env);
  if (!configured(requiredVars, env)) {
    return { available: false, testMode, reason: "MISSING_CONFIGURATION" };
  }
  return { available: true, testMode, reason: "READY" };
}

export function getDodoBillingAvailability(
  env: BillingEnv = process.env,
): BillingAvailability {
  return dodoAvailabilityFor(REQUIRED_DODO_BILLING_VARS, env);
}

export function getDodoFounderAvailability(
  env: BillingEnv = process.env,
): BillingAvailability {
  return dodoAvailabilityFor(REQUIRED_DODO_FOUNDER_VARS, env);
}

export function getDodoManagementAvailability(
  env: BillingEnv = process.env,
): BillingAvailability {
  return dodoAvailabilityFor(REQUIRED_DODO_MANAGEMENT_VARS, env);
}

function paddleTestMode(env: BillingEnv) {
  const mode = (env.PADDLE_ENVIRONMENT ?? "sandbox").trim().toLowerCase();
  return mode !== "production" && mode !== "live";
}

function paddleAvailabilityFor(
  requiredVars: readonly string[],
  env: BillingEnv,
  nodeEnv: string | undefined,
): BillingAvailability {
  const testMode = paddleTestMode(env);

  if (!configured(requiredVars, env)) {
    return { available: false, testMode, reason: "MISSING_CONFIGURATION" };
  }

  const token = env.PADDLE_CLIENT_TOKEN?.trim() ?? "";
  if ((testMode && !token.startsWith("test_")) || (!testMode && !token.startsWith("live_"))) {
    return { available: false, testMode, reason: "TOKEN_MODE_MISMATCH" };
  }

  if (nodeEnv === "production" && testMode) {
    return { available: false, testMode, reason: "TEST_MODE_BLOCKED_IN_PRODUCTION" };
  }

  return { available: true, testMode, reason: "READY" };
}

function fastSpringAvailabilityFor(
  requiredVars: readonly string[],
  env: BillingEnv,
): BillingAvailability {
  const storefront = env.NEXT_PUBLIC_FASTSPRING_STOREFRONT?.trim() ?? "";
  const testMode = storefront.includes(".test.onfastspring.com");

  if (!configured(requiredVars, env)) {
    return { available: false, testMode, reason: "MISSING_CONFIGURATION" };
  }

  return { available: true, testMode, reason: "READY" };
}

// Legacy provider availability helpers are retained for existing records and
// rollback/reference while Dodo Payments is the active FFZ checkout provider.
export function getFastSpringBillingAvailability(
  env: BillingEnv = process.env,
): BillingAvailability {
  return fastSpringAvailabilityFor(REQUIRED_FASTSPRING_BILLING_VARS, env);
}

export function getFastSpringFounderAvailability(
  env: BillingEnv = process.env,
): BillingAvailability {
  return fastSpringAvailabilityFor(REQUIRED_FASTSPRING_FOUNDER_VARS, env);
}

export function getPaddleBillingAvailability(
  env: BillingEnv = process.env,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): BillingAvailability {
  return paddleAvailabilityFor(REQUIRED_PADDLE_BILLING_VARS, env, nodeEnv);
}

export function getFounderBillingAvailability(
  env: BillingEnv = process.env,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): BillingAvailability {
  return paddleAvailabilityFor(REQUIRED_PADDLE_FOUNDER_VARS, env, nodeEnv);
}

export function getPaddleManagementAvailability(
  env: BillingEnv = process.env,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): BillingAvailability {
  const base = paddleAvailabilityFor([], env, nodeEnv);
  if (!base.available) return base;
  if (!configured(REQUIRED_PADDLE_MANAGEMENT_VARS, env)) {
    return { ...base, available: false, reason: "MISSING_CONFIGURATION" };
  }
  return base;
}

export function getLemonBillingAvailability(
  env: BillingEnv = process.env,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): BillingAvailability {
  const testMode = (env.LEMONSQUEEZY_TEST_MODE ?? "true").trim().toLowerCase() === "true";
  if (!configured(REQUIRED_LEMON_BILLING_VARS, env)) {
    return { available: false, testMode, reason: "MISSING_CONFIGURATION" };
  }
  if (nodeEnv === "production" && testMode) {
    return { available: false, testMode, reason: "TEST_MODE_BLOCKED_IN_PRODUCTION" };
  }
  return { available: true, testMode, reason: "READY" };
}
