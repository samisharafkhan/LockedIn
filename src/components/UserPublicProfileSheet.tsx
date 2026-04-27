import { useEffect, useMemo, useState } from "react";
import { Lock, UserPlus, X } from "lucide-react";
import { useSchedule } from "../context/ScheduleContext";
import { useStoryView } from "../context/StoryViewContext";
import { activityById } from "../data/activities";
import { ActivityIcon } from "./ActivityIcon";
import { AvatarDisplay } from "./AvatarDisplay";
import { getFirestoreDb } from "../lib/firebaseApp";
import { hasActiveStoryForOwner } from "../lib/stories";
import { fetchDirectoryUser, fetchUserTodayBlocks, type DirectoryUser } from "../lib/userDirectory";
import { fetchRemoteUserSnapshot } from "../lib/remoteUserState";
import { subscribeUserSchedulePosts, type SchedulePostDoc } from "../lib/schedulePosts";
import { isSyntheticCelebrityUid, getCelebrityPublished } from "../data/discoverCelebrities";
import { PostSocialBar } from "./PostSocialBar";
import { hoursByActivityLastNDays } from "../lib/weekStats";
import { formatHm } from "../lib/time";
import { storedToTimeBlock } from "./ProfilePostUtils";
import { SchedulePostHCard } from "./SchedulePostHCard";
import type { ActivityId, TimeBlock } from "../types";

type Preview = {
  displayName: string;
  handle: string;
  avatarEmoji?: string;
  bio?: string;
  isPrivate?: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  targetUid: string | null;
  preview?: Preview | null;
};

