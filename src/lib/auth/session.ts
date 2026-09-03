import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db/client";
import { sessions, users } from "@/db/schema";
import { userPlans } from "@/db/user-plans-schema";
import type { AuthUser } from "./types";
import {
  PRODUCTION_SESSION_COOKIE_NAME,
  SESSION_COOKIE_CANDIDATES,
  sessionCookieName,
} from "./cookies";
import { createSessionToken, hashSessionToken } from "./token";

const SESSION_DAYS = 30;

function sessionExpiry() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);
  return expiresAt;
}

export async function createSession(userId: string) {
  const rawToken = createSessionToken();
  const tokenHash = hashSessionToken(rawToken);
  const expiresAt = sessionExpiry();

  await db.insert(sessions).values({
    userId,
    tokenHash,
    expiresAt,
  });

  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName(), rawToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    priority: "high",
  });
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const rawToken = SESSION_COOKIE_CANDIDATES
    .map((name) => cookieStore.get(name)?.value)
    .find(Boolean);

  if (!rawToken) return null;

  const tokenHash = hashSessionToken(rawToken);

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
      plan: userPlans.plan,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .leftJoin(userPlans, eq(userPlans.userId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  const user = rows[0];
  if (!user) return null;

  return {
    ...user,
    plan: user.plan ?? "FREE",
  };
}

export async function destroyCurrentSession() {
  const cookieStore = await cookies();
  const rawTokens = SESSION_COOKIE_CANDIDATES
    .map((name) => cookieStore.get(name)?.value)
    .filter((value): value is string => Boolean(value));

  for (const rawToken of rawTokens) {
    await db
      .delete(sessions)
      .where(
        eq(
          sessions.tokenHash,
          hashSessionToken(rawToken),
        ),
      );
  }

  for (const name of SESSION_COOKIE_CANDIDATES) {
    cookieStore.set(name, "", {
      httpOnly: true,
      sameSite: "lax",
      secure:
        name === PRODUCTION_SESSION_COOKIE_NAME,
      path: "/",
      expires: new Date(0),
      maxAge: 0,
      priority: "high",
    });
  }
}
