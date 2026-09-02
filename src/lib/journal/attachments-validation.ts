export const MAX_ATTACHMENTS_PER_TRADE = 10;
export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
export const MAX_UPLOAD_BATCH_BYTES = 40 * 1024 * 1024;

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedImageMimeType =
  (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

export function extensionForMime(
  mimeType: AllowedImageMimeType,
) {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
  }
}

export function isAllowedImageMimeType(
  value: string,
): value is AllowedImageMimeType {
  return ALLOWED_IMAGE_MIME_TYPES.includes(
    value as AllowedImageMimeType,
  );
}

export function validateImageBuffer(
  bytes: Uint8Array,
  mimeType: string,
) {
  if (!isAllowedImageMimeType(mimeType)) {
    throw new Error("UNSUPPORTED_IMAGE_TYPE");
  }

  if (bytes.byteLength === 0) {
    throw new Error("EMPTY_IMAGE");
  }

  if (bytes.byteLength > MAX_ATTACHMENT_BYTES) {
    throw new Error("IMAGE_TOO_LARGE");
  }

  if (mimeType === "image/jpeg") {
    const valid =
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff;

    if (!valid) throw new Error("INVALID_IMAGE_CONTENT");
  }

  if (mimeType === "image/png") {
    const signature = [
      0x89, 0x50, 0x4e, 0x47,
      0x0d, 0x0a, 0x1a, 0x0a,
    ];

    const valid =
      bytes.length >= signature.length &&
      signature.every(
        (value, index) => bytes[index] === value,
      );

    if (!valid) throw new Error("INVALID_IMAGE_CONTENT");
  }

  if (mimeType === "image/webp") {
    const ascii = (start: number, value: string) =>
      value.split("").every(
        (char, index) =>
          bytes[start + index] === char.charCodeAt(0),
      );

    const valid =
      bytes.length >= 12 &&
      ascii(0, "RIFF") &&
      ascii(8, "WEBP");

    if (!valid) throw new Error("INVALID_IMAGE_CONTENT");
  }

  return mimeType;
}

export function safeOriginalFilename(name: string) {
  const cleaned = name
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/]/g, "_")
    .trim();

  return (cleaned || "screenshot").slice(0, 255);
}
