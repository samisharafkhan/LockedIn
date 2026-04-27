import { useEffect, useMemo, useState } from "react";
import { Check, UserPlus, X } from "lucide-react";
import { useSchedule } from "../context/ScheduleContext";
import { useStoryView } from "../context/StoryViewContext";
import { ActivityIcon } from "./ActivityIcon";
import { FriendRow } from "./FriendRow";
import { SoftCard } from "./SoftCard";
import { StoryBubble } from "./StoryBubble";
import { EmptyState } from "./EmptyState";
import type { FriendProfile } from "../data/friends";
import { blockEndMinutesExclusive, blockStartMinutes } from "../lib/scheduleBlocks";
import { formatMinRange, overlapSegments } from "../lib/overlap";
import { formatHm, minutesSinceMidnight } from "../lib/time";
import { getFirestoreDb } from "../lib/firebaseApp";
import { fetchDirectoryUser, fetchUserTodayBlocks, type DirectoryUser } from "../lib/userDirectory";
import type { TimeBlock } from "../types";

function placeholderFollowingFriend(id: string, loadingLabel: string): FriendProfile {
  return {
    id,
    displayName: loadingLabel,
    handle: id.length > 12 ? `${id.slice(0, 8)}…` : id,
    mark: "○",
    bio: "",
    blocks: [],
  };
}

function currentBlock(blocks: TimeBlock[], nowMin: number) {
  return blocks.find((b) => nowMin >= blockStartMinutes(b) && nowMin < blockEndMinutesExclusive(b)) ?? null;
}

type FriendsPanelProps = {
  /** Hide redundant chrome when shown under Social. */
  embedded?: boolean;
};

