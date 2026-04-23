import { useCallback, useEffect, useState } from "react";
import { Share2, UserPlus, X } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { useSchedule } from "../context/ScheduleContext";
import { ACTIVITIES } from "../data/activities";
import { getFirestoreDb } from "../lib/firebaseApp";
import {
  USER_DIRECTORY_COLLECTION,
  fetchUserByHandleExact,
  normalizeHandleKey,
} from "../lib/userDirectory";
import {
  addShareComment,
  buildShareId,
  fetchBlockShareRecipients,
  setShareInviteStatus,
  subscribeBlockShare,
  subscribeShareComments,
  updateCollabBlock,
  upsertBlockShare,
  type BlockShareComment,
  type BlockShareDoc,
} from "../lib/blockShares";
import { timeBlockToStored, type StoredBlock } from "../lib/storage";
import { isValidRange } from "../lib/scheduleBlocks";
import {
  digitsPeriodToHour24,
  hour24ToDigitsAndPeriod,
  timeDigitsIssues,
  type AmPm,
} from "../lib/timeDigits";
import type { ActivityId, BlockSharePermission, TimeBlock } from "../types";
import { ActivityIcon } from "./ActivityIcon";
import { TimeDigitPick } from "./TimeDigitPick";

type ShareProps = {
  open: boolean;
  onClose: () => void;
  block: TimeBlock | null;
  dayKey: string;
};

