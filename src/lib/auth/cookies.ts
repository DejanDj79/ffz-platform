export const DEVELOPMENT_SESSION_COOKIE_NAME =
  "ffz_session";

export const PRODUCTION_SESSION_COOKIE_NAME =
  "__Host-ffz_session";

export function sessionCookieName() {
  return process.env.NODE_ENV === "production"
    ? PRODUCTION_SESSION_COOKIE_NAME
    : DEVELOPMENT_SESSION_COOKIE_NAME;
}

export const SESSION_COOKIE_CANDIDATES = [
  DEVELOPMENT_SESSION_COOKIE_NAME,
  PRODUCTION_SESSION_COOKIE_NAME,
] as const;
