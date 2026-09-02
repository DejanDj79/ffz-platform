import {
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  DEVELOPMENT_SESSION_COOKIE_NAME,
  PRODUCTION_SESSION_COOKIE_NAME,
  sessionCookieName,
} from "@/lib/auth/cookies";

describe("session cookie naming", () => {
  it("uses the normal cookie name in development", () => {
    vi.stubEnv(
      "NODE_ENV",
      "development",
    );

    expect(sessionCookieName()).toBe(
      DEVELOPMENT_SESSION_COOKIE_NAME,
    );

    vi.unstubAllEnvs();
  });

  it("uses a __Host- cookie in production", () => {
    vi.stubEnv(
      "NODE_ENV",
      "production",
    );

    expect(sessionCookieName()).toBe(
      PRODUCTION_SESSION_COOKIE_NAME,
    );

    vi.unstubAllEnvs();
  });
});
