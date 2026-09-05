import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { getWeeklyFocus, saveWeeklyFocus } from "@/lib/weekly-focus/repository";
import { weeklyFocusSaveSchema, weeklyFocusWeekStartSchema } from "@/lib/weekly-focus/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const weekStart = weeklyFocusWeekStartSchema.parse(
      new URL(request.url).searchParams.get("weekStart"),
    );

    return NextResponse.json({
      data: await getWeeklyFocus(user.id, weekStart),
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid weekly focus weekStart.", issues: error.issues },
        { status: 400 },
      );
    }

    console.error("GET /api/weekly-focus failed:", error);
    return NextResponse.json({ error: "Unable to load weekly focus." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const input = weeklyFocusSaveSchema.parse(await request.json());
    return NextResponse.json({ data: await saveWeeklyFocus(user.id, input) });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid weekly focus.", issues: error.issues },
        { status: 400 },
      );
    }

    console.error("PUT /api/weekly-focus failed:", error);
    return NextResponse.json({ error: "Unable to save weekly focus." }, { status: 500 });
  }
}
