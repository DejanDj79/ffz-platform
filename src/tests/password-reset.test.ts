import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq, sql } from "drizzle-orm";
import { users, sessions, passwordResetTokens } from "@/db/schema";
import { hashSessionToken } from "@/lib/auth/token";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

const state = vi.hoisted(() => ({ db: null as any, send: vi.fn() }));
vi.mock("@/db/client", () => ({ get db() { return state.db; } }));
vi.mock("@/lib/auth/reset-mail", () => ({ sendPasswordResetEmail: state.send }));
import { completePasswordReset, requestPasswordReset } from "@/lib/auth/password-reset";

const pg = new PGlite();
const db = drizzle(pg);
let userId: string;
let otherId: string;
let originalHash: string;

beforeAll(async () => {
  await pg.exec(readFileSync("drizzle-production/0000_production_baseline.sql", "utf8"));
  await pg.exec(readFileSync("drizzle-production/0006_password_reset_tokens.sql", "utf8"));
  state.db = db;
  originalHash = await hashPassword("original-password");
}, 30_000);
afterAll(async () => { await pg.close(); });
beforeEach(async () => {
  await db.delete(users);
  state.send.mockReset().mockResolvedValue(undefined);
  const created = await db.insert(users).values([
    { email: "trader@example.com", passwordHash: originalHash },
    { email: "other@example.com", passwordHash: originalHash },
  ]).returning();
  userId = created[0].id;
  otherId = created[1].id;
  await db.insert(sessions).values([userId, otherId].map((id) => ({
    userId: id, tokenHash: hashSessionToken(id), expiresAt: new Date(Date.now() + 60_000),
  })));
});

function sentToken() { return state.send.mock.calls.at(-1)![1] as string; }

describe("password recovery against embedded PostgreSQL", () => {
  it("ignores unknown accounts and stores only a token digest for known accounts", async () => {
    await requestPasswordReset("absent@example.com");
    expect(state.send).not.toHaveBeenCalled();
    await requestPasswordReset("trader@example.com");
    const [row] = await db.select().from(passwordResetTokens);
    expect(row.tokenHash).toBe(hashSessionToken(sentToken()));
    expect(row.tokenHash).not.toBe(sentToken());
    expect(row.expiresAt.getTime() - row.createdAt.getTime()).toBe(30 * 60_000);
    expect((await db.select().from(users).where(eq(users.id, userId)))[0].passwordHash).toBe(originalHash);
  });

  it("changes the password once, revokes only that user's sessions and preserves the other account", async () => {
    await requestPasswordReset("trader@example.com");
    const token = sentToken();
    expect(await completePasswordReset(token, "new-password")).toBe(true);
    expect(await completePasswordReset(token, "another-password")).toBe(false);
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    expect(await verifyPassword("new-password", user.passwordHash!)).toBe(true);
    expect(await verifyPassword("original-password", user.passwordHash!)).toBe(false);
    expect((await db.select().from(sessions)).map((row) => row.userId)).toEqual([otherId]);
    expect((await db.select().from(users).where(eq(users.id, otherId)))[0].passwordHash).toBe(originalHash);
    expect(await db.select().from(passwordResetTokens)).toHaveLength(0);
  });

  it("rejects expired and incorrect tokens without changing password or sessions", async () => {
    await requestPasswordReset("trader@example.com");
    expect(await completePasswordReset("x".repeat(43), "new-password")).toBe(false);
    await db.update(passwordResetTokens).set({ expiresAt: new Date(0) });
    expect(await completePasswordReset(sentToken(), "new-password")).toBe(false);
    expect(await db.select().from(sessions)).toHaveLength(2);
    expect((await db.select().from(users).where(eq(users.id, userId)))[0].passwordHash).toBe(originalHash);
  });

  it("enforces persistent cooldown and invalidates the older link when a new one is issued", async () => {
    await requestPasswordReset("trader@example.com");
    const oldToken = sentToken();
    await requestPasswordReset("trader@example.com");
    expect(state.send).toHaveBeenCalledTimes(1);
    await db.update(passwordResetTokens).set({ createdAt: sql`now() - interval '6 minutes'` });
    await requestPasswordReset("trader@example.com");
    expect(state.send).toHaveBeenCalledTimes(2);
    expect(await completePasswordReset(oldToken, "new-password")).toBe(false);
    expect(await completePasswordReset(sentToken(), "new-password")).toBe(true);
  });

  it("removes an undelivered token and allows a later retry", async () => {
    state.send.mockRejectedValueOnce(new Error("SMTP failure"));
    await expect(requestPasswordReset("trader@example.com")).rejects.toThrow("delivery failed");
    expect(await db.select().from(passwordResetTokens)).toHaveLength(0);
    await requestPasswordReset("trader@example.com");
    expect(state.send).toHaveBeenCalledTimes(2);
  });

  it("rolls back token consumption and password change when session revocation fails", async () => {
    await requestPasswordReset("trader@example.com");
    const token = sentToken();
    await pg.exec(`CREATE FUNCTION reject_session_delete() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'test revocation failure'; END $$;
      CREATE TRIGGER reject_session_delete BEFORE DELETE ON sessions FOR EACH ROW EXECUTE FUNCTION reject_session_delete();`);
    try {
      await expect(completePasswordReset(token, "new-password")).rejects.toThrow();
      expect(await db.select().from(passwordResetTokens)).toHaveLength(1);
      expect((await db.select().from(users).where(eq(users.id, userId)))[0].passwordHash).toBe(originalHash);
    } finally {
      await pg.exec("DROP TRIGGER reject_session_delete ON sessions; DROP FUNCTION reject_session_delete();");
    }
    expect(await completePasswordReset(token, "new-password")).toBe(true);
  });

  it("accepts only one of two simultaneous uses of the same link", async () => {
    await requestPasswordReset("trader@example.com");
    const token = sentToken();
    const results = await Promise.all([
      completePasswordReset(token, "first-password"), completePasswordReset(token, "second-password"),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });
});
