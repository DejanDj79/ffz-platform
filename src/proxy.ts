import {
  NextResponse,
  type NextRequest,
} from "next/server";
import {
  SESSION_COOKIE_CANDIDATES,
} from "@/lib/auth/cookies";

const PUBLIC_PAGE_PATHS = new Set([
  "/tools/risk-calculator",
]);

const PROTECTED_PAGE_PREFIXES = [
  "/dashboard",
  "/tools",
  "/challenges",
  "/journal",
  "/ledger",
  "/prop-journey",
  "/economic-calendar",
  "/scoreboard",
];

function isProtectedPage(
  pathname: string,
) {
  if (PUBLIC_PAGE_PATHS.has(pathname)) {
    return false;
  }

  return (
    pathname === "/" ||
    PROTECTED_PAGE_PREFIXES.some(
      (prefix) =>
        pathname === prefix ||
        pathname.startsWith(
          `${prefix}/`,
        ),
    )
  );
}

function hasSessionCookie(
  request: NextRequest,
) {
  return SESSION_COOKIE_CANDIDATES.some(
    (name) =>
      Boolean(
        request.cookies.get(name)?.value,
      ),
  );
}

function applySecurityHeaders(
  response: NextResponse,
) {
  response.headers.set(
    "X-Content-Type-Options",
    "nosniff",
  );

  response.headers.set(
    "Referrer-Policy",
    "strict-origin-when-cross-origin",
  );

  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  );

  // SAMEORIGIN intentionally preserves the Scoreboard's
  // same-origin iframe preview while blocking third-party framing.
  response.headers.set(
    "X-Frame-Options",
    "SAMEORIGIN",
  );

  if (
    process.env.NODE_ENV ===
    "production"
  ) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000",
    );
  }

  return response;
}

export function proxy(
  request: NextRequest,
) {
  const { pathname } =
    request.nextUrl;

  if (
    isProtectedPage(pathname) &&
    !hasSessionCookie(request)
  ) {
    const loginUrl =
      request.nextUrl.clone();

    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set(
      "next",
      `${pathname}${request.nextUrl.search}`,
    );

    return applySecurityHeaders(
      NextResponse.redirect(loginUrl),
    );
  }

  return applySecurityHeaders(
    NextResponse.next(),
  );
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
