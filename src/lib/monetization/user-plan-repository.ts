import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { userPlans } from "@/db/user-plans-schema";
import type { UserPlan } from "./types";

export async function getUserPlan(userId: string): Promise<UserPlan> {
  const rows = await db
    .select({ plan: userPlans.plan })
    .from(userPlans)
    .where(eq(userPlans.userId, userId))
    .limit(1);

  return rows[0]?.plan ?? "FREE";
}

export async function setUserPlan(userId: string, plan: UserPlan): Promise<UserPlan> {
  const now = new Date();
  const rows = await db
    .insert(userPlans)
    .values({ userId, plan, updatedAt: now })
    .onConflictDoUpdate({
      target: userPlans.userId,
      set: { plan, updatedAt: now },
    })
    .returning({ plan: userPlans.plan });

  return rows[0]?.plan ?? plan;
}
