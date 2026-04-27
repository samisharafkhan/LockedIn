import type { DocumentData, Firestore } from "firebase/firestore";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import type { DirectoryUser } from "./userDirectory";
import type { StoredBlock } from "./storage";
import { getFirestoreDb } from "./firebaseApp";

export const SCHEDULE_POSTS_COLLECTION = "schedulePosts";

/** Prefer snapshot on the post, then public directory (avatar photo / animal from profile sync). */
export function mergeSchedulePostWithDirectory(
  post: SchedulePostDoc,
  dir: DirectoryUser | null,
): SchedulePostDoc {
  if (!dir) return post;
  return {
    ...post,
    displayName: (post.displayName || dir.displayName).trim() || "User",
    handle: (post.handle || dir.handle).trim() || "user",
    avatarEmoji: post.avatarEmoji ?? dir.avatarEmoji ?? "○",
    avatarImageDataUrl: post.avatarImageDataUrl ?? dir.avatarImageDataUrl ?? null,
    avatarAnimalId: post.avatarAnimalId ?? dir.avatarAnimalId ?? null,
  };
}

export type SchedulePostDoc = {
  ownerUid: string;
  dayKey: string;
  /** Snapshot of that day’s blocks at post time. */
  blocks: StoredBlock[];
  displayName: string;
  handle: string;
  avatarEmoji?: string;
  /** Copied from profile at post time so the feed can show the same avatar as the poster. */
  avatarImageDataUrl?: string | null;
  avatarAnimalId?: string | null;
  /** Owner-only: one pinned post shows a pin on profile (Instagram-style). */
  pinned?: boolean;
  createdAt?: unknown;
};

/** Firestore rejects `undefined` fields — strip for safe writes. */
function stripUndefinedDeep(x: unknown): unknown {
  if (Array.isArray(x)) {
    return x.map(stripUndefinedDeep);
  }
  if (x !== null && typeof x === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
      if (v === undefined) continue;
      o[k] = stripUndefinedDeep(v);
    }
    return o;
  }
  return x;
}

export async function createSchedulePost(
  db: Firestore,
  payload: Omit<SchedulePostDoc, "createdAt">,
): Promise<string> {
  const docData = {
    ...payload,
    displayName: (payload.displayName ?? "").trim() || "User",
    handle: (payload.handle ?? "").trim() || "user",
    avatarEmoji: payload.avatarEmoji ?? "○",
    avatarImageDataUrl: payload.avatarImageDataUrl ?? null,
    avatarAnimalId: payload.avatarAnimalId ?? null,
    pinned: payload.pinned === true,
    createdAt: serverTimestamp(),
  };
  const ref = await addDoc(
    collection(db, SCHEDULE_POSTS_COLLECTION),
    stripUndefinedDeep(docData) as DocumentData,
  );
  return ref.id;
}

export async function deleteSchedulePost(postId: string): Promise<void> {
  const db = getFirestoreDb();
  if (!db) throw new Error("Firestore not configured");
  await deleteDoc(doc(db, SCHEDULE_POSTS_COLLECTION, postId));
}

export function subscribeUserSchedulePosts(
  ownerUid: string,
  onList: (rows: { id: string; data: SchedulePostDoc }[]) => void,
): () => void {
  const db = getFirestoreDb();
  if (!db) {
    onList([]);
    return () => {};
  }
  const q = query(
    collection(db, SCHEDULE_POSTS_COLLECTION),
    where("ownerUid", "==", ownerUid),
    orderBy("createdAt", "desc"),
    limit(30),
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows: { id: string; data: SchedulePostDoc }[] = [];
      snap.forEach((d) => {
        const x = d.data() as SchedulePostDoc;
        rows.push({ id: d.id, data: x });
      });
      rows.sort((a, b) => {
        const ap = a.data.pinned ? 1 : 0;
        const bp = b.data.pinned ? 1 : 0;
        if (ap !== bp) return bp - ap;
        const ta =
          a.data.createdAt && typeof (a.data.createdAt as { toMillis?: () => number }).toMillis === "function"
            ? (a.data.createdAt as { toMillis: () => number }).toMillis()
            : 0;
        const tb =
          b.data.createdAt && typeof (b.data.createdAt as { toMillis?: () => number }).toMillis === "function"
            ? (b.data.createdAt as { toMillis: () => number }).toMillis()
            : 0;
        return tb - ta;
      });
      onList(rows);
    },
    (err) => {
      console.error("[LockedIn] subscribeUserSchedulePosts failed:", err);
      onList([]);
    },
  );
}

/** Recent schedule posts (global) — filter client-side, e.g. to people you follow. */
export function subscribeRecentSchedulePosts(
  limitN: number,
  onList: (rows: { id: string; data: SchedulePostDoc }[]) => void,
): () => void {
  const db = getFirestoreDb();
  if (!db) {
    onList([]);
    return () => {};
  }
  const q = query(
    collection(db, SCHEDULE_POSTS_COLLECTION),
    orderBy("createdAt", "desc"),
    limit(limitN),
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows: { id: string; data: SchedulePostDoc }[] = [];
      snap.forEach((d) => {
        rows.push({ id: d.id, data: d.data() as SchedulePostDoc });
      });
      onList(rows);
    },
    (err) => {
      console.error("[LockedIn] subscribeRecentSchedulePosts failed:", err);
      onList([]);
    },
  );
}
