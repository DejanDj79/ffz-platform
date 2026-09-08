import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { canAccessCreatorTools } from "@/lib/auth/roles";
import {
  createCreatorEpisode,
  listCreatorEpisodes,
} from "@/lib/creator/episodes-repository";
import { creatorEpisodeCreateSchema } from "@/lib/creator/episodes-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function creatorAccessResponse(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!canAccessCreatorTools(user)) {
    return NextResponse.json({ error: "Creator access required." }, { status: 403 });
  }
  return null;
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    const denied = creatorAccessResponse(user);
    if (denied) return denied;

    return NextResponse.json({ data: await listCreatorEpisodes(user!.id) });
  } catch (error) {
    console.error("GET /api/creator/episodes failed:", error);
    return NextResponse.json({ error: "Unable to load Creator episodes." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    const denied = creatorAccessResponse(user);
    if (denied) return denied;

    const input = creatorEpisodeCreateSchema.parse(await request.json());
    const data = await createCreatorEpisode(user!.id, input);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid episode draft.", issues: error.issues },
        { status: 400 },
      );
    }

    if (error instanceof Error && error.message === "CHALLENGE_NOT_FOUND") {
      return NextResponse.json({ error: "Challenge not found." }, { status: 404 });
    }

    console.error("POST /api/creator/episodes failed:", error);
    return NextResponse.json({ error: "Unable to save episode draft." }, { status: 500 });
  }
}
