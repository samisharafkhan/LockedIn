import type { Firestore } from "firebase/firestore";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  limit,
} from "firebase/firestore";
import { createIncomingNotification, createMyActivity } from "./socialNotifications";

const PUB = "publishedSchedules";

export type PublishedComment = {
  authorUid: string;
  text: string;
  createdAt?: unknown;
};

export async function togglePublishedLike(db: Firestore, ownerUid: string, viewerUid: string, currentlyLiked: boolean) {
  const ref = doc(db, PUB, ownerUid, "likes", viewerUid);
  if (currentlyLiked) {
    await deleteDoc(ref);
  } else {
    await setDoc(ref, { actorUid: viewerUid, ownerUid, createdAt: serverTimestamp() });
    await Promise.all([
      createIncomingNotification(db, {
        toUid: ownerUid,
        actorUid: viewerUid,
        type: "post_like",
        source: "published",
      }),
      createMyActivity(db, viewerUid, {
        type: "liked",
        source: "published",
        targetOwnerUid: ownerUid,
      }),
    ]);
  }
}

export async function togglePublishedSave(db: Firestore, ownerUid: string, viewerUid: string, currentlySaved: boolean) {
  const ref = doc(db, PUB, ownerUid, "saves", viewerUid);
  if (currentlySaved) {
    await deleteDoc(ref);
  } else {
    await setDoc(ref, { actorUid: viewerUid, ownerUid, createdAt: serverTimestamp() });
    await Promise.all([
      createIncomingNotification(db, {
        toUid: ownerUid,
        actorUid: viewerUid,
        type: "post_save",
        source: "published",
      }),
      createMyActivity(db, viewerUid, {
        type: "saved",
        source: "published",
        targetOwnerUid: ownerUid,
      }),
    ]);
  }
}

export async function addPublishedComment(db: Firestore, ownerUid: string, viewerUid: string, text: string) {
  const trimmed = text.trim();
  if (!trimmed) return;
  await addDoc(collection(db, PUB, ownerUid, "comments"), {
    authorUid: viewerUid,
    ownerUid,
    text: trimmed.slice(0, 2000),
    createdAt: serverTimestamp(),
  });
  await Promise.all([
    createIncomingNotification(db, {
      toUid: ownerUid,
      actorUid: viewerUid,
      type: "post_comment",
      source: "published",
      message: trimmed.slice(0, 140),
    }),
    createMyActivity(db, viewerUid, {
      type: "commented",
      source: "published",
      targetOwnerUid: ownerUid,
      message: trimmed.slice(0, 140),
    }),
  ]);
}

export function subscribePublishedSocial(
  db: Firestore,
  ownerUid: string,
  viewerUid: string | null,
  onUpdate: (s: {
    likeCount: number;
    saveCount: number;
    commentCount: number;
    liked: boolean;
    saved: boolean;
    comments: { id: string; data: PublishedComment }[];
  }) => void,
): () => void {
  const unsubs: Array<() => void> = [];
  const state = {
    likeCount: 0,
    saveCount: 0,
    commentCount: 0,
    liked: false,
    saved: false,
    comments: [] as { id: string; data: PublishedComment }[],
  };
  const push = () =>
    onUpdate({
      likeCount: state.likeCount,
      saveCount: state.saveCount,
      commentCount: state.commentCount,
      liked: state.liked,
      saved: state.saved,
      comments: [...state.comments],
    });

  unsubs.push(
    onSnapshot(collection(db, PUB, ownerUid, "likes"), (snap) => {
      state.likeCount = snap.size;
      state.liked = viewerUid != null && snap.docs.some((d) => d.id === viewerUid);
      push();
    }),
  );
  unsubs.push(
    onSnapshot(collection(db, PUB, ownerUid, "saves"), (snap) => {
      state.saveCount = snap.size;
      state.saved = viewerUid != null && snap.docs.some((d) => d.id === viewerUid);
      push();
    }),
  );
  unsubs.push(
    onSnapshot(
      query(collection(db, PUB, ownerUid, "comments"), orderBy("createdAt", "asc"), limit(40)),
      (snap) => {
        state.commentCount = snap.size;
        state.comments = snap.docs.map((d) => ({ id: d.id, data: d.data() as PublishedComment }));
        push();
      },
      () => push(),
    ),
  );
  push();
  return () => unsubs.forEach((u) => u());
}
