import type { ActivityId, TimeBlock } from "../types";

export function minutesSinceMidnight(d: Date) {
  return d.getHours() * 60 + d.getMinutes();
}

export function blockContainsMinute(block: TimeBlock, minute: number) {
  const start = block.startHour * 60 + block.startMinute;
  const end = block.endHour * 60 + block.endMinute;
  if (end <= start) return minute >= start || minute < end;
  return minute >= start && minute < end;
}

export function activityAtMinute(blocks: TimeBlock[], minute: number): ActivityId | null {
  const hit = blocks.find((b) => blockContainsMinute(b, minute));
  return hit?.activityId ?? null;
}

export function formatHm(h: number, m: number) {
  const ap = h >= 12 ? "pm" : "am";
  const h12 = ((h + 11) % 12) + 1;
  const mm = m.toString().padStart(2, "0");
  return `${h12}:${mm}${ap}`;
}
