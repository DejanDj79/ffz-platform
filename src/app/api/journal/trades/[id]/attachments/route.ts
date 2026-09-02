import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getTrade } from "@/lib/journal/repository";
import {
  countTradeAttachments,
  createTradeAttachment,
  listTradeAttachments,
  nextTradeAttachmentSortOrder,
} from "@/lib/journal/attachments-repository";
import {
  isAllowedImageMimeType,
  MAX_ATTACHMENTS_PER_TRADE,
  MAX_UPLOAD_BATCH_BYTES,
  safeOriginalFilename,
  validateImageBuffer,
} from "@/lib/journal/attachments-validation";
import {
  createTradeImageStorageKey,
  deleteStoredImage,
  writeStoredImage,
} from "@/lib/storage/image-storage";

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
    const trade = await getTrade(user.id, id);

    if (!trade) {
      return NextResponse.json(
        { error: "Trade not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      data: await listTradeAttachments(user.id, id),
    });
  } catch (error) {
    console.error(
      "GET /api/journal/trades/[id]/attachments failed:",
      error,
    );

    return NextResponse.json(
      { error: "Unable to load screenshots." },
      { status: 500 },
    );
  }
}

export async function POST(
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
    const trade = await getTrade(user.id, id);

    if (!trade) {
      return NextResponse.json(
        { error: "Trade not found." },
        { status: 404 },
      );
    }

    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((item): item is File => item instanceof File);

    if (files.length === 0) {
      return NextResponse.json(
        { error: "Choose at least one screenshot." },
        { status: 400 },
      );
    }

    const currentCount = await countTradeAttachments(
      user.id,
      id,
    );

    if (
      currentCount + files.length >
      MAX_ATTACHMENTS_PER_TRADE
    ) {
      return NextResponse.json(
        {
          error: `A trade can have up to ${MAX_ATTACHMENTS_PER_TRADE} screenshots.`,
        },
        { status: 400 },
      );
    }

    const prepared: Array<{
      file: File;
      bytes: Uint8Array;
      mimeType: "image/jpeg" | "image/png" | "image/webp";
    }> = [];

    let batchBytes = 0;

    for (const file of files) {
      if (!isAllowedImageMimeType(file.type)) {
        return NextResponse.json(
          {
            error:
              "Only JPG, PNG and WEBP screenshots are supported.",
          },
          { status: 400 },
        );
      }

      const bytes = new Uint8Array(
        await file.arrayBuffer(),
      );

      validateImageBuffer(bytes, file.type);
      batchBytes += bytes.byteLength;

      if (batchBytes > MAX_UPLOAD_BATCH_BYTES) {
        return NextResponse.json(
          {
            error:
              "The selected screenshot batch is too large. Upload fewer images at once.",
          },
          { status: 400 },
        );
      }

      prepared.push({
        file,
        bytes,
        mimeType: file.type,
      });
    }

    let sortOrder = await nextTradeAttachmentSortOrder(
      user.id,
      id,
    );

    const created = [];

    for (const item of prepared) {
      const storageKey = createTradeImageStorageKey(
        user.id,
        id,
        item.mimeType,
      );

      await writeStoredImage(
        storageKey,
        item.bytes,
      );

      try {
        const attachment = await createTradeAttachment(
          user.id,
          id,
          {
            storageKey,
            originalFilename: safeOriginalFilename(
              item.file.name,
            ),
            mimeType: item.mimeType,
            fileSizeBytes: item.bytes.byteLength,
            sortOrder,
          },
        );

        created.push(attachment);
        sortOrder += 1;
      } catch (error) {
        await deleteStoredImage(storageKey);
        throw error;
      }
    }

    return NextResponse.json(
      { data: created },
      { status: 201 },
    );
  } catch (error) {
    const known: Record<string, string> = {
      UNSUPPORTED_IMAGE_TYPE:
        "Only JPG, PNG and WEBP screenshots are supported.",
      EMPTY_IMAGE: "One of the screenshots is empty.",
      IMAGE_TOO_LARGE:
        "Each screenshot must be 8 MB or smaller.",
      INVALID_IMAGE_CONTENT:
        "One of the selected files is not a valid image.",
    };

    if (error instanceof Error && known[error.message]) {
      return NextResponse.json(
        { error: known[error.message] },
        { status: 400 },
      );
    }

    console.error(
      "POST /api/journal/trades/[id]/attachments failed:",
      error,
    );

    return NextResponse.json(
      { error: "Unable to upload screenshots." },
      { status: 500 },
    );
  }
}
