import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasActiveFounderEntitlement } from "@/lib/billing/founder-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  const founder = user.role === "CREATOR"
    ? false
    : await hasActiveFounderEntitlement(user.id);
  const access = user.role === "CREATOR"
    ? "CREATOR"
    : founder
      ? "FOUNDER"
      : user.plan;

  return NextResponse.json({
    data: {
      ...user,
      access,
    },
  });
}
