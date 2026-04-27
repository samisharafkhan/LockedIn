import { useEffect, useState } from "react";
import { useCommentAuthorLabels } from "../hooks/useCommentAuthorLabels";
import { useSchedule } from "../context/ScheduleContext";
import { ACTIVITIES } from "../data/activities";
import {
  addShareComment,
  setShareInviteStatus,
  subscribeBlockShare,
  subscribeShareComments,
  updateCollabBlock,
  type BlockShareComment,
  type BlockShareDoc,
} from "../lib/blockShares";
import { isValidRange } from "../lib/scheduleBlocks";
import type { StoredBlock } from "../lib/storage";
import {
  digitsPeriodToHour24,
  hour24ToDigitsAndPeriod,
  timeDigitsIssues,
  type AmPm,
} from "../lib/timeDigits";
import type { ActivityId, TimeBlock } from "../types";
import { ActivityIcon } from "./ActivityIcon";
import { TimeDigitPick } from "./TimeDigitPick";

function storedToTimeBlock(s: StoredBlock): TimeBlock {
  return {
    id: s.id,
    startHour: s.startHour,
    startMinute: s.startMinute,
    endHour: s.endHour,
    endMinute: s.endMinute,
    activityId: s.activityId as ActivityId,
    ...(s.outcome ? { outcome: s.outcome } : {}),
  };
}

type Props = {
  shareId: string;
  onClose: () => void;
  /** Compact scroll area when opened from the block editor. */
  embed?: boolean;
};

