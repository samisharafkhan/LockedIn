const KEY = "lockedin:v1";

export type StoredBlock = {
  id: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  activityId: string;
  outcome?: "done" | "not_done";
};

export type StoredState = {
  profile: {
    handle: string;
    displayName: string;
    avatarEmoji: string;
    avatarImageDataUrl?: string | null;
    avatarAnimalId?: string | null;
    isPrivate?: boolean;
    accountPublic?: boolean;
    publishTodayToDiscover?: boolean;
    bio?: string;
  };
  /** @deprecated migrated into blocksByDay */
  blocks?: StoredBlock[];
  blocksByDay?: Record<string, StoredBlock[]>;
  followingIds?: string[];
  pulse?: { activityId: string; at: number };
  onboarded?: boolean;
  /** BCP-47 style locale id, e.g. en, es */
  locale?: string;
  /** @deprecated use languageOnboardingComplete */
  hasCompletedLanguageStep?: boolean;
  /** Chosen language on first launch, before sign-in */
  languageOnboardingComplete?: boolean;
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

/** Serialize a calendar block for Firestore (e.g. sharing). */
export function timeBlockToStored(b: {
  id: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  activityId: string;
  outcome?: "done" | "not_done";
}): StoredBlock {
  return {
    id: b.id,
    startHour: b.startHour,
    startMinute: b.startMinute,
    endHour: b.endHour,
    endMinute: b.endMinute,
    activityId: b.activityId,
    ...(b.outcome ? { outcome: b.outcome } : {}),
  };
}
