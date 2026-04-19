import type { ActivityId, TimeBlock } from "../types";
import { blockEndMinutesExclusive, blockStartMinutes } from "./scheduleBlocks";
import { lastNDayKeys } from "./dates";

export function blockDurationHours(b: TimeBlock) {
  const m = (blockEndMinutesExclusive(b) - blockStartMinutes(b)) / 60;
  return Math.max(0, m);
}

export function hoursByActivityForDay(blocks: TimeBlock[] | undefined) {
  const map = new Map<ActivityId, number>();
  if (!blocks) return map;
  for (const b of blocks) {
    const h = blockDurationHours(b);
    map.set(b.activityId, (map.get(b.activityId) ?? 0) + h);
  }
  return map;
}

export function hoursByActivityLastNDays(
  byDay: Record<string, TimeBlock[]>,
  n: number,
  end = new Date(),
) {
  const totals = new Map<ActivityId, number>();
  const keys = lastNDayKeys(n, end);
  for (const day of keys) {
    const dayMap = hoursByActivityForDay(byDay[day]);
    for (const [id, h] of dayMap) {
      totals.set(id, (totals.get(id) ?? 0) + h);
    }
  }
  return totals;
}

/** Hours for one activity on a specific ISO day. */
export function hoursForActivityOnDay(
  byDay: Record<string, TimeBlock[]>,
  dayKey: string,
  activityId: ActivityId,
) {
  const blocks = byDay[dayKey];
  if (!blocks) return 0;
  return blocks
    .filter((b) => b.activityId === activityId)
    .reduce((s, b) => s + blockDurationHours(b), 0);
}
