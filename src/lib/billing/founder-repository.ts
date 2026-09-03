import crypto from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  founderSlots,
  type FounderSlotRow,
  type FounderSlotStatus,
} from "@/db/founder-slots-schema";
import { userPlans } from "@/db/user-plans-schema";
import {
  FOUNDER_RESERVATION_MINUTES,
  FOUNDER_TOTAL_SLOTS,
  type FounderOrderSnapshot,
} from "./founder";
import { isLemonSubscriptionStatus, planForLemonStatus } from "./lemon";

const FOUNDER_ADVISORY_LOCK = 150199;

export type FounderOfferState = {
  total: number;
  remaining: number;
  claimed: number;
  activeReservations: number;
  soldOut: boolean;
  userStatus: FounderSlotStatus | null;
  userSlotNo: number | null;
  hasActiveReservation: boolean;
};

export type FounderReservationResult =
  | {
      kind: "RESERVED";
      slotNo: number;
      reservationToken: string;
      expiresAt: Date;
      checkoutUrl: string | null;
    }
  | { kind: "PURCHASED"; slotNo: number }
  | { kind: "REFUNDED"; slotNo: number }
  | { kind: "SOLD_OUT" };

function status(row: FounderSlotRow): FounderSlotStatus {
  return row.status as FounderSlotStatus;
}

function isExpiredReservation(row: FounderSlotRow, now: Date) {
  return status(row) === "RESERVED" &&
    (!row.reservationExpiresAt || row.reservationExpiresAt.getTime() <= now.getTime());
}

function isAvailableNow(row: FounderSlotRow, now: Date) {
  return status(row) === "AVAILABLE" || isExpiredReservation(row, now);
}

function reservationExpiry(now = new Date()) {
  return new Date(now.getTime() + FOUNDER_RESERVATION_MINUTES * 60 * 1000);
}

export async function getFounderOfferState(userId?: string | null): Promise<FounderOfferState> {
  const rows = await db.select().from(founderSlots).orderBy(asc(founderSlots.slotNo));
  const now = new Date();
  const userSlot = userId ? rows.find((row) => row.userId === userId) ?? null : null;
  const activeReservations = rows.filter(
    (row) => status(row) === "RESERVED" && !isExpiredReservation(row, now),
  ).length;
  const claimed = rows.filter(
    (row) => status(row) === "PURCHASED" || status(row) === "REFUNDED",
  ).length;
  const remaining = rows.filter((row) => isAvailableNow(row, now)).length;
  const hasActiveReservation = Boolean(
    userSlot && status(userSlot) === "RESERVED" && !isExpiredReservation(userSlot, now),
  );

  return {
    total: FOUNDER_TOTAL_SLOTS,
    remaining,
    claimed,
    activeReservations,
    soldOut: remaining === 0 && !hasActiveReservation,
    userStatus: userSlot ? status(userSlot) : null,
    userSlotNo: userSlot?.slotNo ?? null,
    hasActiveReservation,
  };
}

