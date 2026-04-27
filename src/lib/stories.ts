import {
  addDoc,
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
  type Firestore,
} from "firebase/firestore";
import { getFirestoreDb } from "./firebaseApp";

export const STORIES_COLLECTION = "stories";

export type StoryDoc = {
  ownerUid: string;
  mediaDataUrl: string;
  caption?: string;
  eventLabel?: string;
  dayKey?: string;
  createdAt?: unknown;
  /** Legacy client-only field; new docs use `expiresAt` (Timestamp). */
  expiresAtMs?: number;
  expiresAt?: Timestamp;
};

/** Resolves expiry from Firestore Timestamp or legacy milliseconds field. */
export function storyExpiresAtMs(data: StoryDoc): number {
  const ex = data.expiresAt;
  if (ex && typeof ex.toMillis === "function") return ex.toMillis();
  if (typeof data.expiresAtMs === "number") return data.expiresAtMs;
  return 0;
}

export type StoryReplyDoc = {
  authorUid: string;
  text: string;
  createdAt?: unknown;
};

export async function createStory(
  db: Firestore,
  payload: Omit<StoryDoc, "createdAt" | "expiresAt" | "expiresAtMs"> & { ttlHours?: number },
): Promise<void> {
  const ttl = Math.max(1, Math.min(48, payload.ttlHours ?? 24));
  const expiresAt = Timestamp.fromMillis(Date.now() + ttl * 60 * 60 * 1000);
  await addDoc(collection(db, STORIES_COLLECTION), {
    ownerUid: payload.ownerUid,
    mediaDataUrl: payload.mediaDataUrl,
    caption: payload.caption ?? "",
    eventLabel: payload.eventLabel ?? "",
    dayKey: payload.dayKey ?? "",
    expiresAt,
    createdAt: serverTimestamp(),
  });
}

export function subscribeRecentStories(
  onRows: (rows: { id: string; data: StoryDoc }[]) => void,
): () => void {
  const db = getFirestoreDb();
  if (!db) {
    onRows([]);
    return () => {};
  }
  const q = query(collection(db, STORIES_COLLECTION), orderBy("createdAt", "desc"), limit(250));
  return onSnapshot(
    q,
    (snap) => {
      const now = Date.now();
      const rows: { id: string; data: StoryDoc }[] = [];
      snap.forEach((d) => {
        const data = d.data() as StoryDoc;
        if (storyExpiresAtMs(data) <= now) return;
        rows.push({ id: d.id, data });
      });
      onRows(rows);
    },
    () => onRows([]),
  );
}

export function subscribeStoryReplies(
  storyId: string,
  onRows: (rows: { id: string; data: StoryReplyDoc }[]) => void,
): () => void {
  const db = getFirestoreDb();
  if (!db) {
    onRows([]);
    return () => {};
  }
  const q = query(collection(db, STORIES_COLLECTION, storyId, "replies"), orderBy("createdAt", "asc"), limit(200));
  return onSnapshot(
    q,
    (snap) => {
      const rows: { id: string; data: StoryReplyDoc }[] = [];
      snap.forEach((d) => rows.push({ id: d.id, data: d.data() as StoryReplyDoc }));
      onRows(rows);
    },
    () => onRows([]),
  );
}

/** One-shot check for a non-expired story (used e.g. from profile sheet). */
export async function hasActiveStoryForOwner(db: Firestore, ownerUid: string): Promise<boolean> {
  const now = Date.now();
  const q = query(collection(db, STORIES_COLLECTION), where("ownerUid", "==", ownerUid), limit(30));
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    if (storyExpiresAtMs(d.data() as StoryDoc) > now) return true;
  }
  return false;
}

export async function addStoryReply(storyId: string, authorUid: string, text: string): Promise<void> {
  const db = getFirestoreDb();
  if (!db) throw new Error("Firestore not configured");
  const trimmed = text.trim();
  if (!trimmed) return;
  await addDoc(collection(db, STORIES_COLLECTION, storyId, "replies"), {
    authorUid,
    text: trimmed,
    createdAt: serverTimestamp(),
  });
}
