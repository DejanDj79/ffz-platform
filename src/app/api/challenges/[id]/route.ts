import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import {
  deleteChallenge,
  getChallenge,
  updateChallenge,
} from "@/lib/challenges/repository";
import { updateChallengeSchema } from "@/lib/challenges/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

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
    const body = await request.json();
    const input = updateChallengeSchema.parse(body);
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
