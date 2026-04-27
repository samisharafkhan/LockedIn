import type { ActivityId, TimeBlock } from "../types";
import { inferActivityFromSummary } from "./icalendar";

const CAL = "https://www.googleapis.com/calendar/v3";

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

/** Google expects local wall time + IANA time zone (no `Z` offset in dateTime). */
function localDateTimeNoZ(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:00`;
}

function blockToRangeOnDay(dayKey: string, b: TimeBlock): { start: Date; end: Date } | null {
  const [y, m, d0] = dayKey.split("-").map(Number);
  const start = new Date(y, m - 1, d0, b.startHour, b.startMinute, 0, 0);
  let end: Date;
  if (b.endHour === 24 && b.endMinute === 0) {
    end = new Date(y, m - 1, d0 + 1, 0, 0, 0, 0);
  } else {
    end = new Date(y, m - 1, d0, b.endHour, b.endMinute, 0, 0);
  }
  if (end.getTime() <= start.getTime()) return null;
  return { start, end };
}

export function getUserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export async function insertTodayBlocksInGoogleCalendar(
  accessToken: string,
  params: {
    dayKey: string;
    blocks: TimeBlock[];
    timeZone: string;
    summaryForBlock: (id: ActivityId) => string;
    description?: string;
  },
): Promise<{ created: number }> {
  const description = params.description ?? "Created by LockedIn";
  const tz = params.timeZone;
  let created = 0;
  for (const b of params.blocks) {
    const range = blockToRangeOnDay(params.dayKey, b);
    if (!range) continue;
    const body = {
      summary: params.summaryForBlock(b.activityId),
      description,
      start: { dateTime: localDateTimeNoZ(range.start), timeZone: tz },
      end: { dateTime: localDateTimeNoZ(range.end), timeZone: tz },
    };
    const res = await fetch(`${CAL}/calendars/primary/events?sendUpdates=none`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text();
      const err = new Error(`calendar_insert_${res.status}`) as Error & { status?: number; body?: string };
      err.status = res.status;
      err.body = errText;
      throw err;
    }
    created += 1;
  }
  return { created };
}

type GEvent = {
  status?: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

function dayKeyOfLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * List timed events in the user’s primary calendar overlapping `dayKey` (local),
 * and map them into LockedIn blocks. All-day events are skipped.
 */
export async function listTodayEventsForImport(
  accessToken: string,
  params: { dayKey: string; timeZone: string },
): Promise<Omit<TimeBlock, "id">[]> {
  const [y, m, d0] = params.dayKey.split("-").map(Number);
  const start = new Date(y, m - 1, d0, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d0, 23, 59, 59, 999);
  const u = new URL(`${CAL}/calendars/primary/events`);
  u.searchParams.set("timeMin", start.toISOString());
  u.searchParams.set("timeMax", end.toISOString());
  u.searchParams.set("singleEvents", "true");
  u.searchParams.set("orderBy", "startTime");
  u.searchParams.set("timeZone", params.timeZone);
  u.searchParams.set("maxResults", "250");

  const res = await fetch(u.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    const err = new Error(`calendar_list_${res.status}`) as Error & { status?: number; body?: string };
    err.status = res.status;
    err.body = await res.text();
    throw err;
  }
  const data = (await res.json()) as { items?: GEvent[] };
  const items = data.items ?? [];
  const out: Omit<TimeBlock, "id">[] = [];
  for (const ev of items) {
    if (ev.status === "cancelled") continue;
    if (!ev.start?.dateTime || !ev.end?.dateTime) continue;
    const s = new Date(ev.start.dateTime);
    const e = new Date(ev.end.dateTime);
    if (dayKeyOfLocal(s) !== params.dayKey) continue;
    if (e.getTime() <= s.getTime()) continue;
    const activityId = inferActivityFromSummary((ev.summary ?? "work").trim() || "work");
    const sY = s.getFullYear();
    const sM = s.getMonth();
    const sD = s.getDate();
    const startMin = s.getHours() * 60 + s.getMinutes();
    const sDay0 = new Date(sY, sM, sD);
    const eDay0 = new Date(e.getFullYear(), e.getMonth(), e.getDate());
    const dayDiff = Math.round((eDay0.getTime() - sDay0.getTime()) / 864e5);
    let endHour: number;
    let endMinute: number;
    if (dayDiff === 0) {
      endHour = e.getHours();
      endMinute = e.getMinutes();
    } else if (dayDiff === 1 && e.getHours() === 0 && e.getMinutes() === 0) {
      endHour = 24;
      endMinute = 0;
    } else {
      endHour = 23;
      endMinute = 59;
    }
    const endInMin = endHour === 24 && endMinute === 0 ? 24 * 60 : endHour * 60 + endMinute;
    if (startMin >= endInMin) continue;
    out.push({
      startHour: s.getHours(),
      startMinute: s.getMinutes(),
      endHour,
      endMinute,
      activityId,
    });
  }
  out.sort((a, b) => a.startHour * 60 + a.startMinute - (b.startHour * 60 + b.startMinute));
  return out;
}