export async function reserveFounderSlot(userId: string): Promise<FounderReservationResult> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${FOUNDER_ADVISORY_LOCK})`);

    const rows = await tx.select().from(founderSlots).orderBy(asc(founderSlots.slotNo));
    const now = new Date();
    const expiresAt = reservationExpiry(now);
    const existing = rows.find((row) => row.userId === userId) ?? null;

    if (existing) {
      const currentStatus = status(existing);
      if (currentStatus === "PURCHASED") {
        return { kind: "PURCHASED", slotNo: existing.slotNo };
      }
      if (currentStatus === "REFUNDED") {
        return { kind: "REFUNDED", slotNo: existing.slotNo };
      }
      if (currentStatus === "RESERVED" && !isExpiredReservation(existing, now)) {
        if (!existing.reservationToken || !existing.reservationExpiresAt) {
          throw new Error("FOUNDER_RESERVATION_INVALID");
        }
        return {
          kind: "RESERVED",
          slotNo: existing.slotNo,
          reservationToken: existing.reservationToken,
          expiresAt: existing.reservationExpiresAt,
          checkoutUrl: existing.checkoutUrl,
        };
      }

      const reservationToken = crypto.randomUUID();
      await tx.update(founderSlots).set({
        status: "RESERVED",
        reservationToken,
        reservationExpiresAt: expiresAt,
        checkoutUrl: null,
        providerOrderId: null,
        providerCustomerId: null,
        providerProductId: null,
        providerVariantId: null,
        purchaseTestMode: null,
        purchasedAt: null,
        refundedAt: null,
        updatedAt: now,
      }).where(eq(founderSlots.slotNo, existing.slotNo));

      return {
        kind: "RESERVED",
        slotNo: existing.slotNo,
        reservationToken,
        expiresAt,
        checkoutUrl: null,
      };
    }

    const available = rows.find((row) => isAvailableNow(row, now));
    if (!available) return { kind: "SOLD_OUT" };

    const reservationToken = crypto.randomUUID();
    await tx.update(founderSlots).set({
      userId,
      status: "RESERVED",
      reservationToken,
      reservationExpiresAt: expiresAt,
      checkoutUrl: null,
      providerOrderId: null,
      providerCustomerId: null,
      providerProductId: null,
      providerVariantId: null,
      purchaseTestMode: null,
      purchasedAt: null,
      refundedAt: null,
      updatedAt: now,
    }).where(eq(founderSlots.slotNo, available.slotNo));

    return {
      kind: "RESERVED",
      slotNo: available.slotNo,
      reservationToken,
      expiresAt,
      checkoutUrl: null,
    };
  });
}

export async function attachFounderCheckoutUrl(input: {
  userId: string;
  slotNo: number;
  reservationToken: string;
  checkoutUrl: string;
}) {
  const rows = await db.update(founderSlots).set({
    checkoutUrl: input.checkoutUrl,
    updatedAt: new Date(),
  }).where(and(
    eq(founderSlots.slotNo, input.slotNo),
    eq(founderSlots.userId, input.userId),
    eq(founderSlots.status, "RESERVED"),
    eq(founderSlots.reservationToken, input.reservationToken),
  )).returning({ slotNo: founderSlots.slotNo });

  return Boolean(rows[0]);
}

export async function releaseFounderReservation(input: {
  userId: string;
  slotNo: number;
  reservationToken: string;
}) {
  await db.update(founderSlots).set({
    userId: null,
    status: "AVAILABLE",
    reservationToken: null,
    reservationExpiresAt: null,
    checkoutUrl: null,
    updatedAt: new Date(),
  }).where(and(
    eq(founderSlots.slotNo, input.slotNo),
    eq(founderSlots.userId, input.userId),
    eq(founderSlots.status, "RESERVED"),
    eq(founderSlots.reservationToken, input.reservationToken),
  ));
}

export async function hasActiveFounderEntitlement(userId: string) {
  const rows = await db.select({ slotNo: founderSlots.slotNo })
    .from(founderSlots)
    .where(and(
      eq(founderSlots.userId, userId),
      eq(founderSlots.status, "PURCHASED"),
    ))
    .limit(1);

  return Boolean(rows[0]);
}

export async function completeFounderPurchase(snapshot: FounderOrderSnapshot) {
  if (!snapshot.userId || !snapshot.slotNo || !snapshot.reservationToken) {
    return { applied: false as const, reason: "missing_custom_data" as const };
  }

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${FOUNDER_ADVISORY_LOCK})`);

    const existingOrder = await tx.select().from(founderSlots)
      .where(eq(founderSlots.providerOrderId, snapshot.orderId))
      .limit(1);

    if (existingOrder[0]) {
      return {
        applied: false as const,
        reason: "already_processed" as const,
        userId: existingOrder[0].userId,
        slotNo: existingOrder[0].slotNo,
      };
    }

    const rows = await tx.select().from(founderSlots)
      .where(eq(founderSlots.slotNo, snapshot.slotNo))
      .limit(1);
    const slot = rows[0];

    if (
      !slot ||
      status(slot) !== "RESERVED" ||
      slot.userId !== snapshot.userId ||
      slot.reservationToken !== snapshot.reservationToken
    ) {
      return { applied: false as const, reason: "reservation_mismatch" as const };
    }

    await tx.update(founderSlots).set({
      status: "PURCHASED",
      reservationExpiresAt: null,
      checkoutUrl: null,
      providerOrderId: snapshot.orderId,
      providerCustomerId: snapshot.customerId,
      providerProductId: snapshot.productId,
      providerVariantId: snapshot.variantId,
      purchaseTestMode: snapshot.testMode,
      purchasedAt: snapshot.createdAt,
      refundedAt: null,
      updatedAt: snapshot.updatedAt,
    }).where(eq(founderSlots.slotNo, slot.slotNo));

    const now = new Date();
    await tx.insert(userPlans).values({
      userId: snapshot.userId,
      plan: "PRO",
      updatedAt: now,
    }).onConflictDoUpdate({
      target: userPlans.userId,
      set: {
        plan: "PRO",
        updatedAt: now,
      },
    });

    return {
      applied: true as const,
      reason: "purchased" as const,
      userId: snapshot.userId,
      slotNo: slot.slotNo,
    };
  });
}

export async function refundFounderPurchase(snapshot: FounderOrderSnapshot) {
  if (!snapshot.fullyRefunded) {
    return { applied: false as const, reason: "partial_refund" as const };
  }

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${FOUNDER_ADVISORY_LOCK})`);

    const rows = await tx.select().from(founderSlots)
      .where(eq(founderSlots.providerOrderId, snapshot.orderId))
      .limit(1);
    const slot = rows[0];

    if (!slot) return { applied: false as const, reason: "order_not_found" as const };
    if (status(slot) === "REFUNDED") {
      return {
        applied: false as const,
        reason: "already_refunded" as const,
        userId: slot.userId,
        slotNo: slot.slotNo,
      };
    }
    if (status(slot) !== "PURCHASED" || !slot.userId) {
      return { applied: false as const, reason: "not_purchased" as const };
    }

    await tx.update(founderSlots).set({
      status: "REFUNDED",
      refundedAt: snapshot.updatedAt,
      checkoutUrl: null,
      updatedAt: snapshot.updatedAt,
    }).where(eq(founderSlots.slotNo, slot.slotNo));

    const planRows = await tx.select({ subscriptionStatus: userPlans.subscriptionStatus })
      .from(userPlans)
      .where(eq(userPlans.userId, slot.userId))
      .limit(1);
    const subscriptionStatus = planRows[0]?.subscriptionStatus;
    const plan = isLemonSubscriptionStatus(subscriptionStatus)
      ? planForLemonStatus(subscriptionStatus)
      : "FREE";

    await tx.insert(userPlans).values({
      userId: slot.userId,
      plan,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: userPlans.userId,
      set: { plan, updatedAt: new Date() },
    });

    return {
      applied: true as const,
      reason: "refunded" as const,
      userId: slot.userId,
      slotNo: slot.slotNo,
      plan,
    };
  });
}
