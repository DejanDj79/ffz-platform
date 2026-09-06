export function safeInternalReturnPath(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\")) {
    return null;
  }

  try {
    const base = new URL("https://ffz.local");
    const parsed = new URL(trimmed, base);
    if (parsed.origin !== base.origin) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export function safeFeatureName(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.slice(0, 80);
}
