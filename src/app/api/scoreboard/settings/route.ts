import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { canAccessCreatorTools } from "@/lib/auth/roles";
import {
  getOrCreateScoreboardSettings,
  updateScoreboardSettings,
} from "@/lib/scoreboard/repository";
import { updateScoreboardSettingsSchema } from "@/lib/scoreboard/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    if (!canAccessCreatorTools(user)) {
      return NextResponse.json(
        { error: "Creator access required." },
        { status: 403 },
      );
    }

    return NextResponse.json({
      data: await getOrCreateScoreboardSettings(user.id),
    });
  } catch (error) {
    console.error("GET /api/scoreboard/settings failed:", error);

    return NextResponse.json(
      { error: "Unable to load scoreboard settings." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    if (!canAccessCreatorTools(user)) {
      return NextResponse.json(
        { error: "Creator access required." },
        { status: 403 },
      );
    }

    const input = updateScoreboardSettingsSchema.parse(
      await request.json(),
    );

    return NextResponse.json({
      data: await updateScoreboardSettings(user.id, input),
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid scoreboard settings.",
          issues: error.issues,
        },
        { status: 400 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "CHALLENGE_NOT_FOUND"
    ) {
      return NextResponse.json(
        { error: "Challenge not found." },
        { status: 400 },
      );
    }

    console.error("PUT /api/scoreboard/settings failed:", error);

    return NextResponse.json(
      { error: "Unable to update scoreboard settings." },
      { status: 500 },
    );
  }
}
