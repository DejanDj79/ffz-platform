import { constants } from "node:fs";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  extensionForMime,
  type AllowedImageMimeType,
} from "@/lib/journal/attachments-validation";

export function imageUploadRoot() {
  return path.resolve(
    /* turbopackIgnore: true */
    process.env.FFZ_UPLOAD_DIR ??
      path.join(process.cwd(), "data", "uploads"),
  );
}

function resolveStorageKey(storageKey: string) {
  const root = imageUploadRoot();
  const fullPath = path.resolve(
    /* turbopackIgnore: true */
    root,
    storageKey,
  );

  if (
    fullPath !== root &&
    !fullPath.startsWith(`${root}${path.sep}`)
  ) {
    throw new Error("INVALID_STORAGE_KEY");
  }

  return fullPath;
}

export function createTradeImageStorageKey(
  userId: string,
  tradeId: string,
  mimeType: AllowedImageMimeType,
) {
  return path.posix.join(
    userId,
    tradeId,
    `${randomUUID()}.${extensionForMime(mimeType)}`,
  );
}

export async function writeStoredImage(
  storageKey: string,
  bytes: Uint8Array,
) {
  const fullPath = resolveStorageKey(storageKey);

  await mkdir(path.dirname(fullPath), {
    recursive: true,
  });

  await writeFile(
    /* turbopackIgnore: true */
    fullPath,
    bytes,
  );
}

export async function readStoredImage(
  storageKey: string,
) {
  return readFile(
    /* turbopackIgnore: true */
    resolveStorageKey(storageKey),
  );
}

export async function deleteStoredImage(
  storageKey: string,
) {
  try {
    await rm(
      /* turbopackIgnore: true */
      resolveStorageKey(storageKey),
      {
        force: true,
      },
    );
  } catch (error) {
    console.error(
      `Unable to delete stored Journal image ${storageKey}:`,
      error,
    );
  }
}


export async function ensureImageStorageReady() {
  const root = imageUploadRoot();

  await mkdir(root, {
    recursive: true,
  });

  await access(
    /* turbopackIgnore: true */
    root,
    constants.R_OK | constants.W_OK,
  );

  return root;
}
