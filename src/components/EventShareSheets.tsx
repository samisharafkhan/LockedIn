import { useCallback, useEffect, useState } from "react";
import { Check, Link2, Share2, UserPlus, X } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { useSchedule } from "../context/ScheduleContext";
import { getFirestoreDb } from "../lib/firebaseApp";
import {
  USER_DIRECTORY_COLLECTION,
  fetchUserByHandleExact,
  normalizeHandleKey,
} from "../lib/userDirectory";
import {
  buildShareId,
  fetchBlockShareRecipients,
  upsertBlockShare,
} from "../lib/blockShares";
import { createIncomingNotification } from "../lib/socialNotifications";
import { timeBlockToStored } from "../lib/storage";
import type { BlockSharePermission, TimeBlock } from "../types";
import { EventShareThread } from "./EventShareThread";

type ShareProps = {
  open: boolean;
  onClose: () => void;
  block: TimeBlock | null;
  dayKey: string;
};

type Collaborator = { recipientUid: string; handle: string; shareId: string };

export function BlockShareSheet({ open, onClose, block, dayKey }: ShareProps) {
  const { t, firebaseUser, followingIds, getFriend } = useSchedule();
  const [handleInput, setHandleInput] = useState("");
  const [permission, setPermission] = useState<BlockSharePermission>("comment");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [okHint, setOkHint] = useState<string | null>(null);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadCollaborators = useCallback(async () => {
    if (!firebaseUser || !block) return;
    const db = getFirestoreDb();
    const rows = await fetchBlockShareRecipients(firebaseUser.uid, dayKey, block.id);
    const enriched = await Promise.all(
      rows.map(async (r) => {
        const f = getFriend(r.recipientUid);
        if (f?.handle) return { recipientUid: r.recipientUid, handle: f.handle, shareId: r.shareId };
        if (!db) return { recipientUid: r.recipientUid, handle: r.recipientUid.slice(0, 8), shareId: r.shareId };
        const snap = await getDoc(doc(db, USER_DIRECTORY_COLLECTION, r.recipientUid));
        const h = snap.exists() ? String(snap.data().handle ?? "").trim() : "";
        return { recipientUid: r.recipientUid, handle: h || r.recipientUid.slice(0, 8), shareId: r.shareId };
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
      setCopiedId(null);
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
      await createIncomingNotification(db, {
        toUid: firebaseUser.uid,
        actorUid: firebaseUser.uid,
        type: "share_sent",
        message: `Sent "${t(`act_${block.activityId}_label`)}" to @${match.handle}`,
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

  const copyEventLink = (shareId: string) => {
    const url = `${window.location.origin}/s/${encodeURIComponent(shareId)}`;
    void navigator.clipboard.writeText(url).then(
      () => {
        setCopiedId(shareId);
        setTimeout(() => setCopiedId(null), 2000);
      },
      () => {
        setErr(t("err_generic"));
      },
    );
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
              <ul className="share-collab-list" role="list">
                {collaborators.map((c) => (
                  <li key={c.shareId} className="share-collab-list__row">
                    <span className="share-collab-list__name">@{c.handle}</span>
                    <button
                      type="button"
                      className="btn btn--outline btn--sm share-copy-link-btn"
                      onClick={() => copyEventLink(c.shareId)}
                      aria-label={t("share_copy_event_link_aria", { handle: c.handle })}
                    >
                      {copiedId === c.shareId ? <Check size={16} /> : <Link2 size={16} aria-hidden />}
                      {copiedId === c.shareId ? t("share_copied") : t("share_copy_event_link")}
                    </button>
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

type IncomingProps = { shareId: string; onClose: () => void };

export function IncomingShareSheet({ shareId, onClose }: IncomingProps) {
  const { t } = useSchedule();
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
          <EventShareThread shareId={shareId} onClose={onClose} />
        </div>
      </div>
    </div>
  );
}
