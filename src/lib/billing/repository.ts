import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { userPlans } from "@/db/user-plans-schema";
import {
  planForLemonStatus,
  type LemonSubscriptionSnapshot,
} from "./lemon";

export type BillingState = {
  provider: string | null;
  customerId: string | null;
  subscriptionId: string | null;
  productId: string | null;
  variantId: string | null;
  status: string | null;
  renewsAt: Date | null;
  endsAt: Date | null;
  testMode: boolean | null;
  providerUpdatedAt: Date | null;
};

export async function getUserBillingState(userId: string): Promise<BillingState> {
  const rows = await db
    .select({
      provider: userPlans.billingProvider,
      customerId: userPlans.providerCustomerId,
      subscriptionId: userPlans.providerSubscriptionId,
      productId: userPlans.providerProductId,
      variantId: userPlans.providerVariantId,
      status: userPlans.subscriptionStatus,
      renewsAt: userPlans.subscriptionRenewsAt,
      endsAt: userPlans.subscriptionEndsAt,
      testMode: userPlans.subscriptionTestMode,
      providerUpdatedAt: userPlans.providerUpdatedAt,
    })
    .from(userPlans)
    .where(eq(userPlans.userId, userId))
    .limit(1);

  return rows[0] ?? {
    provider: null,
    customerId: null,
    subscriptionId: null,
    productId: null,
    variantId: null,
    status: null,
    renewsAt: null,
    endsAt: null,
    testMode: null,
    providerUpdatedAt: null,
  };
}

export async function findUserIdByProviderSubscriptionId(subscriptionId: string) {
  const rows = await db
    .select({ userId: userPlans.userId })
    .from(userPlans)
    .where(eq(userPlans.providerSubscriptionId, subscriptionId))
    .limit(1);

  return rows[0]?.userId ?? null;
}

export async function syncLemonSubscription(
  userId: string,
  snapshot: LemonSubscriptionSnapshot,
  options: { bypassStaleGuard?: boolean } = {},
) {
  const current = await getUserBillingState(userId);

  if (
    !options.bypassStaleGuard &&
    current.providerUpdatedAt &&
    current.providerUpdatedAt.getTime() > snapshot.providerUpdatedAt.getTime()
  ) {
    return { applied: false as const, plan: null };
  }

  const now = new Date();
  const plan = planForLemonStatus(snapshot.status);

  await db
    .insert(userPlans)
    .values({
      userId,
      plan,
      billingProvider: "LEMON_SQUEEZY",
      providerCustomerId: snapshot.customerId,
      providerSubscriptionId: snapshot.subscriptionId,
      providerProductId: snapshot.productId,
      providerVariantId: snapshot.variantId,
      subscriptionStatus: snapshot.status,
      subscriptionRenewsAt: snapshot.renewsAt,
      subscriptionEndsAt: snapshot.endsAt,
      subscriptionTestMode: snapshot.testMode,
      providerUpdatedAt: snapshot.providerUpdatedAt,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userPlans.userId,
      set: {
        plan,
        billingProvider: "LEMON_SQUEEZY",
        providerCustomerId: snapshot.customerId,
        providerSubscriptionId: snapshot.subscriptionId,
        providerProductId: snapshot.productId,
        providerVariantId: snapshot.variantId,
        subscriptionStatus: snapshot.status,
        subscriptionRenewsAt: snapshot.renewsAt,
        subscriptionEndsAt: snapshot.endsAt,
        subscriptionTestMode: snapshot.testMode,
        providerUpdatedAt: snapshot.providerUpdatedAt,
        updatedAt: now,
      },
    });

  return { applied: true as const, plan };
}
