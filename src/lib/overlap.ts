import type { TimeBlock } from "../types";
import { blockEndMinutesExclusive, blockStartMinutes } from "./scheduleBlocks";

export type OverlapSegment = {
  startMin: number;
  endMin: number;
  mine: boolean;
  theirs: boolean;
};

/** Merge two schedules into coarse overlap segments (both, you only, them only). */
export function overlapSegments(a: TimeBlock[], b: TimeBlock[]): OverlapSegment[] {
  const points = new Set<number>();
  const addBlockEnds = (blocks: TimeBlock[]) => {
    for (const x of blocks) {
      points.add(blockStartMinutes(x));
      points.add(blockEndMinutesExclusive(x));
    }
  };
  addBlockEnds(a);
  addBlockEnds(b);
  const sorted = [...points].filter((p) => p >= 0 && p <= 24 * 60).sort((x, y) => x - y);
  const out: OverlapSegment[] = [];
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const s = sorted[i];
    const e = sorted[i + 1];
    if (e <= s) continue;
    const mid = (s + e) / 2;
    const mine = a.some((bl) => blockStartMinutes(bl) <= mid && blockEndMinutesExclusive(bl) > mid);
    const theirs = b.some((bl) => blockStartMinutes(bl) <= mid && blockEndMinutesExclusive(bl) > mid);
    if (mine || theirs) {
      out.push({ startMin: s, endMin: e, mine, theirs });
    }
  }
  return mergeAdjacent(out);
}

function mergeAdjacent(segs: OverlapSegment[]) {
  const merged: OverlapSegment[] = [];
  for (const s of segs) {
    const last = merged[merged.length - 1];
    if (
      last &&
      last.endMin === s.startMin &&
      last.mine === s.mine &&
      last.theirs === s.theirs
    ) {
      last.endMin = s.endMin;
    } else {
      merged.push({ ...s });
    }
  }
  return merged;
}

export function formatMinRange(startMin: number, endMin: number) {
  const fmt = (m: number) => {
    const h = Math.floor(m / 60);
    const mi = m % 60;
    const ap = h >= 12 ? "pm" : "am";
    const h12 = ((h + 11) % 12) + 1;
    const mm = mi.toString().padStart(2, "0");
    return `${h12}:${mm}${ap}`;
  };
  return `${fmt(startMin)}–${fmt(endMin)}`;
}
