import type { ActivityId, TimeBlock } from "../types";
import type { StoredBlock } from "../lib/storage";

export function storedToTimeBlock(s: StoredBlock): TimeBlock {
  return {
    id: s.id,
    startHour: s.startHour,
    startMinute: s.startMinute,
    endHour: s.endHour,
    endMinute: s.endMinute,
    activityId: s.activityId as ActivityId,
    ...(s.outcome ? { outcome: s.outcome } : {}),
  };
}
