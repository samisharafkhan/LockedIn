import type { Firestore } from "firebase/firestore";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { isoDate } from "./dates";
import { getFirestoreDb } from "./firebaseApp";
import type { ActivityId, Profile, TimeBlock } from "../types";

export const USER_DIRECTORY_COLLECTION = "userDirectory";

export type DirectoryUser = {
  uid: string;
  handle: string;
  displayName: string;
  avatarEmoji?: string;
};

export function normalizeHandleKey(handle: string): string {
  return handle
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9_]/g, "");
}

/** Fields merged into `userDirectory/{uid}` (add serverTimestamp in caller). */
export function userDirectoryWriteFields(uid: string, profile: Profile): Record<string, unknown> {
  return {
    uid,
    handle: profile.handle.trim(),
    displayName: profile.displayName.trim(),
    handleLower: normalizeHandleKey(profile.handle),
    displayNameLower: profile.displayName.trim().toLowerCase(),
    avatarEmoji: profile.avatarEmoji ?? "○",
  };
}

export async function searchDirectoryUsers(
  db: Firestore,
  raw: string,
  excludeUid: string,
): Promise<DirectoryUser[]> {
  const q = normalizeHandleKey(raw);
  if (q.length < 2) return [];

  const col = collection(db, USER_DIRECTORY_COLLECTION);
  const byHandle = query(
    col,
    where("handleLower", ">=", q),
    where("handleLower", "<=", `${q}\uf8ff`),
    limit(20),
  );
  const byName = query(
    col,
    where("displayNameLower", ">=", q),
    where("displayNameLower", "<=", `${q}\uf8ff`),
    limit(20),
  );

  const [snap1, snap2] = await Promise.all([getDocs(byHandle), getDocs(byName)]);
  const map = new Map<string, DirectoryUser>();

  for (const snap of [snap1, snap2]) {
    snap.forEach((d) => {
      const uid = d.id;
      if (uid === excludeUid) return;
      const x = d.data();
      map.set(uid, {
        uid,
        handle: String(x.handle ?? ""),
        displayName: String(x.displayName ?? ""),
        avatarEmoji: x.avatarEmoji != null ? String(x.avatarEmoji) : undefined,
      });
    });
  }

  return Array.from(map.values()).slice(0, 25);
}

function mapDocToTimeBlock(raw: unknown): TimeBlock | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  const id = b.id;
  if (typeof id !== "string") return null;
  return {
    id,
    startHour: Number(b.startHour),
    startMinute: Number(b.startMinute),
    endHour: Number(b.endHour),
    endMinute: Number(b.endMinute),
    activityId: b.activityId as ActivityId,
    ...(b.outcome === "done" || b.outcome === "not_done" ? { outcome: b.outcome } : {}),
  };
}

/** Today’s blocks for another user from their `userState` doc (requires Firestore read rules). */
export async function fetchUserTodayBlocks(uid: string): Promise<TimeBlock[]> {
  const db = getFirestoreDb();
  if (!db) return [];
  const snap = await getDoc(doc(db, "userState", uid));
  if (!snap.exists()) return [];
  const data = snap.data() as { blocksByDay?: Record<string, unknown[]> };
  const day = isoDate(new Date());
  const list = data.blocksByDay?.[day];
  if (!Array.isArray(list)) return [];
  return list.map(mapDocToTimeBlock).filter((x): x is TimeBlock => x != null);
}
