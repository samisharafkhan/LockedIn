import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Search, UserPlus, UserMinus } from "lucide-react";
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
    t,
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
          <p className="eyebrow eyebrow--dark">{t("friends_eyebrow")}</p>
          <h2 id="friends-heading" className="friends__title">
            {t("friends_title")}
          </h2>
          <p className="friends__sub">{t("friends_sub")}</p>
        </div>
        <div className="avatar-ring" aria-hidden>
          <AvatarDisplay source={profile} size="md" />
        </div>
      </div>

      <div className="friends__section">
        <h3 className="friends__h3">{t("friends_discover")}</h3>
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
                      <UserMinus size={16} strokeWidth={2} aria-hidden /> {t("friends_unfollow")}
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} strokeWidth={2} aria-hidden /> {t("friends_follow")}
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
        <h3 className="friends__h3">{t("friends_compare_title")}</h3>
        {followingIds.length === 0 ? (
          <p className="friends__empty">{t("friends_compare_empty")}</p>
        ) : (
          <div className="friends__compare-picker">
            <p className="friends__following-strip-label">{t("friends_compare_with_label")}</p>
            <p className="friends__compare-hint">{t("friends_compare_hint")}</p>
            <div className="friends__compare-search-wrap">
              <Search className="friends__compare-search-icon" size={18} strokeWidth={2} aria-hidden />
              <input
                type="search"
                className="friends__compare-search"
                placeholder={t("friends_search_placeholder")}
                value={compareQuery}
                onChange={(e) => setCompareQuery(e.target.value)}
                enterKeyHint="search"
                autoComplete="off"
                aria-label={t("friends_search_placeholder")}
              />
            </div>
            <ul className="friends__following-list" role="listbox" aria-label={t("friends_following_list_a11y")}>
              {followingMatches.length === 0 ? (
                <li className="friends__compare-empty">
                  {compareQuery.trim()
                    ? t("friends_following_no_match", { query: compareQuery.trim() })
                    : t("friends_following_none")}
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
                        {selectedId === f.id ? t("friends_selected") : ""}
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
                <p className="compare-now__eyebrow">{t("friends_you_now")}</p>
                {mineNow ? (
                  <>
                    <div className="compare-now__icon" aria-hidden>
                      <ActivityIcon id={mineNow.activityId} size={26} />
                    </div>
                    <p className="compare-now__label">{t(`act_${mineNow.activityId}_label`)}</p>
                    <p className="compare-now__time">
                      {formatHm(mineNow.startHour, mineNow.startMinute)} –{" "}
                      {mineNow.endHour === 24 && mineNow.endMinute === 0
                        ? t("schedule_midnight")
                        : formatHm(mineNow.endHour, mineNow.endMinute)}
                    </p>
                  </>
                ) : (
                  <p className="compare-now__empty">{t("friends_empty_cal")}</p>
                )}
              </div>
              <div className="compare-now__card compare-now__card--them">
                <p className="compare-now__eyebrow">
                  {t("friends_them_now", { name: friend.displayName })}
                </p>
                {theirsNow ? (
                  <>
                    <div className="compare-now__icon" aria-hidden>
                      <ActivityIcon id={theirsNow.activityId} size={26} />
                    </div>
                    <p className="compare-now__label">{t(`act_${theirsNow.activityId}_label`)}</p>
                    <p className="compare-now__time">
                      {formatHm(theirsNow.startHour, theirsNow.startMinute)} –{" "}
                      {theirsNow.endHour === 24 && theirsNow.endMinute === 0
                        ? t("schedule_midnight")
                        : formatHm(theirsNow.endHour, theirsNow.endMinute)}
                    </p>
                  </>
                ) : (
                  <p className="compare-now__empty">{t("friends_empty_theirs")}</p>
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
                {dayExpanded ? t("friends_hide_full_day") : t("friends_see_full_day")}
              </span>
              <ChevronDown className="compare-expand__chev" size={20} strokeWidth={2} aria-hidden />
            </button>

            {dayExpanded ? (
              <div className="compare-day-panels">
                <div className="compare-day">
                  <h4 className="compare-day__title">{t("friends_your_day")}</h4>
                  <ul className="compare-day__list">
                    {blocks.length === 0 ? (
                      <li className="compare-day__empty">{t("friends_no_blocks")}</li>
                    ) : (
                      blocks.map((b) => (
                        <li key={b.id} className="compare-day__row">
                          <span className="compare-day__ico" aria-hidden>
                            <ActivityIcon id={b.activityId} size={18} />
                          </span>
                          <div>
                            <p className="compare-day__name">{t(`act_${b.activityId}_label`)}</p>
                            <p className="compare-day__meta">
                              {formatHm(b.startHour, b.startMinute)} –{" "}
                              {b.endHour === 24 && b.endMinute === 0
                                ? t("schedule_midnight")
                                : formatHm(b.endHour, b.endMinute)}
                            </p>
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
                <div className="compare-day">
                  <h4 className="compare-day__title">
                    {t("friends_their_day", { name: friend.displayName })}
                  </h4>
                  <ul className="compare-day__list">
                    {friendBlocks.map((b) => (
                      <li key={b.id} className="compare-day__row">
                        <span className="compare-day__ico" aria-hidden>
                          <ActivityIcon id={b.activityId} size={18} />
                        </span>
                        <div>
                          <p className="compare-day__name">{t(`act_${b.activityId}_label`)}</p>
                          <p className="compare-day__meta">
                            {formatHm(b.startHour, b.startMinute)} –{" "}
                            {b.endHour === 24 && b.endMinute === 0
                              ? t("schedule_midnight")
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
              <h4 className="overlap-list__title">{t("friends_overlap_title")}</h4>
              <ul>
                {segs
                  .filter((s) => s.mine && s.theirs)
                  .map((s, i) => (
                    <li key={`${s.startMin}-${i}`}>
                      <span className="overlap-pill">{t("friends_overlap_both")}</span>
                      <span className="overlap-range">{formatMinRange(s.startMin, s.endMin)}</span>
                    </li>
                  ))}
              </ul>
              {segs.every((s) => !(s.mine && s.theirs)) ? (
                <p className="friends__muted">{t("friends_overlap_none")}</p>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
