export function dollarsToCents(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error("Money value must be a finite number.");
  }

  return Math.round(value * 100);
}

export function centsToDollars(value: number | null | undefined): number | null {
  if (value == null) return null;
  return value / 100;
}