/** Shared event: permissions, optional collab edit, real-time comment thread. */
export function EventShareThread({ shareId, onClose, embed = false }: Props) {
  const { t, firebaseUser, mergeBlockIntoDay } = useSchedule();
  const [doc, setDoc] = useState<BlockShareDoc | null>(null);
  const [comments, setComments] = useState<BlockShareComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [activityId, setActivityId] = useState<ActivityId>("work");
  const [startDigits, setStartDigits] = useState("");
  const [startPeriod, setStartPeriod] = useState<AmPm>("AM");
  const [endDigits, setEndDigits] = useState("");
  const [endPeriod, setEndPeriod] = useState<AmPm>("PM");
  const [endMidnight, setEndMidnight] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteErr, setInviteErr] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "empty" | "ready">("loading");
  const authorLabels = useCommentAuthorLabels(comments.map((c) => c.authorUid));

  useEffect(() => {
    const unsubDoc = subscribeBlockShare(shareId, (d) => {
      setDoc(d);
      setLoadState(d ? "ready" : "empty");
    });
    const unsubComments = subscribeShareComments(shareId, setComments);
    return () => {
      unsubDoc();
      unsubComments();
    };
  }, [shareId]);

  useEffect(() => {
    if (!doc?.collabBlock) return;
    const b = storedToTimeBlock(doc.collabBlock);
    setActivityId(b.activityId);
    const s = hour24ToDigitsAndPeriod(b.startHour, b.startMinute);
    setStartDigits(s.digits);
    setStartPeriod(s.period);
    if (b.endHour === 24 && b.endMinute === 0) {
      setEndMidnight(true);
      setEndDigits("");
      setEndPeriod("PM");
    } else {
      setEndMidnight(false);
      const e = hour24ToDigitsAndPeriod(b.endHour, b.endMinute);
      setEndDigits(e.digits);
      setEndPeriod(e.period);
    }
  }, [doc?.collabBlock, doc?.updatedAt]);

  if (!firebaseUser) {
    return <p className="sheet__micro">{t("event_share_sign_in")}</p>;
  }
  if (loadState === "loading" || (loadState === "ready" && !doc)) {
    return <p className="sheet__lede">{t("common_loading")}</p>;
  }
  if (loadState === "empty" || !doc || !doc.ownerUid) {
    return <p className="sheet__error">{t("event_share_unavailable")}</p>;
  }

  const isRecipient = doc.recipientUid === firebaseUser.uid;
  const isOwner = doc.ownerUid === firebaseUser.uid;
  if (!isOwner && !isRecipient) {
    return <p className="sheet__error">{t("event_share_unavailable")}</p>;
  }

  const inviteStatus = doc.inviteStatus ?? "accepted";
  const needsInviteResponse = isRecipient && inviteStatus === "pending";
  const inviteResolvedForRecipient = !isRecipient || inviteStatus !== "pending";
  const canComment = inviteResolvedForRecipient && (isOwner || (isRecipient && doc.permission !== "view"));
  const canEdit = inviteResolvedForRecipient && doc.permission === "edit" && isRecipient;

  const pushComment = async () => {
    const text = commentText.trim();
    if (!text || !canComment) return;
    await addShareComment(shareId, firebaseUser.uid, text);
    setCommentText("");
  };

  const saveCollab = async () => {
    if (!canEdit || !doc) return;
    setEditErr(null);
    if (startDigits.length !== 4) {
      setEditErr(t("block_err_time_incomplete"));
      return;
    }
    const si = timeDigitsIssues(startDigits);
    if (si.hour || si.minute) {
      setEditErr(t("block_err_time_invalid"));
      return;
    }
    const s24 = digitsPeriodToHour24(startDigits, startPeriod);
    if (!s24) {
      setEditErr(t("block_err_time_invalid"));
      return;
    }
    let endHour: number;
    let endMinute: number;
    if (endMidnight) {
      endHour = 24;
      endMinute = 0;
    } else {
      if (endDigits.length !== 4) {
        setEditErr(t("block_err_time_incomplete"));
        return;
      }
      const ei = timeDigitsIssues(endDigits);
      if (ei.hour || ei.minute) {
        setEditErr(t("block_err_time_invalid"));
        return;
      }
      const e24 = digitsPeriodToHour24(endDigits, endPeriod);
      if (!e24) {
        setEditErr(t("block_err_time_invalid"));
        return;
      }
      endHour = e24.hour;
      endMinute = e24.minute;
    }
    if (!isValidRange(s24.hour, s24.minute, endHour, endMinute)) {
      setEditErr(t("block_err_range"));
      return;
    }
    const base = doc.collabBlock ?? doc.block;
    const next: StoredBlock = {
      ...base,
      activityId,
      startHour: s24.hour,
      startMinute: s24.minute,
      endHour,
      endMinute,
    };
    await updateCollabBlock(shareId, next);
  };

  const blockForPreview = doc.collabBlock ?? doc.block;
  const b = blockForPreview ? storedToTimeBlock(blockForPreview) : null;

  const acceptInvite = async () => {
    if (!doc?.block) return;
    setInviteErr(null);
    setInviteBusy(true);
    try {
      await setShareInviteStatus(shareId, "accepted");
      mergeBlockIntoDay(doc.dayKey, storedToTimeBlock(doc.block));
    } catch (e) {
      setInviteErr(e instanceof Error ? e.message : t("err_generic"));
    } finally {
      setInviteBusy(false);
    }
  };

  const declineInvite = async () => {
    setInviteErr(null);
    setInviteBusy(true);
    try {
      await setShareInviteStatus(shareId, "declined");
      onClose();
    } catch (e) {
      setInviteErr(e instanceof Error ? e.message : t("err_generic"));
    } finally {
      setInviteBusy(false);
    }
  };

  const body = (
    <>
      {needsInviteResponse ? (
        <div className="share-invite-actions">
          <p className="sheet__lede">{t("share_invite_lede")}</p>
          <div className="share-invite-actions__row">
            <button
              type="button"
              className="btn btn--primary"
              disabled={inviteBusy}
              onClick={() => void acceptInvite()}
            >
              {inviteBusy ? t("common_loading") : t("share_invite_accept")}
            </button>
            <button
              type="button"
              className="btn btn--outline"
              disabled={inviteBusy}
              onClick={() => void declineInvite()}
            >
              {t("share_invite_decline")}
            </button>
          </div>
          {inviteErr ? <p className="sheet__error">{inviteErr}</p> : null}
        </div>
      ) : null}
      {inviteResolvedForRecipient ? (
        <p className="sheet__micro">
          {t("share_permission_show", { perm: t(`share_perm_${doc.permission}`) })}
        </p>
      ) : null}
      {b ? (
        <div className="share-preview">
          <ActivityIcon id={b.activityId} size={28} />
          <p className="share-preview__label">{t(`act_${b.activityId}_label`)}</p>
        </div>
      ) : null}

      {inviteResolvedForRecipient && canEdit ? (
        <>
          <p className="sheet__section-label">{t("share_edit_collab")}</p>
          <div className="activity-pick activity-pick--compact" role="listbox">
            {ACTIVITIES.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`activity-pick__btn ${a.id === activityId ? "activity-pick__btn--on" : ""}`}
                onClick={() => setActivityId(a.id)}
              >
                <ActivityIcon id={a.id} size={20} />
                <span className="activity-pick__name">{t(`act_${a.id}_label`)}</span>
              </button>
            ))}
          </div>
          <p className="sheet__micro">{t("block_time_digits_hint")}</p>
          <div className="time-digit-grid">
            <TimeDigitPick
              label={t("block_starts")}
              digits={startDigits}
              period={startPeriod}
              onDigitsChange={setStartDigits}
              onPeriodChange={setStartPeriod}
            />
            <TimeDigitPick
              label={t("block_ends")}
              digits={endDigits}
              period={endPeriod}
              onDigitsChange={setEndDigits}
              onPeriodChange={setEndPeriod}
              disabled={endMidnight}
            />
          </div>
          <label className="time-digit-midnight">
            <input
              type="checkbox"
              checked={endMidnight}
              onChange={(e) => {
                setEndMidnight(e.target.checked);
                setEditErr(null);
              }}
            />
            <span>{t("block_ends_midnight")}</span>
          </label>
          {editErr ? <p className="sheet__error">{editErr}</p> : null}
          <button type="button" className="btn btn--outline btn--wide" onClick={() => void saveCollab()}>
            {t("share_apply_collab")}
          </button>
        </>
      ) : null}

      {inviteResolvedForRecipient ? (
        <>
          <p className="sheet__section-label">{t("share_comments")}</p>
          <ul className="share-comments">
            {comments.map((c) => (
              <li key={c.id} className="share-comments__row">
                <span className="share-comments__meta">
                  {c.authorUid === firebaseUser.uid
                    ? t("share_you")
                    : (authorLabels[c.authorUid] ?? c.authorUid.slice(0, 8))}
                  {" · "}
                </span>{" "}
                {c.text}
              </li>
            ))}
          </ul>
          {canComment ? (
            <div className="share-comment-form">
              <input
                className="field__input"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={t("share_comment_placeholder")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void pushComment();
                }}
              />
              <button type="button" className="btn btn--primary btn--sm" onClick={() => void pushComment()}>
                {t("share_comment_send")}
              </button>
            </div>
          ) : (
            <p className="sheet__micro">{t("share_comments_view_only")}</p>
          )}
        </>
      ) : null}
    </>
  );

  if (embed) {
    return <div className="event-share-thread event-share-thread--embed">{body}</div>;
  }
  return <div className="event-share-thread">{body}</div>;
}
