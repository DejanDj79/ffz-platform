import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { rotateScoreboardKey } from "@/lib/scoreboard/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    return NextResponse.json({
      data: await rotateScoreboardKey(user.id),
    });
  } catch (error) {
    console.error("POST /api/scoreboard/rotate-key failed:", error);

    return NextResponse.json(
      { error: "Unable to regenerate overlay link." },
      { status: 500 },
    );
  }
}
