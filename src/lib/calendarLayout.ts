import type { TimeBlock } from "../types";
import { blockEndMinutesExclusive, blockStartMinutes, sortBlocks, blocksOverlap } from "./scheduleBlocks";

export type DayBlockLayout = {
  topPct: number;
  heightPct: number;
  leftPct: number;
  widthPct: number;
};

function overlapComponents(blocks: TimeBlock[]): TimeBlock[][] {
  const n = blocks.length;
  const adj: boolean[][] = Array.from({ length: n }, () => Array(n).fill(false));
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      if (blocksOverlap(blocks[i], blocks[j])) {
        adj[i][j] = adj[j][i] = true;
      }
    }
  }
  const seen = new Array(n).fill(false);
  const out: TimeBlock[][] = [];
  for (let i = 0; i < n; i += 1) {
    if (seen[i]) continue;
    const stack = [i];
    seen[i] = true;
    const comp: TimeBlock[] = [];
    while (stack.length) {
      const u = stack.pop()!;
      comp.push(blocks[u]);
      for (let v = 0; v < n; v += 1) {
        if (!seen[v] && adj[u][v]) {
          seen[v] = true;
          stack.push(v);
        }
      }
    }
    out.push(comp);
  }
  return out;
}

/** Greedy interval coloring: column index and total columns in this overlap component. */
function columnLayoutForGroup(group: TimeBlock[]): Map<string, { col: number; nCols: number }> {
  const sorted = sortBlocks(group);
  const colEndAt: number[] = [];
  const colById = new Map<string, number>();

  for (const b of sorted) {
    const s = blockStartMinutes(b);
    const e = blockEndMinutesExclusive(b);
    let c = 0;
    for (; c < colEndAt.length; c += 1) {
      if (colEndAt[c] <= s) {
        colEndAt[c] = e;
        colById.set(b.id, c);
        break;
      }
    }
    if (!colById.has(b.id)) {
      colEndAt.push(e);
      colById.set(b.id, colEndAt.length - 1);
    }
  }

  const nCols = Math.max(1, colEndAt.length);
  const map = new Map<string, { col: number; nCols: number }>();
  for (const b of group) {
    map.set(b.id, { col: colById.get(b.id) ?? 0, nCols });
  }
  return map;
}

const VIEW_START_MIN = 0;
const VIEW_END_MIN = 24 * 60;

/**
 * Top/height by time-of-day; left/width so overlapping blocks sit side-by-side (Google Calendar style).
 */
export function layoutDayBlocks(blocks: TimeBlock[]): Map<string, DayBlockLayout> {
  const result = new Map<string, DayBlockLayout>();
  if (blocks.length === 0) return result;

  const groups = overlapComponents(blocks);
  const viewLen = VIEW_END_MIN - VIEW_START_MIN;

  for (const group of groups) {
    const colMap = columnLayoutForGroup(group);
    for (const b of group) {
      const s = blockStartMinutes(b);
      const e = blockEndMinutesExclusive(b);
      const clipS = Math.max(s, VIEW_START_MIN);
      const clipE = Math.min(e, VIEW_END_MIN);
      if (clipE <= clipS) continue;
      const topPct = ((clipS - VIEW_START_MIN) / viewLen) * 100;
      const heightPct = ((clipE - clipS) / viewLen) * 100;
      const { col, nCols } = colMap.get(b.id) ?? { col: 0, nCols: 1 };
      const widthPct = 100 / nCols;
      const leftPct = (col * 100) / nCols;
      result.set(b.id, {
        topPct,
        heightPct: Math.max(heightPct, (3 / viewLen) * 100),
        leftPct,
        widthPct,
      });
    }
  }

  return result;
}
