import type { Firestore } from "firebase/firestore";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { getFirestoreDb } from "./firebaseApp";

export const FOLLOWS_COLLECTION = "follows";

export type FollowStatus = "pending" | "accepted";

export type FollowDoc = {
  followerUid: string;
  followingUid: string;
  status: FollowStatus;
  createdAt?: unknown;
};

/** Document id: `{followerUid}_{followingUid}` (Firebase UIDs are safe in paths). */
export function buildFollowDocId(followerUid: string, followingUid: string): string {
  return `${followerUid}_${followingUid}`;
}

export async function getFollowEdge(
  db: Firestore,
  followerUid: string,
  followingUid: string,
): Promise<FollowDoc | null> {
  const snap = await getDoc(doc(db, FOLLOWS_COLLECTION, buildFollowDocId(followerUid, followingUid)));
  if (!snap.exists()) return null;
  return snap.data() as FollowDoc;
}

/** Server read — avoids stale cache causing a mistaken create (setDoc → denied update). */
export async function getFollowEdgeFromServer(
  db: Firestore,
  followerUid: string,
  followingUid: string,
): Promise<FollowDoc | null> {
  const snap = await getDocFromServer(doc(db, FOLLOWS_COLLECTION, buildFollowDocId(followerUid, followingUid)));
  if (!snap.exists()) return null;
  return snap.data() as FollowDoc;
}

/** Whether `viewer` has an accepted follow relationship toward `target` (viewer follows target). */
export async function hasAcceptedFollow(
  db: Firestore,
  viewerUid: string,
  targetUid: string,
): Promise<boolean> {
  if (viewerUid === targetUid) return true;
  const edge = await getFollowEdge(db, viewerUid, targetUid);
  return edge?.status === "accepted";
}

export type MyFollowLists = {
  acceptedFollowingIds: string[];
  acceptedFollowerIds: string[];
  pendingOutgoingIds: string[];
  pendingIncoming: { followerUid: string }[];
};

/** Live subscription for all follow edges involving the current user as follower or followee. */
export function subscribeMyFollowLists(myUid: string, onData: (d: MyFollowLists) => void): () => void {
  const db = getFirestoreDb();
  if (!db) {
    onData({ acceptedFollowingIds: [], acceptedFollowerIds: [], pendingOutgoingIds: [], pendingIncoming: [] });
    return () => {};
  }

  let acceptedFollowingIds: string[] = [];
  let acceptedFollowerIds: string[] = [];
  let pendingOutgoingIds: string[] = [];
  let pendingIncoming: { followerUid: string }[] = [];

  const emit = () =>
    onData({
      acceptedFollowingIds: [...acceptedFollowingIds],
      acceptedFollowerIds: [...acceptedFollowerIds],
      pendingOutgoingIds: [...pendingOutgoingIds],
      pendingIncoming: [...pendingIncoming],
    });

  const qAccepted = query(
    collection(db, FOLLOWS_COLLECTION),
    where("followerUid", "==", myUid),
    where("status", "==", "accepted"),
  );
  const qOutPending = query(
    collection(db, FOLLOWS_COLLECTION),
    where("followerUid", "==", myUid),
    where("status", "==", "pending"),
  );
  const qFollowers = query(
    collection(db, FOLLOWS_COLLECTION),
    where("followingUid", "==", myUid),
    where("status", "==", "accepted"),
  );
  const qInPending = query(
    collection(db, FOLLOWS_COLLECTION),
    where("followingUid", "==", myUid),
    where("status", "==", "pending"),
  );

  const unsub1 = onSnapshot(
    qAccepted,
    (snap) => {
      acceptedFollowingIds = snap.docs.map((d) => String((d.data() as FollowDoc).followingUid ?? ""));
      emit();
    },
    (err) => {
      console.error("[LockedIn] follows accepted query failed:", err);
      emit();
    },
  );
  const unsub2 = onSnapshot(
    qOutPending,
    (snap) => {
      pendingOutgoingIds = snap.docs.map((d) => String((d.data() as FollowDoc).followingUid ?? ""));
      emit();
    },
    (err) => {
      console.error("[LockedIn] follows outgoing pending query failed:", err);
      emit();
    },
  );
  const unsub3 = onSnapshot(
    qFollowers,
    (snap) => {
      acceptedFollowerIds = snap.docs.map((d) => String((d.data() as FollowDoc).followerUid ?? ""));
      emit();
    },
    (err) => {
      console.error("[LockedIn] follows followers query failed:", err);
      emit();
    },
  );
  const unsub4 = onSnapshot(
    qInPending,
    (snap) => {
      pendingIncoming = snap.docs.map((d) => ({
        followerUid: String((d.data() as FollowDoc).followerUid ?? ""),
      }));
      emit();
    },
    (err) => {
      console.error("[LockedIn] follows incoming pending query failed:", err);
      emit();
    },
  );

  return () => {
    unsub1();
    unsub2();
    unsub3();
    unsub4();
  };
}

export async function requestOrAcceptFollow(
  db: Firestore,
  followerUid: string,
  followingUid: string,
  targetIsPrivate: boolean,
): Promise<void> {
  if (followerUid === followingUid) return;
  const id = buildFollowDocId(followerUid, followingUid);
  const status: FollowStatus = targetIsPrivate ? "pending" : "accepted";
  await setDoc(doc(db, FOLLOWS_COLLECTION, id), {
    followerUid,
    followingUid,
    status,
    createdAt: serverTimestamp(),
  });
}

export async function unfollowOrCancel(db: Firestore, followerUid: string, followingUid: string): Promise<void> {
  await deleteDoc(doc(db, FOLLOWS_COLLECTION, buildFollowDocId(followerUid, followingUid)));
}

export async function acceptFollowRequest(
  db: Firestore,
  followingUid: string,
  followerUid: string,
): Promise<void> {
  const id = buildFollowDocId(followerUid, followingUid);
  await updateDoc(doc(db, FOLLOWS_COLLECTION, id), {
    status: "accepted",
    updatedAt: serverTimestamp(),
  });
}

export async function rejectFollowRequest(
  db: Firestore,
  followingUid: string,
  followerUid: string,
): Promise<void> {
  await deleteDoc(doc(db, FOLLOWS_COLLECTION, buildFollowDocId(followerUid, followingUid)));
}
