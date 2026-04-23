import type { Firestore } from "firebase/firestore";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import type { BlockSharePermission } from "../types";
import type { StoredBlock } from "./storage";
import { getFirestoreDb } from "./firebaseApp";

export const BLOCK_SHARES_COLLECTION = "blockShares";

export type ShareInviteStatus = "pending" | "accepted" | "declined";

export type BlockShareDoc = {
  ownerUid: string;
  recipientUid: string;
  blockId: string;
  dayKey: string;
  block: StoredBlock;
  collabBlock: StoredBlock;
  permission: BlockSharePermission;
  /** Missing on older docs — treated as accepted (immediate collab). New shares default to pending. */
  inviteStatus?: ShareInviteStatus;
  updatedAt?: unknown;
};

export type BlockShareComment = {
  id: string;
  authorUid: string;
  text: string;
  createdAt?: unknown;
};

/** One Firestore doc per recipient so multiple collaborators can share the same block. */
export function buildShareId(
  ownerUid: string,
  dayKey: string,
  blockId: string,
  recipientUid: string,
): string {
  const raw = `${ownerUid}_${dayKey}_${blockId}_${recipientUid}`.replace(/[^a-zA-Z0-9_-]/g, "_");
  return raw.length > 800 ? raw.slice(0, 800) : raw;
}

export async function fetchBlockShareRecipients(
  ownerUid: string,
  dayKey: string,
  blockId: string,
): Promise<{ shareId: string; recipientUid: string }[]> {
  const db = getFirestoreDb();
  if (!db) return [];
  const q = query(
    collection(db, BLOCK_SHARES_COLLECTION),
    where("ownerUid", "==", ownerUid),
    limit(100),
  );
  const snap = await getDocs(q);
  const out: { shareId: string; recipientUid: string }[] = [];
  snap.forEach((d) => {
    const x = d.data() as BlockShareDoc;
    if (x.dayKey === dayKey && x.blockId === blockId) {
      out.push({ shareId: d.id, recipientUid: x.recipientUid });
    }
  });
  return out;
}

export async function upsertBlockShare(
  db: Firestore,
  shareId: string,
  payload: Omit<BlockShareDoc, "updatedAt" | "collabBlock" | "inviteStatus"> & {
    collabBlock?: StoredBlock;
  },
): Promise<void> {
  const collab = payload.collabBlock ?? payload.block;
  const ref = doc(db, BLOCK_SHARES_COLLECTION, shareId);
  const snap = await getDoc(ref);
  const next: Record<string, unknown> = {
    ...payload,
    collabBlock: collab,
    updatedAt: serverTimestamp(),
  };
  if (!snap.exists()) {
    next.inviteStatus = "pending";
  } else {
    const prev = snap.data() as BlockShareDoc;
    if (prev.inviteStatus === "declined") {
      next.inviteStatus = "pending";
    }
  }
  await setDoc(ref, next, { merge: true });
}

export async function setShareInviteStatus(shareId: string, status: ShareInviteStatus): Promise<void> {
  const db = getFirestoreDb();
  if (!db) throw new Error("Firestore not configured");
  await updateDoc(doc(db, BLOCK_SHARES_COLLECTION, shareId), {
    inviteStatus: status,
    updatedAt: serverTimestamp(),
  });
}

export function subscribeBlockShare(
  shareId: string,
  onData: (data: BlockShareDoc | null) => void,
): () => void {
  const db = getFirestoreDb();
  if (!db) {
    onData(null);
    return () => {};
  }
  return onSnapshot(
    doc(db, BLOCK_SHARES_COLLECTION, shareId),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      const x = snap.data() as BlockShareDoc;
      onData(x);
    },
    () => onData(null),
  );
}

export function subscribeShareComments(
  shareId: string,
  onList: (rows: BlockShareComment[]) => void,
): () => void {
  const db = getFirestoreDb();
  if (!db) {
    onList([]);
    return () => {};
  }
  const q = query(
    collection(db, BLOCK_SHARES_COLLECTION, shareId, "comments"),
    orderBy("createdAt", "asc"),
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows: BlockShareComment[] = [];
      snap.forEach((d) => {
        const c = d.data();
        rows.push({
          id: d.id,
          authorUid: String(c.authorUid ?? ""),
          text: String(c.text ?? ""),
          createdAt: c.createdAt,
        });
      });
      onList(rows);
    },
    () => onList([]),
  );
}

export async function addShareComment(shareId: string, authorUid: string, text: string): Promise<void> {
  const db = getFirestoreDb();
  if (!db) throw new Error("Firestore not configured");
  await addDoc(collection(db, BLOCK_SHARES_COLLECTION, shareId, "comments"), {
    authorUid,
    text: text.trim(),
    createdAt: serverTimestamp(),
  });
}

export async function updateCollabBlock(shareId: string, collabBlock: StoredBlock): Promise<void> {
  const db = getFirestoreDb();
  if (!db) throw new Error("Firestore not configured");
  await updateDoc(doc(db, BLOCK_SHARES_COLLECTION, shareId), {
    collabBlock,
    updatedAt: serverTimestamp(),
  });
}

export function subscribeOwnerBlockShares(
  ownerUid: string,
  onList: (docs: BlockShareDoc[]) => void,
): () => void {
  const db = getFirestoreDb();
  if (!db) {
    onList([]);
    return () => {};
  }
  const q = query(
    collection(db, BLOCK_SHARES_COLLECTION),
    where("ownerUid", "==", ownerUid),
    limit(100),
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: BlockShareDoc[] = [];
      snap.forEach((d) => list.push(d.data() as BlockShareDoc));
      onList(list);
    },
    () => onList([]),
  );
}

export function subscribeIncomingShares(recipientUid: string, onList: (ids: string[]) => void): () => void {
  const db = getFirestoreDb();
  if (!db) {
    onList([]);
    return () => {};
  }
  const q = query(
    collection(db, BLOCK_SHARES_COLLECTION),
    where("recipientUid", "==", recipientUid),
    limit(40),
  );
  return onSnapshot(
    q,
    (snap) => {
      const ids = snap.docs
        .filter((d) => {
          const x = d.data() as BlockShareDoc;
          return (x.inviteStatus ?? "accepted") === "pending";
        })
        .map((d) => d.id);
      onList(ids);
    },
    () => onList([]),
  );
}

export async function fetchShareMeta(shareId: string): Promise<BlockShareDoc | null> {
  const db = getFirestoreDb();
  if (!db) return null;
  const snap = await getDoc(doc(db, BLOCK_SHARES_COLLECTION, shareId));
  if (!snap.exists()) return null;
  return snap.data() as BlockShareDoc;
}
