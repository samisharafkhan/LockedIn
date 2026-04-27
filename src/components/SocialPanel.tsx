import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useSchedule } from "../context/ScheduleContext";
import { getFirestoreDb } from "../lib/firebaseApp";
import { subscribeRecentSchedulePosts, type SchedulePostDoc } from "../lib/schedulePosts";
import { fetchDirectoryUser, type DirectoryUser } from "../lib/userDirectory";
import { storedToTimeBlock } from "./ProfilePostUtils";
import { blockEndMinutesExclusive, blockStartMinutes } from "../lib/scheduleBlocks";
import { formatHm } from "../lib/time";
import { activityById } from "../data/activities";
import { PageIntro } from "./PageIntro";
import { SoftCard } from "./SoftCard";
import { EmptyState } from "./EmptyState";
import type { TimeBlock } from "../types";

type Row = { id: string; data: SchedulePostDoc };
type FriendDayPost = {
  ownerUid: string;
  displayName: string;
  handle: string;
  avatarEmoji: string;
  avatarImageDataUrl?: string | null;
  blocks: TimeBlock[];
};

const HOUR_START = 8;
const HOUR_END = 22;
const HOURS = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);
const DAY_MS = 24 * 60 * 60 * 1000;

function isoKeyLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function moveDay(dayKey: string, delta: number): string {
  const d = new Date(`${dayKey}T12:00:00`);
  d.setTime(d.getTime() + delta * DAY_MS);
  return isoKeyLocal(d);
}

function prettyDay(dayKey: string): string {
  const d = new Date(`${dayKey}T12:00:00`);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(d);
}

function blockColor(activityId: TimeBlock["activityId"]): string {
  if (activityId === "work" || activityId === "focus" || activityId === "class") return "var(--sage)";
  if (activityId === "social" || activityId === "chill") return "var(--lavender)";
  if (activityId === "gym" || activityId === "commute") return "var(--powder-blue)";
  if (activityId === "travel") return "var(--butter)";
  return "var(--beige)";
}

