import { describe, expect, it } from "vitest";
import {
  getFounderBillingAvailability,
  getLemonBillingAvailability,
} from "@/lib/billing/availability";

const configured = {
  LEMONSQUEEZY_API_KEY: "key",
  LEMONSQUEEZY_STORE_ID: "1",
  LEMONSQUEEZY_PRODUCT_ID: "2",
  LEMONSQUEEZY_MONTHLY_VARIANT_ID: "3",
  LEMONSQUEEZY_ANNUAL_VARIANT_ID: "4",
  LEMONSQUEEZY_WEBHOOK_SECRET: "secret",
};

const founderConfigured = {
  LEMONSQUEEZY_API_KEY: "key",
  LEMONSQUEEZY_STORE_ID: "1",
  LEMONSQUEEZY_FOUNDER_VARIANT_ID: "5",
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

describe("Founder billing availability", () => {
  it("does not depend on recurring product or subscription variant IDs", () => {
    expect(getFounderBillingAvailability({
      ...founderConfigured,
      LEMONSQUEEZY_TEST_MODE: "true",
    }, "development")).toEqual({
      available: true,
      testMode: true,
      reason: "READY",
    });
  });

  it("stays unavailable until the Founder variant is configured", () => {
    expect(getFounderBillingAvailability({
      ...founderConfigured,
      LEMONSQUEEZY_FOUNDER_VARIANT_ID: "",
      LEMONSQUEEZY_TEST_MODE: "false",
    }, "production")).toEqual({
      available: false,
      testMode: false,
      reason: "MISSING_CONFIGURATION",
    });
  });

  it("blocks Founder test checkout in production", () => {
    expect(getFounderBillingAvailability({
      ...founderConfigured,
      LEMONSQUEEZY_TEST_MODE: "true",
    }, "production")).toEqual({
      available: false,
      testMode: true,
      reason: "TEST_MODE_BLOCKED_IN_PRODUCTION",
    });
  });
});
