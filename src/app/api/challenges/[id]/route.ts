import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import {
  deleteChallenge,
  getChallenge,
  listChallenges,
  updateChallenge,
} from "@/lib/challenges/repository";
import { updateChallengeSchema } from "@/lib/challenges/validation";
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

type RouteContext = {
  params: Promise<{ id: string }>;
};

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
      error: "Reusable custom prop rule presets require FFZ Pro.",
      code: "PRO_REQUIRED",
      upgradeUrl: "/upgrade",
    },
    { status: 403 },
  );
}

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    const { id } = await context.params;
    const challenge = await getChallenge(user.id, id);

    if (!challenge) {
      return NextResponse.json(
        { error: "Challenge not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: challenge });
  } catch (error) {
    console.error("GET /api/challenges/[id] failed:", error);
    return NextResponse.json(
      { error: "Unable to load challenge." },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    const { id } = await context.params;
    const current = await getChallenge(user.id, id);

    if (!current) {
      return NextResponse.json(
        { error: "Challenge not found." },
        { status: 404 },
      );
    }

    const body = await request.json();
    const input = updateChallengeSchema.parse(body);

    if (
      input.rulesPresetId !== undefined &&
      parseCustomPresetRef(input.rulesPresetId) &&
      !hasEntitlement(user.plan, "CUSTOM_PROP_RULES")
    ) {
      return customRulesResponse();
    }

    const nextStatus = input.status ?? current.status;
    const activating =
      countsTowardActiveChallengeLimit(nextStatus) &&
      !countsTowardActiveChallengeLimit(current.status);

    if (activating) {
      const existing = await listChallenges(user.id, { syncFromJournal: false });
      if (!canCreateActiveChallenge(user.plan, countActiveChallenges(existing, id))) {
        return planLimitResponse();
      }
    }

    const challenge = await updateChallenge(user.id, id, input);

    if (!challenge) {
      return NextResponse.json(
        { error: "Challenge not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: challenge });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid challenge data.", issues: error.issues },
        { status: 400 },
      );
    }

    console.error("PATCH /api/challenges/[id] failed:", error);
    return NextResponse.json(
      { error: "Unable to update challenge." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext,
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    const { id } = await context.params;
    const deleted = await deleteChallenge(user.id, id);

    if (!deleted) {
      return NextResponse.json(
        { error: "Challenge not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, id: deleted.id });
  } catch (error) {
    console.error("DELETE /api/challenges/[id] failed:", error);
    return NextResponse.json(
      { error: "Unable to delete challenge." },
      { status: 500 },
    );
  }
}
