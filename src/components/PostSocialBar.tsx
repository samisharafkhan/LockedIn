import { useEffect, useState } from "react";
import { Bookmark, Heart, MessageCircle, Pin } from "lucide-react";
import { useSchedule } from "../context/ScheduleContext";
import { getFirestoreDb } from "../lib/firebaseApp";
import {
  addPublishedComment,
  subscribePublishedSocial,
  togglePublishedLike,
  togglePublishedSave,
} from "../lib/publishedScheduleSocial";
import {
  addSchedulePostComment,
  setSchedulePostPinned,
  subscribeSchedulePostSocial,
  toggleSchedulePostLike,
  toggleSchedulePostSave,
} from "../lib/schedulePostSocial";

type Props =
  | {
      variant: "schedulePost";
      postId: string;
      ownerUid: string;
      /** Owner-only: pin / unpin this post on profile. */
      showPinControl?: boolean;
      postPinned?: boolean;
    }
  | {
      variant: "published";
      publishedOwnerUid: string;
    };

const empty = {
  likeCount: 0,
  saveCount: 0,
  commentCount: 0,
  liked: false,
  saved: false,
  comments: [] as { id: string; data: { authorUid: string; text: string } }[],
};

export function PostSocialBar(props: Props & { className?: string }) {
  const { firebaseUser, t } = useSchedule();
  const [s, setS] = useState(empty);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const postKey = props.variant === "schedulePost" ? props.postId : "";
  const publishedKey = props.variant === "published" ? props.publishedOwnerUid : "";

  useEffect(() => {
    const db = getFirestoreDb();
    if (!db || !firebaseUser) {
      setS(empty);
      return;
    }
    if (props.variant === "schedulePost") {
      return subscribeSchedulePostSocial(db, props.postId, firebaseUser.uid, setS);
    }
    return subscribePublishedSocial(db, props.publishedOwnerUid, firebaseUser.uid, setS);
  }, [firebaseUser, props.variant, postKey, publishedKey]);

  if (!firebaseUser) {
    return (
      <p className={`friends__muted post-social-bar ${props.className ?? ""}`.trim()}>
        {t("social_need_signin")}
      </p>
    );
  }

  const onLike = async () => {
    const db = getFirestoreDb();
    if (!db) return;
    setBusy(true);
    try {
      if (props.variant === "schedulePost") {
        await toggleSchedulePostLike(db, props.postId, props.ownerUid, firebaseUser.uid, s.liked);
      } else {
        await togglePublishedLike(db, props.publishedOwnerUid, firebaseUser.uid, s.liked);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  const onSave = async () => {
    const db = getFirestoreDb();
    if (!db) return;
    setBusy(true);
    try {
      if (props.variant === "schedulePost") {
        await toggleSchedulePostSave(db, props.postId, props.ownerUid, firebaseUser.uid, s.saved);
      } else {
        await togglePublishedSave(db, props.publishedOwnerUid, firebaseUser.uid, s.saved);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  const onSendComment = async () => {
    const db = getFirestoreDb();
    if (!db || !draft.trim()) return;
    setBusy(true);
    try {
      if (props.variant === "schedulePost") {
        await addSchedulePostComment(db, props.postId, props.ownerUid, firebaseUser.uid, draft);
      } else {
        await addPublishedComment(db, props.publishedOwnerUid, firebaseUser.uid, draft);
      }
      setDraft("");
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  const onPin = async (pinned: boolean) => {
    const db = getFirestoreDb();
    if (!db || props.variant !== "schedulePost") return;
    setBusy(true);
    try {
      await setSchedulePostPinned(db, props.postId, props.ownerUid, pinned);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  const isOwner =
    props.variant === "schedulePost" && firebaseUser.uid === props.ownerUid && props.showPinControl;
  const pinned = props.variant === "schedulePost" && props.postPinned === true;

  return (
    <div
      className={`post-social-bar ${props.className ?? ""}`.trim()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      role="group"
      aria-label={t("social_bar_a11y")}
    >
      <div className="post-social-bar__row">
        <button
          type="button"
          className={`post-social-bar__btn ${s.liked ? "post-social-bar__btn--on" : ""}`}
          disabled={busy}
          onClick={() => void onLike()}
          aria-pressed={s.liked}
          aria-label={t("social_like")}
        >
          <Heart size={18} strokeWidth={2} fill={s.liked ? "currentColor" : "none"} className={s.liked ? "post-social-bar__heart--fill" : ""} />
          <span>{s.likeCount}</span>
        </button>
        <button
          type="button"
          className={`post-social-bar__btn ${s.saved ? "post-social-bar__btn--on" : ""}`}
          disabled={busy}
          onClick={() => void onSave()}
          aria-pressed={s.saved}
          aria-label={t("social_save")}
        >
          <Bookmark size={18} strokeWidth={2} />
          <span>{s.saveCount}</span>
        </button>
        <button
          type="button"
          className={`post-social-bar__btn ${commentsOpen ? "post-social-bar__btn--on" : ""}`}
          onClick={() => setCommentsOpen((v) => !v)}
          aria-expanded={commentsOpen}
          aria-label={t("social_comments")}
        >
          <MessageCircle size={18} strokeWidth={2} />
          <span>{s.commentCount}</span>
        </button>
        {isOwner ? (
          <button
            type="button"
            className={`post-social-bar__btn ${pinned ? "post-social-bar__btn--on" : ""}`}
            disabled={busy}
            onClick={() => void onPin(!pinned)}
            aria-pressed={pinned}
            aria-label={pinned ? t("social_unpin") : t("social_pin")}
          >
            <Pin size={18} strokeWidth={2} />
          </button>
        ) : null}
      </div>
      {commentsOpen ? (
        <div className="post-social-bar__comments">
          <ul className="post-social-bar__comment-list">
            {s.comments.map((c) => (
              <li key={c.id} className="post-social-bar__comment">
                <span className="post-social-bar__comment-author">@{c.data.authorUid.slice(0, 8)}…</span>
                <span className="post-social-bar__comment-text">{c.data.text}</span>
              </li>
            ))}
          </ul>
          <div className="post-social-bar__composer">
            <input
              className="post-social-bar__input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t("social_comment_placeholder")}
              maxLength={2000}
              aria-label={t("social_comment_placeholder")}
            />
            <button type="button" className="btn btn--sm btn--primary" disabled={busy} onClick={() => void onSendComment()}>
              {t("social_send")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
