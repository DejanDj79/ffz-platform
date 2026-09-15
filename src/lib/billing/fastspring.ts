export type FastSpringBillingInterval = "MONTHLY" | "ANNUAL";

type FastSpringConfig = {
  storefront: string;
  monthlyProductPath: string;
  annualProductPath: string;
  founderProductPath: string;
  testMode: boolean;
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

export function fastSpringProductPathForInterval(
  interval: FastSpringBillingInterval,
  config = getFastSpringConfig(),
) {
  return interval === "MONTHLY"
    ? config.monthlyProductPath
    : config.annualProductPath;
}
