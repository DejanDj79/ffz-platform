import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getTrade } from "@/lib/journal/repository";
import { getTradeAttachment } from "@/lib/journal/attachments-repository";
import { readStoredImage } from "@/lib/storage/image-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
    attachmentId: string;
  }>;
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

    const { id, attachmentId } =
      await context.params;

    const trade = await getTrade(user.id, id);

    if (!trade) {
      return NextResponse.json(
        { error: "Trade not found." },
        { status: 404 },
      );
    }

    const attachment = await getTradeAttachment(
      user.id,
      id,
      attachmentId,
    );

    if (!attachment) {
      return NextResponse.json(
        { error: "Screenshot not found." },
        { status: 404 },
      );
    }

    const bytes = await readStoredImage(
      attachment.storageKey,
    );

    return new Response(
      new Uint8Array(bytes),
      {
        status: 200,
        headers: {
          "Content-Type": attachment.mimeType,
          "Content-Length": String(bytes.byteLength),
          "Cache-Control": "private, max-age=3600",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch (error) {
    console.error(
      "GET /api/journal/trades/[id]/attachments/[attachmentId]/file failed:",
      error,
    );

    return NextResponse.json(
      { error: "Unable to load screenshot." },
      { status: 500 },
    );
  }
}
