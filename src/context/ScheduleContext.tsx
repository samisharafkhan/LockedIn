import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import type { ActivityId, BlockOutcome, Profile, Pulse, TimeBlock } from "../types";
import { CELEBRITY_ARCHETYPES } from "../data/celebrities";
import { DEMO_FRIENDS, type FriendProfile } from "../data/friends";
import { isoDate } from "../lib/dates";
import { getFirebaseAuth, googleAuthProvider } from "../lib/firebaseApp";
import { profilePatchFromGoogleUser } from "../lib/googleProfile";
import { loadState, saveState, type StoredBlock, type StoredState } from "../lib/storage";
import { sortBlocks } from "../lib/scheduleBlocks";

type ScheduleContextValue = {
  tick: number;
  profile: Profile;
  setProfile: (p: Partial<Profile>) => void;
  /** Today’s editable blocks */
  blocks: TimeBlock[];
  scheduleByDay: Record<string, TimeBlock[]>;
  addBlock: (b: Omit<TimeBlock, "id">) => void;
  updateBlock: (id: string, patch: Partial<Omit<TimeBlock, "id">>) => void;
  removeBlock: (id: string) => void;
  setBlockOutcome: (id: string, outcome: BlockOutcome) => void;
  followingIds: string[];
  toggleFollow: (friendId: string) => void;
  isFollowing: (friendId: string) => boolean;
  friends: FriendProfile[];
  getFriend: (id: string) => FriendProfile | undefined;
  celebrities: typeof CELEBRITY_ARCHETYPES;
  pulse: Pulse | null;
  setPulse: (activityId: ActivityId) => void;
  clearPulse: () => void;
  onboardingDone: boolean;
  finishOnboarding: () => void;
  firebaseUser: User | null;
  signInWithGoogle: () => Promise<void>;
  signOutGoogle: () => Promise<void>;
};

const ScheduleContext = createContext<ScheduleContextValue | null>(null);

const defaultProfile: Profile = {
  handle: "you",
  displayName: "You",
  avatarEmoji: "◆",
  avatarImageDataUrl: null,
  avatarAnimalId: null,
};

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

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

