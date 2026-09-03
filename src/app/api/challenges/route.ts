import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import {
  createChallenge,
  listChallenges,
} from "@/lib/challenges/repository";
import { createChallengeSchema } from "@/lib/challenges/validation";
import {
  countActiveChallenges,
  countsTowardActiveChallengeLimit,
} from "@/lib/monetization/challenge-limits";
import {
  canCreateActiveChallenge,
  hasEntitlement,
} from "@/lib/monetization/entitlements";
import { parseCustomPresetRef } from "@/lib/prop-firms/custom-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function planLimitResponse() {
  return NextResponse.json(
    {
      error: "FFZ Free supports one active Challenge / Funded account. Close or finish the current active account, or upgrade to FFZ Pro for unlimited active accounts.",
      code: "PLAN_LIMIT",
      upgradeUrl: "/upgrade",
    },
    { status: 403 },
  );
}

function customRulesResponse() {
  return NextResponse.json(
    {
      error: "Reusable custom prop rule presets require FFZ Pro. Manual challenge values and built-in presets remain available on Free.",
      code: "PRO_REQUIRED",
      upgradeUrl: "/upgrade",
    },
    { status: 403 },
  );
}

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    const data = await listChallenges(user.id, {
      syncFromJournal: hasEntitlement(user.plan, "AUTO_CHALLENGE_SYNC"),
    });
    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/challenges failed:", error);
    return NextResponse.json(
      { error: "Unable to load challenges." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    const body = await request.json();
    const input = createChallengeSchema.parse(body);

    if (
      parseCustomPresetRef(input.rulesPresetId) &&
      !hasEntitlement(user.plan, "CUSTOM_PROP_RULES")
    ) {
      return customRulesResponse();
    }

    if (countsTowardActiveChallengeLimit(input.status)) {
      const existing = await listChallenges(user.id, { syncFromJournal: false });
      if (!canCreateActiveChallenge(user.plan, countActiveChallenges(existing))) {
        return planLimitResponse();
      }
    }

    const challenge = await createChallenge(user.id, input);

    return NextResponse.json({ data: challenge }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid challenge data.", issues: error.issues },
        { status: 400 },
      );
    }

    console.error("POST /api/challenges failed:", error);
    return NextResponse.json(
      { error: "Unable to create challenge." },
      { status: 500 },
    );
  }
}