export function BlockShareSheet({ open, onClose, block, dayKey }: ShareProps) {
  const { t, firebaseUser, followingIds, getFriend } = useSchedule();
  const [handleInput, setHandleInput] = useState("");
  const [permission, setPermission] = useState<BlockSharePermission>("comment");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [okHint, setOkHint] = useState<string | null>(null);
  const [collaborators, setCollaborators] = useState<{ recipientUid: string; handle: string }[]>([]);

  const loadCollaborators = useCallback(async () => {
    if (!firebaseUser || !block) return;
    const db = getFirestoreDb();
    const rows = await fetchBlockShareRecipients(firebaseUser.uid, dayKey, block.id);
    const enriched = await Promise.all(
      rows.map(async (r) => {
        const f = getFriend(r.recipientUid);
        if (f?.handle) return { recipientUid: r.recipientUid, handle: f.handle };
        if (!db) return { recipientUid: r.recipientUid, handle: r.recipientUid.slice(0, 8) };
        const snap = await getDoc(doc(db, USER_DIRECTORY_COLLECTION, r.recipientUid));
        const h = snap.exists() ? String(snap.data().handle ?? "").trim() : "";
        return { recipientUid: r.recipientUid, handle: h || r.recipientUid.slice(0, 8) };
      }),
    );
    setCollaborators(enriched);
  }, [block, dayKey, firebaseUser, getFriend]);

  useEffect(() => {
    if (open) {
      setHandleInput("");
      setPermission("comment");
      setErr(null);
      setOkHint(null);
      void loadCollaborators();
    }
  }, [open, loadCollaborators]);

  if (!open || !block || !firebaseUser) return null;

  const addCollaborator = async () => {
    setErr(null);
    setOkHint(null);
    const raw = handleInput.trim().replace(/^@/, "");
    if (!raw) {
      setErr(t("share_err_handle"));
      return;
    }
    if (normalizeHandleKey(raw).length < 2) {
      setErr(t("share_err_handle_short"));
      return;
    }
    const db = getFirestoreDb();
    if (!db) {
      setErr(t("share_err_firebase"));
      return;
    }
    setBusy(true);
    try {
      const match = await fetchUserByHandleExact(db, raw, firebaseUser.uid);
      if (!match) {
        setErr(t("share_err_user_not_found"));
        return;
      }
      if (match.uid === firebaseUser.uid) {
        setErr(t("share_err_self"));
        return;
      }
      const shareId = buildShareId(firebaseUser.uid, dayKey, block.id, match.uid);
      const stored = timeBlockToStored(block);
      await upsertBlockShare(db, shareId, {
        ownerUid: firebaseUser.uid,
        recipientUid: match.uid,
        blockId: block.id,
        dayKey,
        block: stored,
        permission,
      });
      setOkHint(t("share_added", { handle: match.handle }));
      setHandleInput("");
      await loadCollaborators();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("err_generic"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sheet sheet--nested" role="dialog" aria-modal="true" aria-labelledby="share-title">
      <button type="button" className="sheet__backdrop" aria-label={t("block_close")} onClick={onClose} />
      <div className="sheet__panel sheet__panel--compact">
        <div className="sheet__head">
          <div className="sheet__top">
            <h2 id="share-title" className="sheet__title sheet__title--with-icon">
              <Share2 size={22} strokeWidth={2} className="sheet__title-icon" aria-hidden />
              {t("share_title")}
            </h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label={t("block_close")}>
              <X size={22} strokeWidth={2} />
            </button>
          </div>
        </div>
        <div className="sheet__body">
          <p className="sheet__lede">{t("share_subtitle_google")}</p>

          {collaborators.length > 0 ? (
            <div className="share-collab-section">
              <p className="sheet__section-label">{t("share_people_with_access")}</p>
              <ul className="share-collab-chips" role="list">
                {collaborators.map((c) => (
                  <li key={c.recipientUid} className="share-collab-chip">
                    @{c.handle}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="sheet__section-label">{t("share_add_people")}</p>
          <div className="share-add-row">
            <label className="field share-add-field">
              <span className="field__label visually-hidden">{t("share_recipient_handle")}</span>
              <input
                className="field__input"
                value={handleInput}
                onChange={(e) => setHandleInput(e.target.value)}
                placeholder={t("share_placeholder_handle")}
                autoComplete="off"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void addCollaborator();
                  }
                }}
              />
            </label>
            <button
              type="button"
              className="btn btn--primary share-add-btn"
              disabled={busy}
              onClick={() => void addCollaborator()}
            >
              <UserPlus size={18} strokeWidth={2} aria-hidden />
              {busy ? t("common_loading") : t("share_add")}
            </button>
          </div>
          <p className="sheet__micro">{t("share_following_hint")}</p>
          {followingIds.length ? (
            <ul className="share-quick-pick" role="list">
              {followingIds.slice(0, 8).map((id) => {
                const f = getFriend(id);
                if (!f) return null;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      className="share-quick-pick__btn"
                      onClick={() => setHandleInput(f.handle)}
                    >
                      @{f.handle}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
          <label className="field">
            <span className="field__label">{t("share_permission_label")}</span>
            <select
              className="field__input"
              value={permission}
              onChange={(e) => setPermission(e.target.value as BlockSharePermission)}
            >
              <option value="view">{t("share_perm_view")}</option>
              <option value="comment">{t("share_perm_comment")}</option>
              <option value="edit">{t("share_perm_edit")}</option>
            </select>
          </label>
          {okHint ? <p className="sheet__ok">{okHint}</p> : null}
          {err ? <p className="sheet__error">{err}</p> : null}
        </div>
        <div className="sheet__footer">
          <button type="button" className="btn btn--outline btn--wide" onClick={onClose}>
            {t("share_done")}
          </button>
        </div>
      </div>
    </div>
  );
}

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

type IncomingProps = { shareId: string; onClose: () => void };

export function IncomingShareSheet({ shareId, onClose }: IncomingProps) {
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

  useEffect(() => {
    const unsubDoc = subscribeBlockShare(shareId, setDoc);
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

  if (!firebaseUser || !doc) return null;

  const isRecipient = doc.recipientUid === firebaseUser.uid;
  const isOwner = doc.ownerUid === firebaseUser.uid;
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
    const next: StoredBlock = {
      ...doc.collabBlock,
      activityId,
      startHour: s24.hour,
      startMinute: s24.minute,
      endHour,
      endMinute,
    };
    await updateCollabBlock(shareId, next);
  };

  const b = doc.collabBlock ? storedToTimeBlock(doc.collabBlock) : null;

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

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="incoming-share-title">
      <button type="button" className="sheet__backdrop" aria-label={t("block_close")} onClick={onClose} />
      <div className="sheet__panel">
        <div className="sheet__head">
          <div className="sheet__top">
            <h2 id="incoming-share-title" className="sheet__title">
              {t("share_incoming_title")}
            </h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label={t("block_close")}>
              <X size={22} strokeWidth={2} />
            </button>
          </div>
        </div>
        <div className="sheet__body">
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
                      {c.authorUid === firebaseUser.uid ? t("share_you") : c.authorUid.slice(0, 8)} ·
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
        </div>
      </div>
    </div>
  );
}
