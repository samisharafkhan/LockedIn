import { useEffect, useState } from "react";
import { UserPlus, X } from "lucide-react";
import { useSchedule } from "../context/ScheduleContext";
import { ActivityIcon } from "./ActivityIcon";
import { AvatarDisplay } from "./AvatarDisplay";
import { getFirestoreDb } from "../lib/firebaseApp";
import { fetchDirectoryUser, fetchUserTodayBlocks, type DirectoryUser } from "../lib/userDirectory";
import { formatHm } from "../lib/time";
import type { TimeBlock } from "../types";

type Preview = {
  displayName: string;
  handle: string;
  avatarEmoji?: string;
  bio?: string;
  /** From directory search — used for instant Follow / Request button feedback. */
  isPrivate?: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  targetUid: string | null;
  preview?: Preview | null;
};

export function UserPublicProfileSheet({ open, onClose, targetUid, preview }: Props) {
  const {
    t,
    firebaseUser,
    isFollowing,
    hasPendingFollowRequest,
    toggleFollow,
    seedDirectoryUser,
  } = useSchedule();
  const [dir, setDir] = useState<DirectoryUser | null>(null);
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [busy, setBusy] = useState(false);
  const [scheduleLocked, setScheduleLocked] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [followError, setFollowError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !targetUid || !firebaseUser) {
      setDir(null);
      setBlocks([]);
      setScheduleLocked(false);
      return;
    }
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
        const locked = priv && !isSelf && !following;
        setScheduleLocked(locked);
        const list = locked ? [] : await fetchUserTodayBlocks(targetUid, viewer);
        if (!cancelled) setBlocks(list);
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, targetUid, firebaseUser, isFollowing]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !targetUid) return null;

  const displayName = dir?.displayName ?? preview?.displayName ?? "…";
  const handle = dir?.handle ?? preview?.handle ?? "";
  const emoji = dir?.avatarEmoji ?? preview?.avatarEmoji ?? "○";
  const bioText = (dir?.bio ?? preview?.bio ?? "").trim();
  const isSelf = firebaseUser?.uid === targetUid;
  const following = isFollowing(targetUid);
  const pending = hasPendingFollowRequest(targetUid);

  const followAction = async () => {
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
    const fromDir =
      dir != null ? dir.isPrivate === true || dir.accountPublic === false : undefined;
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

  return (
    <div className="sheet sheet--fullscreen" role="dialog" aria-modal="true" aria-labelledby="public-profile-title">
      <button type="button" className="sheet__backdrop" aria-label={t("block_close")} onClick={onClose} />
      <div className="sheet__panel sheet__panel--profile-preview">
        <div className="sheet__head">
          <div className="sheet__top">
            <h2 id="public-profile-title" className="sheet__title">
              {t("discover_profile_title")}
            </h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label={t("block_close")}>
              <X size={22} strokeWidth={2} />
            </button>
          </div>
        </div>
        <div className="sheet__body">
          <div className="profile-preview__hero">
            <div className="profile-preview__avatar" aria-hidden>
              <AvatarDisplay
                source={{ avatarEmoji: emoji, avatarImageDataUrl: null, avatarAnimalId: null }}
                size="lg"
              />
            </div>
            <div>
              <p className="profile-preview__name">{displayName}</p>
              <p className="profile-preview__handle">@{handle}</p>
              {dir?.isPrivate === true || dir?.accountPublic === false ? (
                <p className="profile-preview__badge">{t("friends_directory_private")}</p>
              ) : null}
            </div>
          </div>

          {bioText ? <p className="profile-preview__bio">{bioText}</p> : null}

          {!isSelf && firebaseUser ? (
            <div className="profile-preview__actions">
              <button
                type="button"
                className={`btn btn--wide ${following || pending ? "btn--outline" : "btn--primary"} ${followBusy ? "btn--busy" : ""}`}
                onClick={() => void followAction()}
                disabled={followBusy}
              >
                {following ? (
                  <>{t("friends_following_btn")}</>
                ) : pending ? (
                  <>{t("friends_requested")}</>
                ) : dir?.isPrivate === true || dir?.accountPublic === false ? (
                  <>
                    <UserPlus size={18} strokeWidth={2} aria-hidden /> {t("friends_request_follow")}
                  </>
                ) : (
                  <>
                    <UserPlus size={18} strokeWidth={2} aria-hidden /> {t("friends_follow")}
                  </>
                )}
              </button>
              {followError ? <p className="friends__muted" style={{ color: "var(--danger)", marginTop: 8 }}>{followError}</p> : null}
            </div>
          ) : null}

          <p className="sheet__section-label">{t("discover_today_schedule")}</p>
          {busy ? (
            <p className="friends__muted">{t("discover_loading")}</p>
          ) : scheduleLocked ? (
            <p className="friends__muted">{t("discover_profile_locked")}</p>
          ) : blocks.length === 0 ? (
            <p className="friends__muted">{t("discover_no_blocks_today")}</p>
          ) : (
            <ol className="discover__blocks">
              {blocks.map((b) => (
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
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
