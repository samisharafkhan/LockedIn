import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useSchedule } from "../context/ScheduleContext";
import { getFirestoreDb } from "../lib/firebaseApp";
import { subscribeRecentSchedulePosts, type SchedulePostDoc } from "../lib/schedulePosts";
import { fetchDirectoryUser, type DirectoryUser } from "../lib/userDirectory";
import { storedToTimeBlock } from "./ProfilePostUtils";
import { blockEndMinutesExclusive, blockStartMinutes } from "../lib/scheduleBlocks";
import { formatHm } from "../lib/time";
import { activityById } from "../data/activities";
import { ActivityIcon } from "./ActivityIcon";
import { AvatarDisplay } from "./AvatarDisplay";
import { activityBlockChrome } from "../lib/activityBlockColors";
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
  avatarAnimalId?: string | null;
  blocks: TimeBlock[];
};

const HOUR_START = 8;
const HOUR_END = 22;
const HOURS = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);
const DAY_RANGE_MIN = (HOUR_END - HOUR_START) * 60;
/** Taller "zoom" so one viewport shows a few hours; user scrolls for the full day. */
const PX_PER_HOUR = 72;
const SCHEDULE_TRACK_PX = (HOUR_END - HOUR_START) * PX_PER_HOUR;
const MIN_EVENT_PX = 40;
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

