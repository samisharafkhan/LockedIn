import type { TimeBlock } from "../types";

export function blockStartMinutes(b: TimeBlock) {
  return b.startHour * 60 + b.startMinute;
}

/** End as exclusive minute-of-day; 24:00 becomes 1440. */
export function blockEndMinutesExclusive(b: TimeBlock) {
  if (b.endHour === 24 && b.endMinute === 0) return 24 * 60;
  return b.endHour * 60 + b.endMinute;
}

export function sortBlocks(blocks: TimeBlock[]) {
  return [...blocks].sort((a, b) => blockStartMinutes(a) - blockStartMinutes(b));
}

export function blocksOverlap(a: TimeBlock, b: TimeBlock) {
  const a0 = blockStartMinutes(a);
  const a1 = blockEndMinutesExclusive(a);
  const b0 = blockStartMinutes(b);
  const b1 = blockEndMinutesExclusive(b);
  return Math.max(a0, b0) < Math.min(a1, b1);
}

export function hasConflict(
  blocks: TimeBlock[],
  candidate: Pick<TimeBlock, "startHour" | "startMinute" | "endHour" | "endMinute"> & { id?: string },
) {
  const tmp: TimeBlock = {
    id: candidate.id ?? "__candidate__",
    startHour: candidate.startHour,
    startMinute: candidate.startMinute,
    endHour: candidate.endHour,
    endMinute: candidate.endMinute,
    activityId: "focus",
  };
  return blocks.some((b) => b.id !== candidate.id && blocksOverlap(tmp, b));
}

export function isValidRange(
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number,
) {
  const s = startHour * 60 + startMinute;
  const e = endHour === 24 && endMinute === 0 ? 24 * 60 : endHour * 60 + endMinute;
  return e > s && s >= 0 && e <= 24 * 60;
}

export function parseTimeValue(value: string) {
  const raw = value.trim();
  if (raw === "24:00") return { hour: 24, minute: 0 };
  const parts = raw.split(":");
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 24 || m < 0 || m > 59) return null;
  if (h === 24 && m !== 0) return null;
  return { hour: h, minute: m };
}

export function formatTimeValue(hour: number, minute: number) {
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

function rangeFromStartMinute(m: number): {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
} {
  if (m >= 24 * 60) m = 23 * 60 + 30;
  const startH = Math.floor(m / 60);
  const startM = m % 60;
  let endTotal = m + 60;
  if (endTotal > 24 * 60) endTotal = 24 * 60;
  const endH = Math.floor(endTotal / 60);
  const endMi = endTotal % 60;
  if (endTotal === 24 * 60) {
    return { startHour: startH, startMinute: startM, endHour: 24, endMinute: 0 };
  }
  return { startHour: startH, startMinute: startM, endHour: endH, endMinute: endMi };
}

/** Next 30-minute boundary from now, for quick-add defaults (first non-overlapping slot). */
export function defaultNewBlockRange(existingBlocks: TimeBlock[] = []) {
  const d = new Date();
  let m = d.getHours() * 60 + d.getMinutes();
  m = Math.ceil(m / 30) * 30;
  const fromNow = rangeFromStartMinute(m);
  const tryConflict = (r: {
    startHour: number;
    startMinute: number;
    endHour: number;
    endMinute: number;
  }) => hasConflict(existingBlocks, { id: "__draft__", ...r });

  if (!tryConflict(fromNow)) return fromNow;

  for (let start = 0; start < 24 * 60; start += 30) {
    const r = rangeFromStartMinute(start);
    if (!isValidRange(r.startHour, r.startMinute, r.endHour, r.endMinute)) continue;
    if (!tryConflict(r)) return r;
  }

  return { startHour: 9, startMinute: 0, endHour: 10, endMinute: 0 };
}
