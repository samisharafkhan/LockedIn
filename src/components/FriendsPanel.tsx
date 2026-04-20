import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Search, UserPlus, UserMinus } from "lucide-react";
import { activityById } from "../data/activities";
import { AvatarDisplay } from "./AvatarDisplay";
import { useSchedule } from "../context/ScheduleContext";
import { ActivityIcon } from "./ActivityIcon";
import { blockEndMinutesExclusive, blockStartMinutes } from "../lib/scheduleBlocks";
import { formatMinRange, overlapSegments } from "../lib/overlap";
import { formatHm, minutesSinceMidnight } from "../lib/time";
import type { TimeBlock } from "../types";

function currentBlock(blocks: TimeBlock[], nowMin: number) {
  return (
    blocks.find(
      (b) => nowMin >= blockStartMinutes(b) && nowMin < blockEndMinutesExclusive(b),
    ) ?? null
  );
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
  const [dayExpanded, setDayExpanded] = useState(false);
  const [compareQuery, setCompareQuery] = useState("");

  useEffect(() => {
    if (followingIds.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !followingIds.includes(selectedId)) {
      setSelectedId(followingIds[0]);
    }
  }, [followingIds, selectedId]);

  useEffect(() => {
    setDayExpanded(false);
  }, [selectedId]);

  const friend = selectedId ? getFriend(selectedId) : undefined;
  const friendBlocks = friend?.blocks ?? [];

  const segs = useMemo(() => overlapSegments(blocks, friendBlocks), [blocks, friendBlocks]);

  const followingMatches = useMemo(() => {
    const q = compareQuery.trim().toLowerCase();
    return followingIds
      .map((id) => getFriend(id))
      .filter((f): f is NonNullable<typeof f> => Boolean(f))
      .filter((f) => {
        if (!q) return true;
        return (
          f.displayName.toLowerCase().includes(q) || f.handle.toLowerCase().includes(q)
        );
      });
  }, [followingIds, getFriend, compareQuery]);

  const nowMin = minutesSinceMidnight(new Date());
  const mineNow = currentBlock(blocks, nowMin);
  const theirsNow = currentBlock(friendBlocks, nowMin);

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
          <AvatarDisplay source={profile} size="md" />
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
        {followingIds.length === 0 ? (
          <p className="friends__empty">Follow someone to compare what you’re both in right now.</p>
        ) : (
          <div className="friends__compare-picker">
            <p className="friends__following-strip-label">Compare with</p>
            <p className="friends__compare-hint">
              Search people you follow — works the same with long lists as with a few friends.
            </p>
            <div className="friends__compare-search-wrap">
              <Search className="friends__compare-search-icon" size={18} strokeWidth={2} aria-hidden />
              <input
                type="search"
                className="friends__compare-search"
                placeholder="Search by name or @handle"
                value={compareQuery}
                onChange={(e) => setCompareQuery(e.target.value)}
                enterKeyHint="search"
                autoComplete="off"
                aria-label="Search people you follow"
              />
            </div>
            <ul className="friends__following-list" role="listbox" aria-label="Following — pick someone to compare">
              {followingMatches.length === 0 ? (
                <li className="friends__compare-empty">
                  {compareQuery.trim()
                    ? `No one you follow matches “${compareQuery.trim()}”.`
                    : "No people to show."}
                </li>
              ) : (
                followingMatches.map((f) => (
                  <li key={f.id} role="none">
                    <button
                      type="button"
                      role="option"
                      aria-selected={selectedId === f.id}
                      className={`friends__following-row ${selectedId === f.id ? "friends__following-row--on" : ""}`}
                      onClick={() => setSelectedId(f.id)}
                    >
                      <span className="friends__following-row-mark" aria-hidden>
                        {f.mark}
                      </span>
                      <span className="friends__following-row-text">
                        <p className="friends__following-row-name">{f.displayName}</p>
                        <p className="friends__following-row-handle">@{f.handle}</p>
                      </span>
                      <span className="friends__following-row-check">
                        {selectedId === f.id ? "Selected" : ""}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}

        {friend ? (
          <>
            <div className="compare-now">
              <div className="compare-now__card compare-now__card--me">
                <p className="compare-now__eyebrow">You · right now</p>
                {mineNow ? (
                  <>
                    <div className="compare-now__icon" aria-hidden>
                      <ActivityIcon id={mineNow.activityId} size={26} />
                    </div>
                    <p className="compare-now__label">{activityById(mineNow.activityId).label}</p>
                    <p className="compare-now__time">
                      {formatHm(mineNow.startHour, mineNow.startMinute)} –{" "}
                      {mineNow.endHour === 24 && mineNow.endMinute === 0
                        ? "midnight"
                        : formatHm(mineNow.endHour, mineNow.endMinute)}
                    </p>
                  </>
                ) : (
                  <p className="compare-now__empty">Nothing on your calendar for this moment.</p>
                )}
              </div>
              <div className="compare-now__card compare-now__card--them">
                <p className="compare-now__eyebrow">{friend.displayName} · right now</p>
                {theirsNow ? (
                  <>
                    <div className="compare-now__icon" aria-hidden>
                      <ActivityIcon id={theirsNow.activityId} size={26} />
                    </div>
                    <p className="compare-now__label">{activityById(theirsNow.activityId).label}</p>
                    <p className="compare-now__time">
                      {formatHm(theirsNow.startHour, theirsNow.startMinute)} –{" "}
                      {theirsNow.endHour === 24 && theirsNow.endMinute === 0
                        ? "midnight"
                        : formatHm(theirsNow.endHour, theirsNow.endMinute)}
                    </p>
                  </>
                ) : (
                  <p className="compare-now__empty">Nothing on their demo arc for this moment.</p>
                )}
              </div>
            </div>

            <button
              type="button"
              className={`compare-expand ${dayExpanded ? "compare-expand--open" : ""}`}
              onClick={() => setDayExpanded((v) => !v)}
              aria-expanded={dayExpanded}
            >
              <span className="compare-expand__text">
                {dayExpanded ? "Hide full day" : "See full day for both"}
              </span>
              <ChevronDown className="compare-expand__chev" size={20} strokeWidth={2} aria-hidden />
            </button>

            {dayExpanded ? (
              <div className="compare-day-panels">
                <div className="compare-day">
                  <h4 className="compare-day__title">Your day</h4>
                  <ul className="compare-day__list">
                    {blocks.length === 0 ? (
                      <li className="compare-day__empty">No blocks yet.</li>
                    ) : (
                      blocks.map((b) => (
                        <li key={b.id} className="compare-day__row">
                          <span className="compare-day__ico" aria-hidden>
                            <ActivityIcon id={b.activityId} size={18} />
                          </span>
                          <div>
                            <p className="compare-day__name">{activityById(b.activityId).label}</p>
                            <p className="compare-day__meta">
                              {formatHm(b.startHour, b.startMinute)} –{" "}
                              {b.endHour === 24 && b.endMinute === 0
                                ? "midnight"
                                : formatHm(b.endHour, b.endMinute)}
                            </p>
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
                <div className="compare-day">
                  <h4 className="compare-day__title">{`${friend.displayName}'s day (demo)`}</h4>
                  <ul className="compare-day__list">
                    {friendBlocks.map((b) => (
                      <li key={b.id} className="compare-day__row">
                        <span className="compare-day__ico" aria-hidden>
                          <ActivityIcon id={b.activityId} size={18} />
                        </span>
                        <div>
                          <p className="compare-day__name">{activityById(b.activityId).label}</p>
                          <p className="compare-day__meta">
                            {formatHm(b.startHour, b.startMinute)} –{" "}
                            {b.endHour === 24 && b.endMinute === 0
                              ? "midnight"
                              : formatHm(b.endHour, b.endMinute)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}

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