export function UserPublicProfileSheet({ open, onClose, targetUid, preview }: Props) {
  const { t, firebaseUser, isFollowing, hasPendingFollowRequest, toggleFollow, seedDirectoryUser, todayKey } =
    useSchedule();
  const { openUserStory } = useStoryView();
  const [dir, setDir] = useState<DirectoryUser | null>(null);
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [busy, setBusy] = useState(false);
  const [scheduleLocked, setScheduleLocked] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [followError, setFollowError] = useState<string | null>(null);
  const [remoteSchedule, setRemoteSchedule] = useState<Record<string, TimeBlock[]>>({});
  const [remotePulse, setRemotePulse] = useState<{ activityId: string; at: number } | null>(null);
  const [postRows, setPostRows] = useState<{ id: string; data: SchedulePostDoc }[]>([]);
  const [openPost, setOpenPost] = useState<{ id: string; data: SchedulePostDoc } | null>(null);
  const [celebrityMode, setCelebrityMode] = useState(false);
  const [hasActiveStory, setHasActiveStory] = useState(false);

  const weekTotals = useMemo(
    () => hoursByActivityLastNDays(remoteSchedule, 7),
    [remoteSchedule],
  );
  const feedItems = useMemo(() => {
    const items: { id: ActivityId; hours: number; label: string }[] = [];
    for (const [id, h] of weekTotals.entries()) {
      if (h >= 0.25) {
        items.push({ id, hours: h, label: activityById(id).label });
      }
    }
    return items.sort((a, b) => b.hours - a.hours).slice(0, 4);
  }, [weekTotals]);

  useEffect(() => {
    if (!open || !targetUid || !firebaseUser) {
      setDir(null);
      setBlocks([]);
      setScheduleLocked(false);
      setRemoteSchedule({});
      setRemotePulse(null);
      setPostRows([]);
      setCelebrityMode(false);
      return;
    }
    if (isSyntheticCelebrityUid(targetUid)) {
      setCelebrityMode(true);
      setBusy(true);
      const row = getCelebrityPublished(targetUid, todayKey);
      setDir(null);
      setScheduleLocked(false);
      setRemoteSchedule({});
      setRemotePulse(null);
      setPostRows([]);
      if (row) {
        setBlocks(row.blocks.map((sb) => storedToTimeBlock(sb)));
      } else {
        setBlocks([]);
      }
      setBusy(false);
      return;
    }
    setCelebrityMode(false);
    const db = getFirestoreDb();
    let cancelled = false;
    setBusy(true);
    void (async () => {
      try {
        const d = db ? await fetchDirectoryUser(db, targetUid) : null;
        if (cancelled) return;
        setDir(d);
        const priv = d?.isPrivate === true || d?.accountPublic === false;
        const viewer = firebaseUser.uid;
        const isSelf = viewer === targetUid;
        const following = isFollowing(targetUid);
        const locked = !isSelf && priv && !following;
        setScheduleLocked(locked);
        const list = locked ? [] : await fetchUserTodayBlocks(targetUid, viewer);
        if (!cancelled) setBlocks(list);

        if (!locked) {
          const snap = await fetchRemoteUserSnapshot(targetUid);
          if (!cancelled && snap) {
            setRemoteSchedule(snap.scheduleByDay);
            setRemotePulse(
              snap.pulse
                ? { activityId: snap.pulse.activityId, at: snap.pulse.at }
                : null,
            );
          }
        } else {
          setRemoteSchedule({});
          setRemotePulse(null);
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, targetUid, firebaseUser, isFollowing, todayKey]);

  useEffect(() => {
    if (!open || !targetUid || !firebaseUser) {
      return;
    }
    if (celebrityMode || isSyntheticCelebrityUid(targetUid)) {
      return;
    }
    if (scheduleLocked) {
      setPostRows([]);
      return;
    }
    return subscribeUserSchedulePosts(targetUid, setPostRows);
  }, [open, targetUid, firebaseUser, scheduleLocked, celebrityMode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !targetUid || !firebaseUser || celebrityMode || isSyntheticCelebrityUid(targetUid)) {
      setHasActiveStory(false);
      return;
    }
    const db = getFirestoreDb();
    if (!db) {
      setHasActiveStory(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const ok = await hasActiveStoryForOwner(db, targetUid);
        if (!cancelled) setHasActiveStory(ok);
      } catch {
        if (!cancelled) setHasActiveStory(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, targetUid, firebaseUser, celebrityMode]);

  const displayName = dir?.displayName ?? preview?.displayName ?? "…";
  const handle = dir?.handle ?? preview?.handle ?? "";
  const emoji = dir?.avatarEmoji ?? preview?.avatarEmoji ?? "○";
  const bioText = (dir?.bio ?? preview?.bio ?? "").trim();
  const isSelf = firebaseUser?.uid === targetUid;
  const following = targetUid != null ? isFollowing(targetUid) : false;
  const canOpenStory =
    Boolean(targetUid) &&
    hasActiveStory &&
    (isSelf || following);
  const pending = targetUid != null ? hasPendingFollowRequest(targetUid) : false;
  const isPrivate = dir?.isPrivate === true || dir?.accountPublic === false;

  const followAction = async () => {
    if (!targetUid) return;
    if (followBusy) return;
    if (!following && !pending) {
      if (dir) seedDirectoryUser(dir);
      else if (preview) {
        seedDirectoryUser({
          uid: targetUid,
          handle: preview.handle,
          displayName: preview.displayName,
          avatarEmoji: preview.avatarEmoji,
          bio: preview.bio,
          ...(preview.isPrivate === true ? { isPrivate: true, accountPublic: false } : {}),
        });
      }
    }
    const fromDir = dir != null ? dir.isPrivate === true || dir.accountPublic === false : undefined;
    const fromPreview = preview?.isPrivate;
    const targetIsPrivate =
      fromDir !== undefined ? fromDir : fromPreview !== undefined ? fromPreview : undefined;
    setFollowBusy(true);
    try {
      await toggleFollow(
        targetUid,
        targetIsPrivate === undefined ? undefined : { targetIsPrivate },
      );
      setFollowError(null);
    } catch (err) {
      setFollowError(err instanceof Error ? err.message : t("friends_follow_error"));
    } finally {
      window.setTimeout(() => setFollowBusy(false), 180);
    }
  };

  if (!open || !targetUid) return null;

  return (
    <div className="sheet sheet--fullscreen" role="dialog" aria-modal="true" aria-labelledby="public-profile-title">
      <button type="button" className="sheet__backdrop" aria-label={t("block_close")} onClick={onClose} />
      <div className="sheet__panel sheet__panel--profile-preview">
        <div className="sheet__head">
          <div className="sheet__top">
            <h2 id="public-profile-title" className="sheet__title">
              {t("discover_profile_title")}
            </h2>
            <button type="button" className="icon-btn glass-hit" onClick={onClose} aria-label={t("block_close")}>
              <X size={22} strokeWidth={2} />
            </button>
          </div>
        </div>
        <div className="sheet__body">
          <div className="profile-preview__hero">
            {canOpenStory && targetUid ? (
              <button
                type="button"
                className="profile-preview__avatar profile-preview__avatar--story-ring"
                onClick={() => {
                  onClose();
                  openUserStory(targetUid);
                }}
                aria-label={t("profile_open_story")}
              >
                <AvatarDisplay
                  source={{ avatarEmoji: emoji, avatarImageDataUrl: null, avatarAnimalId: null }}
                  size="lg"
                />
              </button>
            ) : (
              <div className="profile-preview__avatar" aria-hidden>
                <AvatarDisplay
                  source={{ avatarEmoji: emoji, avatarImageDataUrl: null, avatarAnimalId: null }}
                  size="lg"
                />
              </div>
            )}
            <div>
              <p className="profile-preview__name">{displayName}</p>
              <p className="profile-preview__handle">@{handle}</p>
              {isPrivate ? <p className="profile-preview__badge">{t("friends_directory_private")}</p> : null}
            </div>
          </div>

          {bioText ? <p className="profile-preview__bio">{bioText}</p> : <p className="friends__muted">{t("profile_bio_empty")}</p>}

          {celebrityMode ? (
            <p className="friends__muted" style={{ marginTop: 10 }}>
              {t("discover_celeb_disclaimer")}
            </p>
          ) : null}

          {!isSelf && firebaseUser && !celebrityMode ? (
            <div className="profile-preview__actions">
              <button
                type="button"
                className={`btn btn--wide glass-hit ${following || pending ? "btn--outline" : "btn--primary"} ${followBusy ? "btn--busy" : ""}`}
                onClick={() => void followAction()}
                disabled={followBusy}
              >
                {following ? (
                  <>{t("friends_following_btn")}</>
                ) : pending ? (
                  <>{t("friends_requested")}</>
                ) : isPrivate ? (
                  <>
                    <UserPlus size={18} strokeWidth={2} aria-hidden /> {t("friends_request_follow")}
                  </>
                ) : (
                  <>
                    <UserPlus size={18} strokeWidth={2} aria-hidden /> {t("friends_follow")}
                  </>
                )}
              </button>
              {followError ? (
                <p className="friends__muted" style={{ color: "var(--danger)", marginTop: 8 }}>
                  {followError}
                </p>
              ) : null}
            </div>
          ) : null}

          {scheduleLocked ? (
            <div className="profile-private-lock glass-panel">
              <div className="profile-private-lock__icon" aria-hidden>
                <Lock size={40} strokeWidth={1.25} />
              </div>
              <h3 className="profile-private-lock__title">{t("profile_private_title")}</h3>
              <p className="profile-private-lock__sub">{t("profile_private_sub")}</p>
            </div>
          ) : (
            <>
              <p className="sheet__section-label">{t("profile_section_week")}</p>
              {busy ? (
                <p className="friends__muted">{t("discover_loading")}</p>
              ) : feedItems.length === 0 ? (
                <p className="friends__muted">{t("profile_week_empty_remote")}</p>
              ) : (
                <div className="metric-feed metric-feed--compact">
                  {feedItems.map((it) => (
                    <div key={it.id} className="metric-card glass-panel">
                      <p className="metric-card__eyebrow">{t("profile_week_eyebrow")}</p>
                      <p className="metric-card__title">
                        <strong>{displayName}</strong>{" "}
                        {t("profile_week_line", { h: it.hours.toFixed(1), act: it.label.toLowerCase() })}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <p className="sheet__section-label">{t("profile_section_now")}</p>
              {busy ? null : !remotePulse ? (
                <p className="friends__muted">{t("profile_pulse_empty_remote")}</p>
              ) : (
                <div className="profile-remote-pulse glass-panel">
                  <div className="profile-remote-pulse__row">
                    <span className="profile-remote-pulse__ico" aria-hidden>
                      <ActivityIcon id={remotePulse.activityId as ActivityId} size={28} />
                    </span>
                    <div>
                      <p className="profile-remote-pulse__eyebrow">{t("profile_pulse_eyebrow")}</p>
                      <p className="profile-remote-pulse__val">
                        {activityById(remotePulse.activityId as ActivityId).label}
                      </p>
                      <p className="profile-remote-pulse__meta">
                        {new Intl.DateTimeFormat(undefined, {
                          weekday: "short",
                          hour: "numeric",
                          minute: "2-digit",
                        }).format(new Date(remotePulse.at))}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <p className="sheet__section-label">{t("discover_today_schedule")}</p>
              {busy ? (
                <p className="friends__muted">{t("discover_loading")}</p>
              ) : blocks.length === 0 ? (
                <p className="friends__muted">{t("discover_no_blocks_today")}</p>
              ) : (
                <ol className="discover__blocks">
                  {blocks.map((b) => (
                    <li key={b.id} className="discover__block-row glass-panel glass-panel--row">
                      <span className="discover__block-ico" aria-hidden>
                        <ActivityIcon id={b.activityId} size={18} />
                      </span>
                      <div>
                        <p className="discover__block-label">{t(`act_${b.activityId}_label`)}</p>
                        <p className="discover__block-time">
                          {formatHm(b.startHour, b.startMinute)} –{" "}
                          {b.endHour === 24 && b.endMinute === 0
                            ? t("schedule_midnight")
                            : formatHm(b.endHour, b.endMinute)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}

              {postRows.length > 0 ? (
                <>
                  <p className="sheet__section-label">{t("profile_section_posts")}</p>
                  <ul className="post-hcard-list post-hcard-list--in-sheet" role="list">
                    {postRows.map(({ id, data }) => (
                      <li key={id} className="post-hcard-list__item" role="listitem">
                        <SchedulePostHCard data={data} onOpen={() => setOpenPost({ id, data })} variant="profile" />
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </>
          )}
        </div>
      </div>

      {openPost ? (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="post-detail-title">
          <button type="button" className="modal__backdrop" aria-label="Close" onClick={() => setOpenPost(null)} />
          <div className="modal__panel glass-panel">
            <div className="modal__top">
              <h3 id="post-detail-title">{t("profile_post_day", { day: openPost.data.dayKey })}</h3>
              <button type="button" className="icon-btn glass-hit" onClick={() => setOpenPost(null)} aria-label="Close">
                <X size={22} strokeWidth={2} />
              </button>
            </div>
            {firebaseUser ? (
              <PostSocialBar
                variant="schedulePost"
                postId={openPost.id}
                ownerUid={openPost.data.ownerUid}
                showPinControl={openPost.data.ownerUid === firebaseUser.uid}
                postPinned={openPost.data.pinned === true}
              />
            ) : null}
            <ol className="discover__blocks">
              {openPost.data.blocks.map((sb) => {
                const b = storedToTimeBlock(sb);
                return (
                  <li key={b.id} className="discover__block-row">
                    <span className="discover__block-ico" aria-hidden>
                      <ActivityIcon id={b.activityId} size={18} />
                    </span>
                    <div>
                      <p className="discover__block-label">{t(`act_${b.activityId}_label`)}</p>
                      <p className="discover__block-time">
                        {formatHm(b.startHour, b.startMinute)} –{" "}
                        {b.endHour === 24 && b.endMinute === 0
                          ? t("schedule_midnight")
                          : formatHm(b.endHour, b.endMinute)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      ) : null}
    </div>
  );
}
