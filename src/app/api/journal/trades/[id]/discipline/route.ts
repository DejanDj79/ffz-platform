import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { updateClosedTradeDisciplineTags } from "@/lib/journal/discipline-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const disciplineTagsSchema = z.object({
  tags: z
    .array(z.string().trim().min(1).max(40))
    .max(20)
    .transform((items) => [...new Set(items)]),
});

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    const { id } = await context.params;
    const { tags } = disciplineTagsSchema.parse(await request.json());
    const trade = await updateClosedTradeDisciplineTags(user.id, id, tags);

    if (!trade) {
      return NextResponse.json({ error: "Trade not found." }, { status: 404 });
    }

    return NextResponse.json({ data: trade });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid discipline review data.", issues: error.issues },
        { status: 400 },
      );
    }

    if (error instanceof Error && error.message === "TRADE_NOT_CLOSED") {
      return NextResponse.json(
        { error: "Only closed trades can receive a post-trade discipline review." },
        { status: 409 },
      );
    }

    console.error("PATCH /api/journal/trades/[id]/discipline failed:", error);
    return NextResponse.json(
      { error: "Unable to save discipline review." },
      { status: 500 },
    );
  }
}
