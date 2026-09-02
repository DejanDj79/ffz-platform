import { describe, expect, it } from "vitest";
import {
  safeOriginalFilename,
  validateImageBuffer,
} from "@/lib/journal/attachments-validation";

describe("Journal screenshot validation", () => {
  it("accepts a PNG signature", () => {
    const bytes = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47,
      0x0d, 0x0a, 0x1a, 0x0a,
      0x00,
    ]);

    expect(
      validateImageBuffer(bytes, "image/png"),
    ).toBe("image/png");
  });

  it("accepts a JPEG signature", () => {
    const bytes = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0,
    ]);

    expect(
      validateImageBuffer(bytes, "image/jpeg"),
    ).toBe("image/jpeg");
  });

  it("accepts a WEBP signature", () => {
    const bytes = new TextEncoder().encode(
      "RIFF0000WEBP",
    );

    expect(
      validateImageBuffer(bytes, "image/webp"),
    ).toBe("image/webp");
  });

  it("rejects a spoofed image mime type", () => {
    expect(() =>
      validateImageBuffer(
        new TextEncoder().encode("not-an-image"),
        "image/png",
      ),
    ).toThrow("INVALID_IMAGE_CONTENT");
  });

  it("sanitizes the original filename", () => {
    expect(
      safeOriginalFilename("../chart\\entry.png"),
    ).toBe(".._chart_entry.png");
  });
});
