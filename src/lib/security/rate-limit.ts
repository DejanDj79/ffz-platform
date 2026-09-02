import { createHmac } from "node:crypto";

type Bucket = {
  count: number;
  resetAt: number;
};

type RateLimitStore = Map<string, Bucket>;

const globalForRateLimit = globalThis as unknown as {
  ffzRateLimitStore?: RateLimitStore;
};

const store =
  globalForRateLimit.ffzRateLimitStore ??
  new Map<string, Bucket>();

if (process.env.NODE_ENV !== "production") {
  globalForRateLimit.ffzRateLimitStore =
    store;
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: number;
};

export function consumeRateLimit(
  key: string,
  input: {
    limit: number;
    windowMs: number;
  },
  now = Date.now(),
): RateLimitResult {
  if (
    !Number.isInteger(input.limit) ||
    input.limit <= 0 ||
    !Number.isFinite(input.windowMs) ||
    input.windowMs <= 0
  ) {
    throw new Error(
      "Invalid rate-limit configuration.",
    );
  }

  cleanupExpiredBuckets(now);

  let bucket = store.get(key);

  if (
    !bucket ||
    now >= bucket.resetAt
  ) {
    bucket = {
      count: 0,
      resetAt: now + input.windowMs,
    };

    store.set(key, bucket);
  }

  bucket.count += 1;

  const allowed =
    bucket.count <= input.limit;

  return {
    allowed,
    remaining: Math.max(
      0,
      input.limit - bucket.count,
    ),
    retryAfterSeconds: Math.max(
      1,
      Math.ceil(
        (bucket.resetAt - now) / 1000,
      ),
    ),
    resetAt: bucket.resetAt,
  };
}

export function clearRateLimit(
  key: string,
) {
  store.delete(key);
}

export function getClientAddress(
  request: Request,
) {
  const forwarded =
    request.headers
      .get("x-forwarded-for")
      ?.split(",")[0]
      ?.trim();

  return (
    forwarded ||
    request.headers
      .get("x-real-ip")
      ?.trim() ||
    request.headers
      .get("cf-connecting-ip")
      ?.trim() ||
    "unknown"
  );
}

export function hashRateLimitKey(
  parts: string[],
) {
  const salt =
    process.env.AUTH_RATE_LIMIT_SALT ??
    "ffz-development-rate-limit-salt";

  return createHmac("sha256", salt)
    .update(parts.join("\u0000"))
    .digest("hex");
}

function cleanupExpiredBuckets(
  now: number,
) {
  // Avoid scanning the map on every small request set.
  if (store.size < 500) return;

  for (const [key, bucket] of store) {
    if (now >= bucket.resetAt) {
      store.delete(key);
    }
  }
}

// Test-only utility. It is harmless in production and not called by app code.
export function clearAllRateLimitsForTests() {
  store.clear();
}
