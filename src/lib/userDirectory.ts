import type { Firestore } from "firebase/firestore";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { isoDate } from "./dates";
import { getFirestoreDb } from "./firebaseApp";
import { hasAcceptedFollow } from "./follows";
import type { ActivityId, Profile, TimeBlock } from "../types";
import type { StoredBlock } from "./storage";

export const USER_DIRECTORY_COLLECTION = "userDirectory";

export type DirectoryUser = {
  uid: string;
  handle: string;
  displayName: string;
  avatarEmoji?: string;
  /** Synced from profile for avatars in feed / cards (optional, can be large). */
  avatarImageDataUrl?: string | null;
  avatarAnimalId?: string | null;
  bio?: string;
  /** Private account (follow requests). */
  isPrivate?: boolean;
  /** @deprecated use isPrivate */
  accountPublic?: boolean;
};

export function directoryUserFromFirestoreData(uid: string, x: Record<string, unknown>): DirectoryUser {
  const isPrivate = x.isPrivate === true || x.accountPublic === false;
  const bioRaw = x.bio;
  const img = x.avatarImageDataUrl;
  const animal = x.avatarAnimalId;
  return {
    uid,
    handle: String(x.handle ?? ""),
    displayName: String(x.displayName ?? ""),
    avatarEmoji: x.avatarEmoji != null ? String(x.avatarEmoji) : undefined,
    avatarImageDataUrl: typeof img === "string" && img.length > 0 ? img : img === null ? null : undefined,
    avatarAnimalId: typeof animal === "string" && animal.length > 0 ? animal : animal === null ? null : undefined,
    bio: typeof bioRaw === "string" ? bioRaw.slice(0, 160) : undefined,
    isPrivate,
    accountPublic: !isPrivate,
  };
}

/** Full directory row for a single uid (profile preview, bios). */
export async function fetchDirectoryUser(db: Firestore, uid: string): Promise<DirectoryUser | null> {
  const snap = await getDoc(doc(db, USER_DIRECTORY_COLLECTION, uid));
  if (!snap.exists()) return null;
  return directoryUserFromFirestoreData(snap.id, snap.data() as Record<string, unknown>);
}

export function normalizeHandleKey(handle: string): string {
  return handle
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9_]/g, "");
}

/** Fields merged into `userDirectory/{uid}` (add serverTimestamp in caller). */
export function userDirectoryWriteFields(uid: string, profile: Profile): Record<string, unknown> {
  const priv = profile.isPrivate === true || profile.accountPublic === false;
  const pub = !priv;
  const out: Record<string, unknown> = {
    uid,
    handle: profile.handle.trim(),
    displayName: profile.displayName.trim(),
    handleLower: normalizeHandleKey(profile.handle),
    displayNameLower: profile.displayName.trim().toLowerCase(),
    avatarEmoji: profile.avatarEmoji ?? "○",
    isPrivate: priv,
    accountPublic: pub,
    publishTodayToDiscover: pub && profile.publishTodayToDiscover === true,
    bio: (profile.bio ?? "").trim().slice(0, 160),
  };
  if (profile.avatarImageDataUrl) {
    out.avatarImageDataUrl = profile.avatarImageDataUrl;
  } else {
    out.avatarImageDataUrl = null;
  }
  if (profile.avatarAnimalId) {
    out.avatarAnimalId = profile.avatarAnimalId;
  } else {
    out.avatarAnimalId = null;
  }
  return out;
}

/** Exact handle match (for sharing / invites). Requires `handleLower` on directory docs. */
export async function fetchUserByHandleExact(
  db: Firestore,
  handle: string,
  excludeUid: string,
): Promise<DirectoryUser | null> {
  const key = normalizeHandleKey(handle);
  if (key.length < 1) return null;
  const q = query(
    collection(db, USER_DIRECTORY_COLLECTION),
    where("handleLower", "==", key),
    limit(5),
  );
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    if (d.id === excludeUid) continue;
    return directoryUserFromFirestoreData(d.id, d.data() as Record<string, unknown>);
  }
  return null;
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
      map.set(uid, directoryUserFromFirestoreData(uid, d.data() as Record<string, unknown>));
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

/** Today’s blocks for another user from their `userState` doc (server rules enforce private access). */
export async function fetchUserTodayBlocks(ownerUid: string, viewerUid: string | null): Promise<TimeBlock[]> {
  const db = getFirestoreDb();
  if (!db) return [];

  const dirSnap = await getDoc(doc(db, USER_DIRECTORY_COLLECTION, ownerUid));
  if (dirSnap.exists()) {
    const d = dirSnap.data();
    const priv = d.isPrivate === true || d.accountPublic === false;
    if (priv && viewerUid !== null && viewerUid !== ownerUid) {
      const ok = await hasAcceptedFollow(db, viewerUid, ownerUid);
      if (!ok) return [];
    }
  }

  try {
    const snap = await getDoc(doc(db, "userState", ownerUid));
    if (!snap.exists()) return [];
    const data = snap.data() as { blocksByDay?: Record<string, unknown[]> };
    const day = isoDate(new Date());
    const list = data.blocksByDay?.[day];
    if (!Array.isArray(list)) return [];
    return list.map(mapDocToTimeBlock).filter((x): x is TimeBlock => x != null);
  } catch {
    return [];
  }
}

export type PublishedScheduleDoc = {
  ownerUid: string;
  dayKey: string;
  handle: string;
  displayName: string;
  avatarEmoji?: string;
  bio?: string;
  blocks: StoredBlock[];
};

export async function fetchPublishedSchedulesForDay(dayKey: string): Promise<PublishedScheduleDoc[]> {
  const db = getFirestoreDb();
  if (!db) return [];
  const q = query(
    collection(db, "publishedSchedules"),
    where("dayKey", "==", dayKey),
    limit(40),
  );
  const snap = await getDocs(q);
  const out: PublishedScheduleDoc[] = [];
  snap.forEach((d) => {
    const x = d.data();
    const bioRaw = x.bio;
    out.push({
      ownerUid: String(x.ownerUid ?? d.id),
      dayKey: String(x.dayKey ?? dayKey),
      handle: String(x.handle ?? ""),
      displayName: String(x.displayName ?? ""),
      avatarEmoji: x.avatarEmoji != null ? String(x.avatarEmoji) : undefined,
      bio: typeof bioRaw === "string" ? bioRaw.slice(0, 160) : undefined,
      blocks: Array.isArray(x.blocks) ? (x.blocks as PublishedScheduleDoc["blocks"]) : [],
    });
  });
  return out;
}
