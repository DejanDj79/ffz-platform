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

type BillingEnv = Record<string, string | undefined>;

export type BillingAvailability = {
  available: boolean;
  testMode: boolean;
  reason: "READY" | "MISSING_CONFIGURATION" | "TEST_MODE_BLOCKED_IN_PRODUCTION" | "TOKEN_MODE_MISMATCH";
};

function configured(requiredVars: readonly string[], env: BillingEnv) {
  return requiredVars.every((name) => Boolean(env[name]?.trim()));
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

// Kept while the old Lemon Squeezy implementation remains in the repository
// for reference/rollback. New FFZ checkout flows use Paddle.
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
