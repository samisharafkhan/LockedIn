import { useEffect, useMemo, useState } from "react";
import { useSchedule } from "../context/ScheduleContext";
import { fetchDirectoryUser } from "../lib/userDirectory";
import { getFirestoreDb } from "../lib/firebaseApp";

/**
 * Resolves @handle / displayName for comment `authorUid`s using friends list then userDirectory.
 */
export function useCommentAuthorLabels(authorUids: readonly string[]): Record<string, string> {
  const { getFriend } = useSchedule();
  const [labels, setLabels] = useState<Record<string, string>>({});
  const key = useMemo(() => [...new Set(authorUids.filter(Boolean))].sort().join(","), [authorUids]);

  useEffect(() => {
    if (!key) {
      setLabels({});
      return;
    }
    const uids = key.split(",");
    const db = getFirestoreDb();
    if (!db) {
      setLabels(
        Object.fromEntries(
          uids.map((uid) => {
            const f = getFriend(uid);
            return [uid, f?.handle ? `@${f.handle.trim()}` : uid.slice(0, 8)] as const;
          }),
        ),
      );
      return;
    }
    let cancel = false;
    (async () => {
      const m: Record<string, string> = {};
      for (const uid of uids) {
        const f = getFriend(uid);
        if (f?.handle) {
          m[uid] = `@${f.handle.trim()}`;
          continue;
        }
        const du = await fetchDirectoryUser(db, uid);
        if (du) {
          const h = du.handle?.trim();
          if (h) {
            m[uid] = `@${h}`;
            continue;
          }
          const dn = du.displayName?.trim();
          if (dn) {
            m[uid] = dn;
            continue;
          }
        }
        m[uid] = uid.slice(0, 8);
      }
      if (!cancel) setLabels(m);
    })();
    return () => {
      cancel = true;
    };
  }, [key, getFriend]);

  return labels;
}
