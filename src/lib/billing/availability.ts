const REQUIRED_BILLING_VARS = [
  "LEMONSQUEEZY_API_KEY",
  "LEMONSQUEEZY_STORE_ID",
  "LEMONSQUEEZY_PRODUCT_ID",
  "LEMONSQUEEZY_MONTHLY_VARIANT_ID",
  "LEMONSQUEEZY_ANNUAL_VARIANT_ID",
  "LEMONSQUEEZY_WEBHOOK_SECRET",
] as const;

const REQUIRED_FOUNDER_VARS = [
  "LEMONSQUEEZY_API_KEY",
  "LEMONSQUEEZY_STORE_ID",
  "LEMONSQUEEZY_FOUNDER_VARIANT_ID",
  "LEMONSQUEEZY_WEBHOOK_SECRET",
] as const;

type BillingEnv = Record<string, string | undefined>;

export type LemonBillingAvailability = {
  available: boolean;
  testMode: boolean;
  reason: "READY" | "MISSING_CONFIGURATION" | "TEST_MODE_BLOCKED_IN_PRODUCTION";
};

function availabilityFor(
  requiredVars: readonly string[],
  env: BillingEnv,
  nodeEnv: string | undefined,
): LemonBillingAvailability {
  const testMode = (env.LEMONSQUEEZY_TEST_MODE ?? "true").trim().toLowerCase() === "true";
  const configured = requiredVars.every((name) => Boolean(env[name]?.trim()));

  if (!configured) {
    return { available: false, testMode, reason: "MISSING_CONFIGURATION" };
  }

  if (nodeEnv === "production" && testMode) {
    return { available: false, testMode, reason: "TEST_MODE_BLOCKED_IN_PRODUCTION" };
  }

  return { available: true, testMode, reason: "READY" };
}

export function getLemonBillingAvailability(
  env: BillingEnv = process.env,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): LemonBillingAvailability {
  return availabilityFor(REQUIRED_BILLING_VARS, env, nodeEnv);
}

export function getFounderBillingAvailability(
  env: BillingEnv = process.env,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): LemonBillingAvailability {
  return availabilityFor(REQUIRED_FOUNDER_VARS, env, nodeEnv);
}
