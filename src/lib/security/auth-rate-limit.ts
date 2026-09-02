import { NextResponse } from "next/server";
import {
  consumeRateLimit,
  getClientAddress,
  hashRateLimitKey,
  type RateLimitResult,
} from "./rate-limit";

export function consumeLoginIpLimit(
  request: Request,
) {
  return consumeRateLimit(
    hashRateLimitKey([
      "auth-login-ip",
      getClientAddress(request),
    ]),
    {
      limit: 30,
      windowMs: 15 * 60 * 1000,
    },
  );
}

export function loginAccountRateLimitKey(
  request: Request,
  email: string,
) {
  return hashRateLimitKey([
    "auth-login-account",
    getClientAddress(request),
    email,
  ]);
}

export function consumeLoginAccountLimit(
  key: string,
) {
  return consumeRateLimit(key, {
    limit: 8,
    windowMs: 15 * 60 * 1000,
  });
}

export function consumeRegisterIpLimit(
  request: Request,
) {
  return consumeRateLimit(
    hashRateLimitKey([
      "auth-register-ip",
      getClientAddress(request),
    ]),
    {
      limit: 5,
      windowMs: 60 * 60 * 1000,
    },
  );
}

export function rateLimitResponse(
  result: RateLimitResult,
  message: string,
) {
  return NextResponse.json(
    { error: message },
    {
      status: 429,
      headers: {
        "Retry-After": String(
          result.retryAfterSeconds,
        ),
        "Cache-Control": "no-store",
      },
    },
  );
}