export function SocialPanel() {
  const { firebaseUser, followingIds, todayKey } = useSchedule();
  const [pickedDay, setPickedDay] = useState(todayKey);
  const [rawPosts, setRawPosts] = useState<Row[]>([]);
  const [profilesByUid, setProfilesByUid] = useState<Record<string, DirectoryUser | null>>({});
  const [selectedOwnerIds, setSelectedOwnerIds] = useState<string[]>([]);
  const dateInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setPickedDay(todayKey);
  }, [todayKey]);

  useEffect(() => {
    if (!firebaseUser) {
      setRawPosts([]);
      return;
    }
    return subscribeRecentSchedulePosts(280, setRawPosts);
  }, [firebaseUser]);

  const dayPosts = useMemo(() => {
    if (!firebaseUser) return [] as Row[];
    const allowed = new Set<string>(followingIds);
    allowed.add(firebaseUser.uid);
    const byOwner = new Map<string, Row>();
    for (const row of rawPosts) {
      if (row.data.dayKey !== pickedDay) continue;
      if (!allowed.has(row.data.ownerUid)) continue;
      if (!byOwner.has(row.data.ownerUid)) byOwner.set(row.data.ownerUid, row);
    }
    return [...byOwner.values()];
  }, [rawPosts, pickedDay, followingIds, firebaseUser]);

  useEffect(() => {
    const db = getFirestoreDb();
    if (!db || dayPosts.length === 0) return;
    const need = dayPosts
      .map((r) => r.data.ownerUid)
      .filter((uid) => profilesByUid[uid] === undefined);
    if (need.length === 0) return;
    let cancelled = false;
    void (async () => {
      const next: Record<string, DirectoryUser | null> = {};
      for (const uid of need) {
        next[uid] = await fetchDirectoryUser(db, uid);
      }
      if (!cancelled) setProfilesByUid((prev) => ({ ...prev, ...next }));
    })();
    return () => {
      cancelled = true;
    };
  }, [dayPosts, profilesByUid]);

  const friendPosts = useMemo<FriendDayPost[]>(() => {
    return dayPosts.map((row) => {
      const uid = row.data.ownerUid;
      const p = profilesByUid[uid];
      return {
        ownerUid: uid,
        displayName: p?.displayName ?? row.data.displayName,
        handle: p?.handle ?? row.data.handle,
        avatarEmoji: p?.avatarEmoji ?? row.data.avatarEmoji ?? "○",
        avatarImageDataUrl: p?.avatarImageDataUrl ?? row.data.avatarImageDataUrl ?? null,
        blocks: row.data.blocks.map(storedToTimeBlock),
      };
    });
  }, [dayPosts, profilesByUid]);

  useEffect(() => {
    if (friendPosts.length === 0) {
      setSelectedOwnerIds([]);
      return;
    }
    setSelectedOwnerIds((prev) => {
      const validPrev = prev.filter((id) => friendPosts.some((f) => f.ownerUid === id));
      if (validPrev.length > 0) return validPrev;
      return friendPosts.map((f) => f.ownerUid);
    });
  }, [friendPosts]);

  const selectedPosts = useMemo(() => {
    const set = new Set(selectedOwnerIds);
    return friendPosts.filter((p) => set.has(p.ownerUid));
  }, [friendPosts, selectedOwnerIds]);

  const allSelected = friendPosts.length > 0 && selectedOwnerIds.length === friendPosts.length;

  const toggleFriend = (uid: string) => {
    setSelectedOwnerIds((prev) => {
      if (prev.includes(uid)) return prev.filter((x) => x !== uid);
      return [...prev, uid];
    });
  };

  return (
    <section className="social-panel social-compare" aria-labelledby="social-heading">
      <PageIntro
        id="social-heading"
        label="SOCIAL"
        title="Friends schedule"
        subtitle="Pick a day, then compare posted schedules."
      />

      <SoftCard className="social-compare__card">
        <div className="social-compare__date-row">
          <button
            type="button"
            className="icon-btn social-compare__date-icon"
            onClick={() => dateInputRef.current?.showPicker?.()}
            aria-label="Pick date"
          >
            <CalendarDays size={18} />
          </button>
          <button
            type="button"
            className="icon-btn social-compare__date-nav"
            onClick={() => setPickedDay((d) => moveDay(d, -1))}
            aria-label="Previous day"
          >
            <ChevronLeft size={18} />
          </button>
          <p className="social-compare__date-label">{prettyDay(pickedDay)}</p>
          <button
            type="button"
            className="icon-btn social-compare__date-nav"
            onClick={() => setPickedDay((d) => moveDay(d, 1))}
            aria-label="Next day"
          >
            <ChevronRight size={18} />
          </button>
          <button
            type="button"
            className="pill-btn pill-btn--secondary social-compare__today"
            onClick={() => setPickedDay(todayKey)}
          >
            Today
          </button>
          <input
            ref={dateInputRef}
            type="date"
            className="visually-hidden"
            value={pickedDay}
            onChange={(e) => setPickedDay(e.target.value || todayKey)}
          />
        </div>

        {friendPosts.length === 0 ? (
          <EmptyState
            mascot
            title="No posted schedules for this day"
            description="Ask friends to post their day, then compare here."
          />
        ) : (
          <>
            <div className="social-compare__chips-wrap" role="list" aria-label="Posted friends for this day">
              <button
                type="button"
                className={`social-compare__friend-chip social-compare__friend-chip--all${allSelected ? " is-on" : ""}`}
                onClick={() =>
                  setSelectedOwnerIds(allSelected ? [] : friendPosts.map((f) => f.ownerUid))
                }
              >
                <span className="social-compare__friend-dot" aria-hidden>
                  {allSelected ? <Check size={12} /> : null}
                </span>
                <span className="social-compare__friend-name">All</span>
              </button>
              {friendPosts.map((f) => {
                const on = selectedOwnerIds.includes(f.ownerUid);
                return (
                  <button
                    key={f.ownerUid}
                    type="button"
                    className={`social-compare__friend-chip${on ? " is-on" : ""}`}
                    onClick={() => toggleFriend(f.ownerUid)}
                  >
                    <span className="social-compare__friend-avatar" aria-hidden>
                      {f.avatarImageDataUrl ? (
                        <img src={f.avatarImageDataUrl} alt="" className="social-compare__friend-avatar-img" />
                      ) : (
                        f.avatarEmoji
                      )}
                    </span>
                    <span className="social-compare__friend-name">{f.displayName}</span>
                  </button>
                );
              })}
            </div>

            {selectedPosts.length === 0 ? (
              <div className="social-empty-inline">
                <EmptyState
                  title="Select friends to compare"
                  description="Turn on one or more people above."
                />
              </div>
            ) : (
              <div className="social-compare__table-wrap">
                <div className="social-compare__table">
                  <div className="social-compare__time-col" aria-hidden>
                    <div className="social-compare__all-day">all-day</div>
                    {HOURS.map((h) => (
                      <div key={h} className="social-compare__time-row">
                        {formatHm(h, 0).replace(":00", "")}
                      </div>
                    ))}
                  </div>
                  <div className="social-compare__cols">
                    {selectedPosts.map((p) => {
                      const dayRangeMin = (HOUR_END - HOUR_START) * 60;
                      const blocks = p.blocks.filter((b) => {
                        const s = blockStartMinutes(b);
                        const e = blockEndMinutesExclusive(b);
                        return e > HOUR_START * 60 && s < HOUR_END * 60;
                      });
                      return (
                        <div key={p.ownerUid} className="social-compare__col">
                          <div className="social-compare__col-head">
                            <p className="social-compare__col-name">{p.displayName}</p>
                            <p className="social-compare__col-handle">@{p.handle}</p>
                          </div>
                          <div className="social-compare__col-body">
                            {HOURS.map((h) => (
                              <div key={h} className="social-compare__grid-line" />
                            ))}
                            {blocks.map((b) => {
                              const s = Math.max(HOUR_START * 60, blockStartMinutes(b));
                              const e = Math.min(HOUR_END * 60, blockEndMinutesExclusive(b));
                              const top = ((s - HOUR_START * 60) / dayRangeMin) * 100;
                              const height = Math.max(5, ((e - s) / dayRangeMin) * 100);
                              return (
                                <div
                                  key={b.id}
                                  className="social-compare__event"
                                  style={{ top: `${top}%`, height: `${height}%`, background: blockColor(b.activityId) }}
                                >
                                  <p className="social-compare__event-title">{activityById(b.activityId).label}</p>
                                  <p className="social-compare__event-time">
                                    {formatHm(b.startHour, b.startMinute)} - {b.endHour === 24 && b.endMinute === 0 ? "12:00am" : formatHm(b.endHour, b.endMinute)}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </SoftCard>
    </section>
  );
}
