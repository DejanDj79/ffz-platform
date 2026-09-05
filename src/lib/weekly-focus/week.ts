export function localDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function weeklyFocusWeekStartKey(anchor: Date) {
  const start = new Date(anchor);
  start.setHours(12, 0, 0, 0);
  const mondayOffset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - mondayOffset);
  return localDateKey(start);
}

export function shiftWeekStartKey(weekStart: string, weeks: number) {
  const [year, month, day] = weekStart.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  date.setDate(date.getDate() + weeks * 7);
  return localDateKey(date);
}
