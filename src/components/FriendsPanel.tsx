import { useEffect, useMemo, useState } from "react";
import { UserPlus, UserMinus } from "lucide-react";
import { activityById } from "../data/activities";
import { useSchedule } from "../context/ScheduleContext";
import { ActivityIcon } from "./ActivityIcon";
import { blockEndMinutesExclusive, blockStartMinutes } from "../lib/scheduleBlocks";
import { formatMinRange, overlapSegments } from "../lib/overlap";
import { minutesSinceMidnight } from "../lib/time";

const VIEW = { start: 0, end: 24 * 60 };

function layoutPct(s: number, e: number) {
  const len = VIEW.end - VIEW.start;
  const top = ((Math.max(s, VIEW.start) - VIEW.start) / len) * 100;
  const h = ((Math.min(e, VIEW.end) - Math.max(s, VIEW.start)) / len) * 100;
  return { top, height: Math.max(h, 2) };
}

export function FriendsPanel() {
  const {
    friends,
    blocks,
    profile,
    followingIds,
    toggleFollow,
    isFollowing,
    getFriend,
  } = useSchedule();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (followingIds.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !followingIds.includes(selectedId)) {
      setSelectedId(followingIds[0]);
    }
  }, [followingIds, selectedId]);

  const friend = selectedId ? getFriend(selectedId) : undefined;
  const friendBlocks = friend?.blocks ?? [];

  const segs = useMemo(() => overlapSegments(blocks, friendBlocks), [blocks, friendBlocks]);

  const nowMin = minutesSinceMidnight(new Date());

  return (
    <section className="friends" aria-labelledby="friends-heading">
      <div className="friends__head">
        <div>
          <p className="eyebrow eyebrow--dark">People</p>
          <h2 id="friends-heading" className="friends__title">
            Friends & overlap
          </h2>
          <p className="friends__sub">
            Follow people to line up calendars. This demo uses local profiles — no server yet.
          </p>
        </div>
        <div className="avatar-ring" aria-hidden>
          <span className="avatar-ring__glyph">{profile.avatarEmoji}</span>
        </div>
      </div>

      <div className="friends__section">
        <h3 className="friends__h3">Discover</h3>
        <div className="friend-cards">
          {friends.map((f) => (
            <article key={f.id} className="friend-card">
              <div className="friend-card__row">
                <span className="friend-card__mark" aria-hidden>
                  {f.mark}
                </span>
                <div>
                  <p className="friend-card__name">{f.displayName}</p>
                  <p className="friend-card__handle">@{f.handle}</p>
                </div>
                <button
                  type="button"
                  className={`btn btn--sm ${isFollowing(f.id) ? "btn--outline" : "btn--primary"}`}
                  onClick={() => toggleFollow(f.id)}
                >
                  {isFollowing(f.id) ? (
                    <>
                      <UserMinus size={16} strokeWidth={2} aria-hidden /> Unfollow
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} strokeWidth={2} aria-hidden /> Follow
                    </>
                  )}
                </button>
              </div>
              <p className="friend-card__bio">{f.bio}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="friends__section">
        <h3 className="friends__h3">Compare today</h3>
        <div className="seg-tabs" role="tablist" aria-label="Pick a friend to compare">
          {followingIds.length === 0 ? (
            <p className="friends__empty">Follow someone to unlock side-by-side overlap.</p>
          ) : (
            followingIds.map((id) => {
              const f = getFriend(id);
              if (!f) return null;
              return (
                <button
                  key={id}
                  type="button"
                  className={`seg-tab ${selectedId === id ? "seg-tab--on" : ""}`}
                  onClick={() => setSelectedId(id)}
                  aria-pressed={selectedId === id}
                >
                  {f.displayName}
                </button>
              );
            })
          )}
        </div>

        {friend ? (
          <>
            <div className="dual-cal">
              <div className="dual-cal__col">
                <p className="dual-cal__label">You</p>
                <div className="dual-cal__surface">
                  <span className="dual-cal__now" style={{ top: `${(nowMin / (24 * 60)) * 100}%` }} />
                  {blocks.map((b) => {
                    const s = blockStartMinutes(b);
                    const e = blockEndMinutesExclusive(b);
                    const { top, height } = layoutPct(s, e);
                    const a = activityById(b.activityId);
                    return (
                      <div
                        key={b.id}
                        className="dual-cal__block dual-cal__block--me"
                        style={{ top: `${top}%`, height: `${height}%` }}
                        title={a.label}
                      >
                        <ActivityIcon id={b.activityId} size={14} />
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="dual-cal__col">
                <p className="dual-cal__label">{friend.displayName}</p>
                <div className="dual-cal__surface">
                  <span className="dual-cal__now" style={{ top: `${(nowMin / (24 * 60)) * 100}%` }} />
                  {friendBlocks.map((b) => {
                    const s = blockStartMinutes(b);
                    const e = blockEndMinutesExclusive(b);
                    const { top, height } = layoutPct(s, e);
                    return (
                      <div
                        key={b.id}
                        className="dual-cal__block dual-cal__block--them"
                        style={{ top: `${top}%`, height: `${height}%` }}
                        title={activityById(b.activityId).label}
                      >
                        <ActivityIcon id={b.activityId} size={14} />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="overlap-list">
              <h4 className="overlap-list__title">Overlap windows</h4>
              <ul>
                {segs
                  .filter((s) => s.mine && s.theirs)
                  .map((s, i) => (
                    <li key={`${s.startMin}-${i}`}>
                      <span className="overlap-pill">Both busy</span>
                      <span className="overlap-range">{formatMinRange(s.startMin, s.endMin)}</span>
                    </li>
                  ))}
              </ul>
              {segs.every((s) => !(s.mine && s.theirs)) ? (
                <p className="friends__muted">No overlapping busy windows for these demo schedules.</p>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
