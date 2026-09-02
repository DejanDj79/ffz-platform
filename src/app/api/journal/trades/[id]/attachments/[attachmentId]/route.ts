import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getTrade } from "@/lib/journal/repository";
import { deleteTradeAttachment } from "@/lib/journal/attachments-repository";
import { deleteStoredImage } from "@/lib/storage/image-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
    attachmentId: string;
  }>;
};

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

    const { id, attachmentId } =
      await context.params;

    const trade = await getTrade(user.id, id);

    if (!trade) {
      return NextResponse.json(
        { error: "Trade not found." },
        { status: 404 },
      );
    }

    const deleted = await deleteTradeAttachment(
      user.id,
      id,
      attachmentId,
    );

    if (!deleted) {
      return NextResponse.json(
        { error: "Screenshot not found." },
        { status: 404 },
      );
    }

    await deleteStoredImage(deleted.storageKey);

    return NextResponse.json({
      ok: true,
      id: deleted.id,
    });
  } catch (error) {
    console.error(
      "DELETE /api/journal/trades/[id]/attachments/[attachmentId] failed:",
      error,
    );

    return NextResponse.json(
      { error: "Unable to delete screenshot." },
      { status: 500 },
    );
  }
}