export function FriendsPanel({ embedded = false }: FriendsPanelProps) {
  const { openUserStory } = useStoryView();
  const {
    friends,
    blocks,
    profile,
    followingIds,
    toggleFollow,
    isFollowing,
    getFriend,
    firebaseUser,
    pendingIncomingFollows,
    acceptFollowRequest,
    rejectFollowRequest,
    t,
  } = useSchedule();
  const [followError, setFollowError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [storyQueue, setStoryQueue] = useState<string[]>([]);
  const [remoteFriendBlocks, setRemoteFriendBlocks] = useState<TimeBlock[]>([]);
  const [requesterMap, setRequesterMap] = useState<Record<string, DirectoryUser>>({});

  useEffect(() => {
    setStoryQueue((prev) => {
      const present = prev.filter((id) => followingIds.includes(id));
      const add = followingIds.filter((id) => !present.includes(id));
      return [...present, ...add];
    });
    if (selectedId && !followingIds.includes(selectedId)) setSelectedId(null);
  }, [followingIds, selectedId]);

  useEffect(() => {
    const db = getFirestoreDb();
    if (!db || !firebaseUser || pendingIncomingFollows.length === 0) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const next: Record<string, DirectoryUser> = {};
      for (const { followerUid } of pendingIncomingFollows) {
        if (getFriend(followerUid)) continue;
        const u = await fetchDirectoryUser(db, followerUid);
        if (u) next[followerUid] = u;
      }
      if (!cancelled) setRequesterMap((prev) => ({ ...prev, ...next }));
    })();
    return () => {
      cancelled = true;
    };
  }, [pendingIncomingFollows, firebaseUser, getFriend]);

  useEffect(() => {
    if (!selectedId) {
      setRemoteFriendBlocks([]);
      return;
    }
    let cancelled = false;
    void fetchUserTodayBlocks(selectedId, firebaseUser?.uid ?? null).then((b) => {
      if (!cancelled) setRemoteFriendBlocks(b);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedId, firebaseUser?.uid]);

  const friend = selectedId ? getFriend(selectedId) : undefined;
  const friendBlocks = useMemo(() => {
    if (!selectedId) return [];
    return remoteFriendBlocks;
  }, [selectedId, remoteFriendBlocks]);

  const segs = useMemo(() => overlapSegments(blocks, friendBlocks), [blocks, friendBlocks]);
  const storyFriends = useMemo(
    () => storyQueue.map((id) => getFriend(id) ?? placeholderFollowingFriend(id, t("friends_compare_loading"))),
    [storyQueue, getFriend, t],
  );

  const nowMin = minutesSinceMidnight(new Date());
  const mineNow = currentBlock(blocks, nowMin);
  const theirsNow = currentBlock(friendBlocks, nowMin);

  const openStory = (id: string) => {
    setSelectedId(id);
    setStoryQueue((prev) => {
      const next = prev.filter((x) => x !== id);
      next.push(id);
      return next;
    });
  };

  return (
    <section className="friends-panel" aria-labelledby="friends-heading">
      <SoftCard className="friends-panel__card">
        {!embedded ? (
          <p className="page-intro__label" style={{ marginBottom: 6 }}>
            PEOPLE
          </p>
        ) : null}
        <h2
          id="friends-heading"
          className="friends-overlap__title"
          style={embedded ? { marginTop: 0 } : undefined}
        >
          {t("friends_overlap_page_title")}
        </h2>
        {!embedded ? <p className="friends-overlap__sub">{t("friends_overlap_page_sub")}</p> : null}

        {storyFriends.length === 0 ? (
          <p className="friends__muted">{t("friends_compare_empty")}</p>
        ) : (
          <div className="stories-row" role="list" aria-label="Friends stories">
            <StoryBubble
              name="You"
              showAddBadge
              avatar={{
                avatarEmoji: profile.avatarEmoji ?? "○",
                avatarImageDataUrl: profile.avatarImageDataUrl ?? null,
                avatarAnimalId: profile.avatarAnimalId ?? null,
              }}
              active={!selectedId}
              onClick={() => {
                setSelectedId(null);
                if (firebaseUser) openUserStory(firebaseUser.uid);
              }}
            />
            {storyFriends.map((f) => (
              <StoryBubble
                key={f.id}
                name={f.displayName}
                avatar={{
                  avatarEmoji: f.mark ?? "○",
                  avatarImageDataUrl: null,
                  avatarAnimalId: null,
                }}
                active={selectedId === f.id}
                onClick={() => openStory(f.id)}
              />
            ))}
          </div>
        )}

        {selectedId && friend ? (
          <>
            <div className="friends-focus-head">
              <div>
                <p className="friends-focus-head__name">{friend.displayName}</p>
                <p className="friends-focus-head__handle">@{friend.handle}</p>
              </div>
              <button type="button" className="btn btn--sm btn--outline" onClick={() => setSelectedId(null)}>
                {t("friends_back_compare")}
              </button>
            </div>
            <div className="compare-now">
              <div className="compare-now__card compare-now__card--them">
                <p className="compare-now__eyebrow">{t("friends_them_now", { name: friend.displayName })}</p>
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
            </div>
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
        ) : (
          <div className="friends-feed-list">
            {storyFriends.length === 0 ? (
              <p className="friends__muted">{t("friends_compare_empty")}</p>
            ) : (
              storyFriends.map((f) => {
                const nowBlock = currentBlock(f.blocks, nowMin);
                return (
                  <FriendRow
                    key={f.id}
                    name={f.displayName}
                    handle={f.handle}
                    avatar={{ avatarEmoji: f.mark ?? "○", avatarImageDataUrl: null, avatarAnimalId: null }}
                    status={
                      nowBlock
                        ? `${t(`act_${nowBlock.activityId}_label`)} · ${formatHm(
                            nowBlock.startHour,
                            nowBlock.startMinute,
                          )}`
                        : "Free · All day"
                    }
                    indicator={nowBlock ? "yellow" : "green"}
                    onClick={() => openStory(f.id)}
                  />
                );
              })
            )}
          </div>
        )}
      </SoftCard>

      {friends.length > 0 ? (
      <SoftCard>
        <h3 className="friends-panel__subhead">{t("friends_suggested_title")}</h3>
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
                  className={`pill-btn ${isFollowing(f.id) ? "pill-btn--secondary" : "pill-btn--primary"}`}
                  onClick={() => {
                    setFollowError(null);
                    void toggleFollow(f.id).catch((err) => {
                      setFollowError(err instanceof Error ? err.message : "Couldn't follow right now.");
                    });
                  }}
                >
                  {isFollowing(f.id) ? (
                    <>{t("friends_following_btn")}</>
                  ) : (
                    <>
                      <UserPlus size={16} strokeWidth={2} aria-hidden /> {t("friends_follow")}
                    </>
                  )}
                </button>
              </div>
              <p className="friend-card__bio">{(f.bio ?? "").split(".")[0]}</p>
            </article>
          ))}
        </div>
        {followError ? <p className="friends__muted" style={{ color: "var(--danger)" }}>{followError}</p> : null}
      </SoftCard>
      ) : (
        <SoftCard>
          <EmptyState
            title={t("friends_suggested_empty_title")}
            description={t("friends_suggested_empty_sub")}
            mascot={false}
          />
        </SoftCard>
      )}

      {firebaseUser && pendingIncomingFollows.length > 0 && !embedded ? (
        <SoftCard className="friends__section friends__section--requests">
          <h3 className="friends__h3">{t("friends_incoming_title")}</h3>
          <p className="friends__sub friends__sub--tight">{t("friends_requests_sub")}</p>
          <ul className="friends__request-list" role="list">
            {pendingIncomingFollows.map(({ followerUid }) => {
              const person = getFriend(followerUid) ?? requesterMap[followerUid];
              return (
                <li key={followerUid} className="friends__request-row">
                  <div>
                    <p className="friends__request-name">{person?.displayName ?? t("friends_request_unknown")}</p>
                    <p className="friends__request-handle">
                      {person?.handle ? `@${person.handle}` : followerUid.slice(0, 10)}
                    </p>
                  </div>
                  <div className="friends__request-actions friends__request-actions--icons">
                    <button
                      type="button"
                      className="icon-btn friends__request-icon-btn friends__request-icon-btn--accept"
                      onClick={() => void acceptFollowRequest(followerUid)}
                      aria-label={t("friends_accept")}
                      title={t("friends_accept")}
                    >
                      <Check size={22} strokeWidth={2.5} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn friends__request-icon-btn friends__request-icon-btn--decline"
                      onClick={() => void rejectFollowRequest(followerUid)}
                      aria-label={t("friends_decline")}
                      title={t("friends_decline")}
                    >
                      <X size={22} strokeWidth={2.5} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </SoftCard>
      ) : null}
    </section>
  );
}