function toStoredBlock(b: TimeBlock): StoredBlock {
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

function pruneByDay(map: Record<string, TimeBlock[]>, keepDays = 21) {
  const keys = Object.keys(map).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  const next: Record<string, TimeBlock[]> = {};
  for (const k of keys.slice(0, keepDays)) {
    next[k] = map[k];
  }
  return next;
}

function toStored(
  profile: Profile,
  scheduleByDay: Record<string, TimeBlock[]>,
  followingIds: string[],
  pulse: Pulse | null,
  onboarded: boolean,
): StoredState {
  const blocksByDay: Record<string, StoredBlock[]> = {};
  const pruned = pruneByDay(scheduleByDay);
  for (const [day, list] of Object.entries(pruned)) {
    blocksByDay[day] = list.map(toStoredBlock);
  }
  return {
    profile: { ...profile },
    blocksByDay,
    followingIds,
    ...(pulse ? { pulse: { activityId: pulse.activityId, at: pulse.at } } : {}),
    ...(onboarded ? { onboarded: true } : {}),
  };
}

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<Profile>(defaultProfile);
  const [scheduleByDay, setScheduleByDay] = useState<Record<string, TimeBlock[]>>({});
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [pulse, setPulseState] = useState<Pulse | null>(null);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [tick, setTick] = useState(0);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const skipSave = useRef(true);

  const todayKey = useMemo(() => isoDate(new Date()), [tick]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const s = loadState();
    if (s?.profile) {
      setProfileState({
        handle: s.profile.handle,
        displayName: s.profile.displayName,
        avatarEmoji: s.profile.avatarEmoji,
        avatarImageDataUrl: s.profile.avatarImageDataUrl ?? null,
        avatarAnimalId: s.profile.avatarAnimalId ?? null,
      });
    }

    if (s?.blocksByDay && typeof s.blocksByDay === "object") {
      const mapped: Record<string, TimeBlock[]> = {};
      for (const [day, list] of Object.entries(s.blocksByDay)) {
        if (Array.isArray(list)) mapped[day] = list.map(fromStoredBlock);
      }
      setScheduleByDay(mapped);
    } else if (Array.isArray(s?.blocks)) {
      const migrated = s.blocks.map(fromStoredBlock);
      setScheduleByDay({ [isoDate(new Date())]: migrated });
    }

    if (Array.isArray(s?.followingIds)) setFollowingIds(s.followingIds);

    if (s?.pulse) {
      setPulseState({
        activityId: s.pulse.activityId as ActivityId,
        at: s.pulse.at,
      });
    }
    if (s?.onboarded) setOnboardingDone(true);
    else if (s?.profile?.displayName && s.profile.displayName !== defaultProfile.displayName) {
      setOnboardingDone(true);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const auth = getFirebaseAuth();
    if (!auth) return;
    return onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (!user) return;
      setProfileState((prev) => {
        if (
          prev.displayName !== defaultProfile.displayName ||
          prev.handle !== defaultProfile.handle
        ) {
          return prev;
        }
        return { ...prev, ...profilePatchFromGoogleUser(user) };
      });
      setOnboardingDone((prev) => {
        if (prev) return prev;
        return Boolean(user.displayName?.trim() || user.email);
      });
    });
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    saveState(toStored(profile, scheduleByDay, followingIds, pulse, onboardingDone));
  }, [hydrated, profile, scheduleByDay, followingIds, pulse, onboardingDone]);

  const updateToday = useCallback(
    (fn: (prev: TimeBlock[]) => TimeBlock[]) => {
      setScheduleByDay((prev) => {
        const key = isoDate(new Date());
        const cur = prev[key] ?? [];
        return { ...prev, [key]: sortBlocks(fn(cur)) };
      });
    },
    [],
  );

  const blocks = scheduleByDay[todayKey] ?? [];

  const setProfile = useCallback((p: Partial<Profile>) => {
    setProfileState((prev) => ({ ...prev, ...p }));
  }, []);

  const addBlock = useCallback((b: Omit<TimeBlock, "id">) => {
    const block: TimeBlock = { ...b, id: newId() };
    updateToday((prev) => [...prev, block]);
  }, [updateToday]);

  const updateBlock = useCallback(
    (id: string, patch: Partial<Omit<TimeBlock, "id">>) => {
      updateToday((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    },
    [updateToday],
  );

  const removeBlock = useCallback(
    (id: string) => {
      updateToday((prev) => prev.filter((x) => x.id !== id));
    },
    [updateToday],
  );

  const setBlockOutcome = useCallback(
    (id: string, outcome: BlockOutcome) => {
      updateToday((prev) => prev.map((x) => (x.id === id ? { ...x, outcome } : x)));
    },
    [updateToday],
  );

  const toggleFollow = useCallback((friendId: string) => {
    setFollowingIds((prev) =>
      prev.includes(friendId) ? prev.filter((x) => x !== friendId) : [...prev, friendId],
    );
  }, []);

  const isFollowing = useCallback(
    (friendId: string) => followingIds.includes(friendId),
    [followingIds],
  );

  const getFriend = useCallback((id: string) => DEMO_FRIENDS.find((f) => f.id === id), []);

  const setPulse = useCallback((activityId: ActivityId) => {
    setPulseState({ activityId, at: Date.now() });
  }, []);

  const clearPulse = useCallback(() => {
    setPulseState(null);
  }, []);

  const finishOnboarding = useCallback(() => {
    setOnboardingDone(true);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error("Firebase Auth is not configured for this build.");
    const cred = await signInWithPopup(auth, googleAuthProvider);
    const patch = profilePatchFromGoogleUser(cred.user);
    setProfileState((prev) => ({ ...prev, ...patch }));
    setOnboardingDone(true);
  }, []);

  const signOutGoogle = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (auth) await signOut(auth);
  }, []);

  const value = useMemo(
    () => ({
      tick,
      profile,
      setProfile,
      blocks,
      scheduleByDay,
      addBlock,
      updateBlock,
      removeBlock,
      setBlockOutcome,
      followingIds,
      toggleFollow,
      isFollowing,
      friends: DEMO_FRIENDS,
      getFriend,
      celebrities: CELEBRITY_ARCHETYPES,
      pulse,
      setPulse,
      clearPulse,
      onboardingDone,
      finishOnboarding,
      firebaseUser,
      signInWithGoogle,
      signOutGoogle,
    }),
    [
      tick,
      profile,
      setProfile,
      blocks,
      scheduleByDay,
      addBlock,
      updateBlock,
      removeBlock,
      setBlockOutcome,
      followingIds,
      toggleFollow,
      isFollowing,
      getFriend,
      pulse,
      setPulse,
      clearPulse,
      onboardingDone,
      finishOnboarding,
      firebaseUser,
      signInWithGoogle,
      signOutGoogle,
    ],
  );

  if (!hydrated) {
    return (
      <div className="boot">
        <div className="boot__mark" aria-hidden />
        <p className="boot__text">Loading…</p>
      </div>
    );
  }

  return <ScheduleContext.Provider value={value}>{children}</ScheduleContext.Provider>;
}

export function useSchedule() {
  const ctx = useContext(ScheduleContext);
  if (!ctx) throw new Error("useSchedule must be used within ScheduleProvider");
  return ctx;
}
