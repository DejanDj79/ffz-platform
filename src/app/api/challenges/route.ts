import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import {
  createChallenge,
  listChallenges,
} from "@/lib/challenges/repository";
import { createChallengeSchema } from "@/lib/challenges/validation";

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

    const data = await listChallenges(user.id);
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
