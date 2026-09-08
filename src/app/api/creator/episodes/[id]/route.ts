import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { canAccessCreatorTools } from "@/lib/auth/roles";
import { updateCreatorEpisode } from "@/lib/creator/episodes-repository";
import { creatorEpisodeUpdateSchema } from "@/lib/creator/episodes-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (!canAccessCreatorTools(user)) {
      return NextResponse.json({ error: "Creator access required." }, { status: 403 });
    }

    const { id } = await context.params;
    const input = creatorEpisodeUpdateSchema.parse(await request.json());
    const data = await updateCreatorEpisode(user.id, id, input);

    if (!data) {
      return NextResponse.json({ error: "Episode not found." }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid episode update.", issues: error.issues },
        { status: 400 },
      );
    }

    console.error("PATCH /api/creator/episodes/[id] failed:", error);
    return NextResponse.json({ error: "Unable to update episode." }, { status: 500 });
  }
}
