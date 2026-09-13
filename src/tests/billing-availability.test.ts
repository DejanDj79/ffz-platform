import { describe, expect, it } from "vitest";
import {
  getFounderBillingAvailability,
  getPaddleBillingAvailability,
  getPaddleManagementAvailability,
} from "@/lib/billing/availability";

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
