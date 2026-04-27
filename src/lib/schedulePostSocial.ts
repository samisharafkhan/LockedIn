import type { Firestore } from "firebase/firestore";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { SCHEDULE_POSTS_COLLECTION, type SchedulePostDoc } from "./schedulePosts";
import { createIncomingNotification, createMyActivity } from "./socialNotifications";

export type SchedulePostComment = {
  authorUid: string;
  text: string;
  createdAt?: unknown;
};

export async function toggleSchedulePostLike(
  db: Firestore,
  postId: string,
  ownerUid: string,
  uid: string,
  currentlyLiked: boolean,
) {
  const ref = doc(db, SCHEDULE_POSTS_COLLECTION, postId, "likes", uid);
  if (currentlyLiked) {
    await deleteDoc(ref);
  } else {
    await setDoc(ref, { actorUid: uid, ownerUid, postId, createdAt: serverTimestamp() });
    await Promise.all([
      createIncomingNotification(db, {
        toUid: ownerUid,
        actorUid: uid,
        type: "post_like",
        postId,
        source: "schedule_post",
      }),
      createMyActivity(db, uid, {
        type: "liked",
        source: "schedule_post",
        targetOwnerUid: ownerUid,
        postId,
      }),
    ]);
  }
}

export async function toggleSchedulePostSave(
  db: Firestore,
  postId: string,
  ownerUid: string,
  uid: string,
  currentlySaved: boolean,
) {
  const ref = doc(db, SCHEDULE_POSTS_COLLECTION, postId, "saves", uid);
  if (currentlySaved) {
    await deleteDoc(ref);
  } else {
    await setDoc(ref, { actorUid: uid, ownerUid, postId, createdAt: serverTimestamp() });
    await Promise.all([
      createIncomingNotification(db, {
        toUid: ownerUid,
        actorUid: uid,
        type: "post_save",
        postId,
        source: "schedule_post",
      }),
      createMyActivity(db, uid, {
        type: "saved",
        source: "schedule_post",
        targetOwnerUid: ownerUid,
        postId,
      }),
    ]);
  }
}

export async function addSchedulePostComment(
  db: Firestore,
  postId: string,
  ownerUid: string,
  uid: string,
  text: string,
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  await addDoc(collection(db, SCHEDULE_POSTS_COLLECTION, postId, "comments"), {
    authorUid: uid,
    ownerUid,
    postId,
    text: trimmed.slice(0, 2000),
    createdAt: serverTimestamp(),
  });
  await Promise.all([
    createIncomingNotification(db, {
      toUid: ownerUid,
      actorUid: uid,
      type: "post_comment",
      postId,
      source: "schedule_post",
      message: trimmed.slice(0, 140),
    }),
    createMyActivity(db, uid, {
      type: "commented",
      source: "schedule_post",
      targetOwnerUid: ownerUid,
      postId,
      message: trimmed.slice(0, 140),
    }),
  ]);
}

/** At most one pinned post per owner (within the latest 100 posts). */
export async function setSchedulePostPinned(
  db: Firestore,
  postId: string,
  ownerUid: string,
  pinned: boolean,
): Promise<void> {
  const postRef = doc(db, SCHEDULE_POSTS_COLLECTION, postId);
  if (!pinned) {
    await updateDoc(postRef, { pinned: false });
    return;
  }
  const q = query(
    collection(db, SCHEDULE_POSTS_COLLECTION),
    where("ownerUid", "==", ownerUid),
    limit(100),
  );
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.forEach((d) => {
    if (d.id === postId) return;
    const data = d.data() as SchedulePostDoc;
    if (data.pinned) batch.update(d.ref, { pinned: false });
  });
  batch.update(postRef, { pinned: true });
  await batch.commit();
}

export function subscribeSchedulePostSocial(
  db: Firestore,
  postId: string,
  viewerUid: string | null,
  onUpdate: (s: {
    likeCount: number;
    saveCount: number;
    commentCount: number;
    liked: boolean;
    saved: boolean;
    comments: { id: string; data: SchedulePostComment }[];
  }) => void,
): () => void {
  const unsubs: Array<() => void> = [];
  const state = {
    likeCount: 0,
    saveCount: 0,
    commentCount: 0,
    liked: false,
    saved: false,
    comments: [] as { id: string; data: SchedulePostComment }[],
  };

  const push = () => {
    onUpdate({
      likeCount: state.likeCount,
      saveCount: state.saveCount,
      commentCount: state.commentCount,
      liked: state.liked,
      saved: state.saved,
      comments: [...state.comments],
    });
  };

  unsubs.push(
    onSnapshot(collection(db, SCHEDULE_POSTS_COLLECTION, postId, "likes"), (snap) => {
      state.likeCount = snap.size;
      state.liked = viewerUid != null && snap.docs.some((d) => d.id === viewerUid);
      push();
    }),
  );
  unsubs.push(
    onSnapshot(collection(db, SCHEDULE_POSTS_COLLECTION, postId, "saves"), (snap) => {
      state.saveCount = snap.size;
      state.saved = viewerUid != null && snap.docs.some((d) => d.id === viewerUid);
      push();
    }),
  );
  unsubs.push(
    onSnapshot(
      query(collection(db, SCHEDULE_POSTS_COLLECTION, postId, "comments"), orderBy("createdAt", "asc"), limit(40)),
      (snap) => {
        state.commentCount = snap.size;
        state.comments = snap.docs.map((d) => ({ id: d.id, data: d.data() as SchedulePostComment }));
        push();
      },
      () => push(),
    ),
  );

  push();
  return () => unsubs.forEach((u) => u());
}
