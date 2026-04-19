const KEY = "lockedin:v1";

export type StoredState = {
  profile: { handle: string; displayName: string; avatarEmoji: string };
  blocks: {
    id: string;
    startHour: number;
    startMinute: number;
    endHour: number;
    endMinute: number;
    activityId: string;
  }[];
  pulse?: { activityId: string; at: number };
  onboarded?: boolean;
};

export function loadState(): StoredState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredState;
  } catch {
    return null;
  }
}

export function saveState(state: StoredState) {
  localStorage.setItem(KEY, JSON.stringify(state));
}
