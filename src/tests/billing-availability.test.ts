import { describe, expect, it } from "vitest";
import { getLemonBillingAvailability } from "@/lib/billing/availability";

const configured = {
  LEMONSQUEEZY_API_KEY: "key",
  LEMONSQUEEZY_STORE_ID: "1",
  LEMONSQUEEZY_PRODUCT_ID: "2",
  LEMONSQUEEZY_MONTHLY_VARIANT_ID: "3",
  LEMONSQUEEZY_ANNUAL_VARIANT_ID: "4",
  LEMONSQUEEZY_WEBHOOK_SECRET: "secret",
};

describe("Lemon billing availability", () => {
  it("disables billing when configuration is incomplete", () => {
    expect(getLemonBillingAvailability({}, "production")).toEqual({
      available: false,
      testMode: true,
      reason: "MISSING_CONFIGURATION",
    });
  });

  it("allows fully configured test billing outside production", () => {
    expect(getLemonBillingAvailability({
      ...configured,
      LEMONSQUEEZY_TEST_MODE: "true",
    }, "development")).toEqual({
      available: true,
      testMode: true,
      reason: "READY",
    });
  });

  it("blocks test billing in production even if test credentials are present", () => {
    expect(getLemonBillingAvailability({
      ...configured,
      LEMONSQUEEZY_TEST_MODE: "true",
    }, "production")).toEqual({
      available: false,
      testMode: true,
      reason: "TEST_MODE_BLOCKED_IN_PRODUCTION",
    });
  });

  it("allows fully configured live billing in production", () => {
    expect(getLemonBillingAvailability({
      ...configured,
      LEMONSQUEEZY_TEST_MODE: "false",
    }, "production")).toEqual({
      available: true,
      testMode: false,
      reason: "READY",
    });
  });
});
