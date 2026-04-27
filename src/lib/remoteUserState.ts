import { doc, getDoc } from "firebase/firestore";
import type { ActivityId, Pulse, TimeBlock } from "../types";
import type { StoredBlock, StoredState } from "./storage";
import { getFirestoreDb } from "./firebaseApp";

function fromStoredBlock(b: StoredBlock): TimeBlock {
  return {
    id: b.id,
    startHour: b.startHour,
    startMinute: b.startMinute,
    endHour: b.endHour,
    endMinute: b.endMinute,
    activityId: b.activityId as ActivityId,
    ...(b.outcome ? { outcome: b.outcome } : {}),
  };
}

export type RemoteUserSnapshot = {
  scheduleByDay: Record<string, TimeBlock[]>;
  pulse: Pulse | null;
};

/** Reads `userState/{uid}` when Firestore rules allow the current viewer. */
export async function fetchRemoteUserSnapshot(ownerUid: string): Promise<RemoteUserSnapshot | null> {
  const db = getFirestoreDb();
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, "userState", ownerUid));
    if (!snap.exists()) return { scheduleByDay: {}, pulse: null };
    const s = snap.data() as StoredState;
    const scheduleByDay: Record<string, TimeBlock[]> = {};
    if (s.blocksByDay && typeof s.blocksByDay === "object") {
      for (const [day, list] of Object.entries(s.blocksByDay)) {
        if (Array.isArray(list)) {
          scheduleByDay[day] = (list as StoredBlock[]).map(fromStoredBlock);
        }
      }
    }
    let pulse: Pulse | null = null;
    if (s.pulse && typeof s.pulse.activityId === "string" && typeof s.pulse.at === "number") {
      pulse = { activityId: s.pulse.activityId as ActivityId, at: s.pulse.at };
    }
    return { scheduleByDay, pulse };
  } catch {
    return null;
  }
}