export function SocialPanel() {
  const { firebaseUser, followingIds, todayKey } = useSchedule();
  const [pickedDay, setPickedDay] = useState(todayKey);
  const [rawPosts, setRawPosts] = useState<Row[]>([]);
  const [profilesByUid, setProfilesByUid] = useState<Record<string, DirectoryUser | null>>({});
  const [selectedOwnerIds, setSelectedOwnerIds] = useState<string[]>([]);
  const [openEvent, setOpenEvent] = useState<{
    block: TimeBlock;
    displayName: string;
    handle: string;
  } | null>(null);
  const dateInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!openEvent) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenEvent(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openEvent]);

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
        avatarAnimalId: p?.avatarAnimalId ?? null,
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
                <span
                  className="social-compare__friend-avatar social-compare__friend-avatar--all-pick"
                  aria-hidden
                >
                  {allSelected ? <Check size={20} strokeWidth={2.5} /> : null}
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
                    <span
                      className={`social-compare__friend-avatar${on ? " social-compare__friend-avatar--ring" : ""}`}
                      aria-hidden
                    >
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
              <>
                <p className="social-compare__zoom-hint" role="note">
                  Scroll to see the full day. Tap an event for time and details.
                </p>
                <div className="social-compare__table-wrap">
                  <div className="social-compare__schedule-root social-compare__schedule-root--minimal">
                    <div className="social-compare__head-row">
                      <div className="social-compare__head-spacer" aria-hidden />
                      {selectedPosts.map((p) => (
                        <div key={p.ownerUid} className="social-compare__head-cell">
                          <span className="social-compare__head-avatar" title={`${p.displayName} @${p.handle}`}>
                            <AvatarDisplay
                              source={{
                                avatarEmoji: p.avatarEmoji,
                                avatarImageDataUrl: p.avatarImageDataUrl,
                                avatarAnimalId: p.avatarAnimalId,
                              }}
                              size="md"
                              className="social-compare__avatar-scale"
                            />
                          </span>
                          <span className="visually-hidden">
                            {p.displayName} @{p.handle}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div
                      className="social-compare__schedule-scroller"
                      aria-label="Posted schedules for the selected day. Scroll vertically to see more. Tap an event for details."
                      style={{ ["--sc-track" as string]: `${SCHEDULE_TRACK_PX}px` }}
                    >
                      <div className="social-compare__schedule-inner">
                        <div className="social-compare__time-col">
                          <div className="social-compare__time-spacer" aria-hidden />
                          <div
                            className="social-compare__time-track"
                            style={{ height: SCHEDULE_TRACK_PX, minHeight: SCHEDULE_TRACK_PX }}
                            aria-hidden
                          >
                            {HOURS.map((h) => (
                              <div
                                key={h}
                                className="social-compare__time-tick"
                                style={{
                                  top: `${((h * 60 - HOUR_START * 60) / DAY_RANGE_MIN) * 100}%`,
                                }}
                              >
                                {formatHm(h, 0).replace(":00", "")}
                              </div>
                            ))}
                          </div>
                        </div>
                        {selectedPosts.map((p) => {
                          const blocks = p.blocks.filter((b) => {
                            const s = blockStartMinutes(b);
                            const e = blockEndMinutesExclusive(b);
                            return e > HOUR_START * 60 && s < HOUR_END * 60;
                          });
                          return (
                            <div key={p.ownerUid} className="social-compare__col">
                              <div
                                className="social-compare__col-body social-compare__col-body--track"
                                style={{ height: SCHEDULE_TRACK_PX, minHeight: SCHEDULE_TRACK_PX }}
                              >
                                {blocks.map((b) => {
                                  const chrom = activityBlockChrome(b.activityId);
                                  const s = Math.max(HOUR_START * 60, blockStartMinutes(b));
                                  const e = Math.min(HOUR_END * 60, blockEndMinutesExclusive(b));
                                  const top = ((s - HOUR_START * 60) / DAY_RANGE_MIN) * 100;
                                  const hPct = Math.max(
                                    (MIN_EVENT_PX / SCHEDULE_TRACK_PX) * 100,
                                    ((e - s) / DAY_RANGE_MIN) * 100,
                                  );
                                  return (
                                    <button
                                      key={b.id}
                                      type="button"
                                      className="social-compare__event schedule-event-chip"
                                      style={{
                                        top: `${top}%`,
                                        height: `${hPct}%`,
                                        background: chrom.bg,
                                        borderColor: chrom.border,
                                        color: chrom.fg,
                                        ["--evt-icon-fg" as string]: chrom.iconFg,
                                      }}
                                      onClick={() =>
                                        setOpenEvent({
                                          block: b,
                                          displayName: p.displayName,
                                          handle: p.handle,
                                        })
                                      }
                                    >
                                      <span
                                        className="social-compare__event-lead-ico schedule-event-chip__ico"
                                        aria-hidden
                                      >
                                        <ActivityIcon id={b.activityId} size={18} />
                                      </span>
                                      <div className="social-compare__event-text">
                                        <span className="social-compare__event-title schedule-event-chip__title">
                                          {activityById(b.activityId).label}
                                        </span>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </SoftCard>

      {openEvent ? (
        <div
          className="sheet social-compare__detail-sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby="social-event-detail-title"
          aria-describedby="social-event-detail-desc"
        >
          <button
            type="button"
            className="sheet__backdrop"
            aria-label="Close"
            onClick={() => setOpenEvent(null)}
          />
          <div className="sheet__panel sheet__panel--compact social-compare__detail">
            <div className="sheet__head">
              <div className="sheet__top">
                <h2 id="social-event-detail-title" className="sheet__title">
                  {activityById(openEvent.block.activityId).label}
                </h2>
                <button type="button" className="icon-btn" onClick={() => setOpenEvent(null)} aria-label="Close">
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="sheet__body" id="social-event-detail-desc">
              <p className="social-compare__detail-person">
                {openEvent.displayName}{" "}
                <span className="social-compare__detail-handle">@{openEvent.handle}</span>
              </p>
              <p className="social-compare__detail-time">
                {formatHm(openEvent.block.startHour, openEvent.block.startMinute)} –{" "}
                {openEvent.block.endHour === 24 && openEvent.block.endMinute === 0
                  ? "12:00am"
                  : formatHm(openEvent.block.endHour, openEvent.block.endMinute)}
              </p>
              <p className="sheet__micro social-compare__detail-day">{prettyDay(pickedDay)}</p>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
