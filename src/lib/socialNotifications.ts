import type { Firestore } from "firebase/firestore";
import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

export type SocialNotificationType =
  | "follow_request"
  | "follow_accept"
  | "post_like"
  | "post_save"
  | "post_comment"
  | "block_reminder"
  | "share_sent";

export type SocialNotificationDoc = {
  toUid: string;
  actorUid: string;
  type: SocialNotificationType;
  message?: string;
  postId?: string;
  source?: "schedule_post" | "published";
  read?: boolean;
  createdAt?: unknown;
};

export type UserActivityDoc = {
  actorUid: string;
  type: "liked" | "saved" | "commented";
  source?: "schedule_post" | "published";
  targetOwnerUid?: string;
  postId?: string;
  message?: string;
  createdAt?: unknown;
};

const USER_NOTIFICATIONS = "userNotifications";
const USER_ACTIVITY = "userActivity";

export async function createIncomingNotification(
  db: Firestore,
  payload: Omit<SocialNotificationDoc, "createdAt" | "read">,
): Promise<void> {
  if (!payload.toUid || !payload.actorUid) return;
  if (payload.toUid === payload.actorUid && payload.type !== "block_reminder" && payload.type !== "share_sent") return;
  await addDoc(collection(db, USER_NOTIFICATIONS, payload.toUid, "items"), {
    ...payload,
    read: false,
    createdAt: serverTimestamp(),
  });
}

export async function createMyActivity(
  db: Firestore,
  uid: string,
  payload: Omit<UserActivityDoc, "actorUid" | "createdAt">,
): Promise<void> {
  if (!uid) return;
  await addDoc(collection(db, USER_ACTIVITY, uid, "items"), {
    actorUid: uid,
    ...payload,
    createdAt: serverTimestamp(),
  });
}

export function subscribeMyNotifications(
  db: Firestore,
  uid: string,
  onRows: (rows: { id: string; data: SocialNotificationDoc }[]) => void,
): () => void {
  const q = query(
    collection(db, USER_NOTIFICATIONS, uid, "items"),
    orderBy("createdAt", "desc"),
    limit(120),
  );
  return onSnapshot(q, (snap) => {
    const rows: { id: string; data: SocialNotificationDoc }[] = [];
    snap.forEach((d) => rows.push({ id: d.id, data: d.data() as SocialNotificationDoc }));
    onRows(rows);
  });
}

export async function markNotificationRead(db: Firestore, uid: string, notificationId: string): Promise<void> {
  await updateDoc(doc(db, USER_NOTIFICATIONS, uid, "items", notificationId), { read: true });
}

export function subscribeMyActivity(
  db: Firestore,
  uid: string,
  onRows: (rows: { id: string; data: UserActivityDoc }[]) => void,
): () => void {
  const q = query(
    collection(db, USER_ACTIVITY, uid, "items"),
    orderBy("createdAt", "desc"),
    limit(120),
  );
  return onSnapshot(q, (snap) => {
    const rows: { id: string; data: UserActivityDoc }[] = [];
    snap.forEach((d) => rows.push({ id: d.id, data: d.data() as UserActivityDoc }));
    onRows(rows);
  });
}
