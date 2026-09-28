import { describe, expect, it } from "vitest";
import {
  getDodoBillingAvailability,
  getDodoFounderAvailability,
  getDodoManagementAvailability,
  getFounderBillingAvailability,
  getPaddleBillingAvailability,
  getPaddleManagementAvailability,
} from "@/lib/billing/availability";

const dodoConfigured = {
  DODO_PAYMENTS_API_KEY: "test_dodo_key",
  DODO_PAYMENTS_WEBHOOK_KEY: "whsec_test",
  DODO_PAYMENTS_ENVIRONMENT: "test_mode",
  DODO_PRO_MONTHLY_PRODUCT_ID: "pdt_monthly",
  DODO_PRO_ANNUAL_PRODUCT_ID: "pdt_annual",
  DODO_FOUNDER_PRODUCT_ID: "pdt_founder",
};

describe("Dodo billing availability", () => {
  it("requires API, webhook and recurring product configuration", () => {
    expect(getDodoBillingAvailability({})).toEqual({
      available: false,
      testMode: true,
      reason: "MISSING_CONFIGURATION",
    });

    expect(getDodoBillingAvailability(dodoConfigured)).toEqual({
      available: true,
      testMode: true,
      reason: "READY",
    });
  });

  it("tracks live mode without blocking test-mode validation", () => {
    expect(getDodoBillingAvailability({
      ...dodoConfigured,
      DODO_PAYMENTS_ENVIRONMENT: "live_mode",
    })).toEqual({
      available: true,
      testMode: false,
      reason: "READY",
    });
  });

  it("checks Founder and management configuration independently", () => {
    expect(getDodoFounderAvailability({
      DODO_PAYMENTS_API_KEY: "test_dodo_key",
      DODO_PAYMENTS_WEBHOOK_KEY: "whsec_test",
      DODO_FOUNDER_PRODUCT_ID: "pdt_founder",
    }).available).toBe(true);

    expect(getDodoManagementAvailability({
      DODO_PAYMENTS_API_KEY: "test_dodo_key",
    }).available).toBe(true);
  });
});

const configured = {
  PADDLE_CLIENT_TOKEN: "test_ffz",
  PADDLE_MONTHLY_PRICE_ID: "pri_monthly",
  PADDLE_ANNUAL_PRICE_ID: "pri_annual",
  PADDLE_WEBHOOK_SECRET: "secret",
  PADDLE_ENVIRONMENT: "sandbox",
};

const founderConfigured = {
  PADDLE_CLIENT_TOKEN: "test_ffz",
  PADDLE_FOUNDER_PRICE_ID: "pri_founder",
  PADDLE_WEBHOOK_SECRET: "secret",
  PADDLE_ENVIRONMENT: "sandbox",
};

describe("Paddle billing availability", () => {
  it("disables billing when configuration is incomplete", () => {
    expect(getPaddleBillingAvailability({}, "development")).toEqual({
      available: false,
      testMode: true,
      reason: "MISSING_CONFIGURATION",
    });
  });

  it("allows fully configured sandbox billing outside production", () => {
    expect(getPaddleBillingAvailability(configured, "development")).toEqual({
      available: true,
      testMode: true,
      reason: "READY",
    });
  });

  it("blocks sandbox billing in production", () => {
    expect(getPaddleBillingAvailability(configured, "production")).toEqual({
      available: false,
      testMode: true,
      reason: "TEST_MODE_BLOCKED_IN_PRODUCTION",
    });
  });

  it("requires a token that matches the selected environment", () => {
    expect(getPaddleBillingAvailability({
      ...configured,
      PADDLE_CLIENT_TOKEN: "live_ffz",
    }, "development")).toEqual({
      available: false,
      testMode: true,
      reason: "TOKEN_MODE_MISMATCH",
    });
  });

  it("allows fully configured live billing in production", () => {
    expect(getPaddleBillingAvailability({
      ...configured,
      PADDLE_CLIENT_TOKEN: "live_ffz",
      PADDLE_ENVIRONMENT: "production",
    }, "production")).toEqual({
      available: true,
      testMode: false,
      reason: "READY",
    });
  });
});

describe("Paddle Founder billing availability", () => {
  it("does not depend on recurring price IDs", () => {
    expect(getFounderBillingAvailability(founderConfigured, "development")).toEqual({
      available: true,
      testMode: true,
      reason: "READY",
    });
  });

  it("stays unavailable until the Founder price is configured", () => {
    expect(getFounderBillingAvailability({
      ...founderConfigured,
      PADDLE_FOUNDER_PRICE_ID: "",
    }, "development")).toEqual({
      available: false,
      testMode: true,
      reason: "MISSING_CONFIGURATION",
    });
  });

  it("blocks Founder sandbox checkout in production", () => {
    expect(getFounderBillingAvailability(founderConfigured, "production")).toEqual({
      available: false,
      testMode: true,
      reason: "TEST_MODE_BLOCKED_IN_PRODUCTION",
    });
  });
});

describe("Paddle management availability", () => {
  it("requires a server-side API key", () => {
    expect(getPaddleManagementAvailability(configured, "development")).toEqual({
      available: false,
      testMode: true,
      reason: "MISSING_CONFIGURATION",
    });
  });

  it("is ready when an API key is configured", () => {
    expect(getPaddleManagementAvailability({
      ...configured,
      PADDLE_API_KEY: "pdl_sdbx_apikey",
    }, "development")).toEqual({
      available: true,
      testMode: true,
      reason: "READY",
    });
  });
});
