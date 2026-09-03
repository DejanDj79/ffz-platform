import { NextResponse } from "next/server";
import {
  getLemonConfig,
  isExpectedLemonSubscription,
  subscriptionSnapshotFromWebhook,
  verifyLemonSignature,
  type LemonWebhookPayload,
} from "@/lib/billing/lemon";
import {
  findUserIdByProviderSubscriptionId,
  syncLemonSubscription,
} from "@/lib/billing/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const config = getLemonConfig({ requireWebhookSecret: true });
    const secret = config.webhookSecret as string;

    if (!verifyLemonSignature(rawBody, request.headers.get("x-signature"), secret)) {
      return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
    }

    const payload = JSON.parse(rawBody) as LemonWebhookPayload;
    const eventName = payload.meta?.event_name ?? "";

    if (!eventName.startsWith("subscription_")) {
      return NextResponse.json({ ok: true, ignored: "event_type" });
    }

    const snapshot = subscriptionSnapshotFromWebhook(payload);
    if (!snapshot) {
      return NextResponse.json({ ok: true, ignored: "payload_type" });
    }

    if (!isExpectedLemonSubscription(snapshot, config)) {
      return NextResponse.json({ ok: true, ignored: "different_product_or_mode" });
    }

    const customUserId = payload.meta?.custom_data?.user_id;
    let userId = typeof customUserId === "string" ? customUserId : null;

    if (!userId) {
      userId = await findUserIdByProviderSubscriptionId(snapshot.subscriptionId);
    }

    // A direct Lemon store purchase does not contain our FFZ user ID. Do not
    // guess by email; only FFZ-created checkouts are automatically entitled.
    if (!userId) {
      console.warn("Lemon webhook could not be linked to an FFZ user:", snapshot.subscriptionId);
      return NextResponse.json({ ok: true, ignored: "unlinked_subscription" });
    }

    const result = await syncLemonSubscription(userId, snapshot);

    return NextResponse.json({
      ok: true,
      event: eventName,
      applied: result.applied,
      plan: result.plan,
    });
  } catch (error) {
    console.error("POST /api/billing/webhook failed:", error);
    return NextResponse.json(
      { error: "Unable to process billing webhook." },
      { status: 500 },
    );
  }
}
