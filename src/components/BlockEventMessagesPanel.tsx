import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { MessageCircle } from "lucide-react";
import { useSchedule } from "../context/ScheduleContext";
import { getFirestoreDb } from "../lib/firebaseApp";
import {
  fetchBlockShareRecipients,
  fetchRecipientShareIdForBlock,
  fetchShareMeta,
} from "../lib/blockShares";
import { USER_DIRECTORY_COLLECTION } from "../lib/userDirectory";
import { EventShareThread } from "./EventShareThread";

type Option = { shareId: string; label: string };

type Props = {
  dayKey: string;
  blockId: string;
};

/**
 * When a block is shared (outgoing or incoming), show the same Firestore thread here as on /s/:id.
 */
export function BlockEventMessagesPanel({ dayKey, blockId }: Props) {
  const { t, firebaseUser, getFriend } = useSchedule();
  const [opts, setOpts] = useState<Option[] | null>(null);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseUser) {
      setOpts(null);
      setActive(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const rid = await fetchRecipientShareIdForBlock(dayKey, blockId, firebaseUser.uid);
        if (cancelled) return;
        if (rid) {
          const meta = await fetchShareMeta(rid);
          let who = t("block_event_from_someone");
          if (meta) {
            const f = getFriend(meta.ownerUid);
            if (f?.handle) who = `@${f.handle}`;
            else {
              const db = getFirestoreDb();
              if (db) {
                const snap = await getDoc(doc(db, USER_DIRECTORY_COLLECTION, meta.ownerUid));
                const h = snap.exists() ? String(snap.data().handle ?? "").trim() : "";
                who = h ? `@${h}` : meta.ownerUid.slice(0, 8);
              }
            }
          }
          setOpts([{ shareId: rid, label: t("block_event_thread_with", { who }) }]);
          setActive(rid);
          return;
        }

        const rows = await fetchBlockShareRecipients(firebaseUser.uid, dayKey, blockId);
        if (cancelled) return;
        if (rows.length === 0) {
          setOpts([]);
          setActive(null);
          return;
        }
        const db = getFirestoreDb();
        const o: Option[] = [];
        for (const r of rows) {
          const f = getFriend(r.recipientUid);
          let h = f?.handle;
          if (!h && db) {
            const snap = await getDoc(doc(db, USER_DIRECTORY_COLLECTION, r.recipientUid));
            h = snap.exists() ? String(snap.data().handle ?? "").trim() : "";
          }
          const who = h ? `@${h}` : r.recipientUid.slice(0, 8);
          o.push({ shareId: r.shareId, label: t("block_event_thread_with", { who }) });
        }
        if (cancelled) return;
        setOpts(o);
        setActive((prev) => (prev && o.some((x) => x.shareId === prev) ? prev : o[0]!.shareId));
      } catch {
        if (!cancelled) {
          setOpts([]);
          setActive(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [blockId, dayKey, firebaseUser, getFriend]);

  if (!firebaseUser) return null;
  if (opts === null) {
    return (
      <div className="block-event-messages block-event-messages--loading" aria-hidden>
        <p className="sheet__micro">{t("common_loading")}</p>
      </div>
    );
  }
  if (opts.length === 0) return null;

  return (
    <div className="block-event-messages">
      <p className="sheet__section-label block-event-messages__head">
        <MessageCircle className="block-event-messages__icon" size={16} strokeWidth={2.25} aria-hidden />
        {t("block_event_messages")}
      </p>
      <p className="sheet__micro block-event-messages__sub">{t("block_event_messages_sub")}</p>
      {opts.length > 1 ? (
        <label className="field block-event-messages__picker">
          <span className="field__label">{t("block_event_conversation")}</span>
          <select className="field__input" value={active ?? ""} onChange={(e) => setActive(e.target.value)}>
            {opts.map((o) => (
              <option key={o.shareId} value={o.shareId}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {active ? <EventShareThread key={active} shareId={active} onClose={() => {}} embed /> : null}
    </div>
  );
}
