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
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import type { ActivityId, BlockOutcome, Profile, Pulse, TimeBlock } from "../types";
import { CELEBRITY_ARCHETYPES } from "../data/celebrities";
import { DEMO_FRIENDS, type FriendProfile } from "../data/friends";
import type { AppLocale } from "../i18n/locales";
import { DEFAULT_LOCALE, isAppLocale } from "../i18n/locales";
import { translate } from "../i18n/translate";
import { isoDate } from "../lib/dates";
import { getFirebaseAuth, getFirestoreDb, googleAuthProvider } from "../lib/firebaseApp";
import { loadState, saveState, type StoredBlock, type StoredState } from "../lib/storage";
import {
  USER_DIRECTORY_COLLECTION,
  userDirectoryWriteFields,
  type DirectoryUser,
} from "../lib/userDirectory";
import { sortBlocks } from "../lib/scheduleBlocks";

type ScheduleContextValue = {
  tick: number;
  profile: Profile;
  setProfile: (p: Partial<Profile>) => void;
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
  locale: AppLocale;
  setLocale: (l: AppLocale) => void;
  /** User finished the language screen (after sign-in / verification). */
  languageOnboardingComplete: boolean;
  completeLanguageOnboarding: () => void;
  t: (key: string, vars?: Record<string, string>) => string;
  firebaseUser: User | null;
  signInWithGoogle: () => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  reloadFirebaseUser: () => Promise<void>;
  signOutAuth: () => Promise<void>;
  seedDirectoryUser: (u: DirectoryUser) => void;
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
  locale: AppLocale,
  languageOnboardingComplete: boolean,
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
    locale,
    languageOnboardingComplete,
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
  const [locale, setLocaleState] = useState<AppLocale>(DEFAULT_LOCALE);
  const [languageOnboardingComplete, setLanguageOnboardingComplete] = useState(false);
  const [remoteLoaded, setRemoteLoaded] = useState(false);
  const [directoryById, setDirectoryById] = useState<Record<string, FriendProfile>>({});
  const skipSave = useRef(true);
  const applyingRemote = useRef(false);

  const todayKey = useMemo(() => isoDate(new Date()), [tick]);

  const t = useCallback(
    (key: string, vars?: Record<string, string>) => translate(locale, key, vars),
    [locale],
  );

  const applyStoredState = useCallback((s: StoredState) => {
    if (s.onboarded === true && s.profile) {
      setProfileState({
        handle: s.profile.handle,
        displayName: s.profile.displayName,
        avatarEmoji: s.profile.avatarEmoji,
        avatarImageDataUrl: s.profile.avatarImageDataUrl ?? null,
        avatarAnimalId: s.profile.avatarAnimalId ?? null,
      });
    } else {
      setProfileState({ ...defaultProfile });
    }

    if (s.blocksByDay && typeof s.blocksByDay === "object") {
      const mapped: Record<string, TimeBlock[]> = {};
      for (const [day, list] of Object.entries(s.blocksByDay)) {
        if (Array.isArray(list)) mapped[day] = list.map(fromStoredBlock);
      }
      setScheduleByDay(mapped);
    } else if (Array.isArray(s.blocks)) {
      const migrated = s.blocks.map(fromStoredBlock);
      setScheduleByDay({ [isoDate(new Date())]: migrated });
    }

    if (Array.isArray(s.followingIds)) setFollowingIds(s.followingIds);
    else setFollowingIds([]);

    if (s.pulse) {
      setPulseState({
        activityId: s.pulse.activityId as ActivityId,
        at: s.pulse.at,
      });
    } else {
      setPulseState(null);
    }

    setOnboardingDone(s.onboarded === true);

    if (s.locale && isAppLocale(s.locale)) {
      setLocaleState(s.locale);
    }

    const langDone = s.languageOnboardingComplete === true || s.hasCompletedLanguageStep === true;
    setLanguageOnboardingComplete(langDone);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "ar" ? "ar" : locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((x) => x + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const s = loadState();
    if (s) applyStoredState(s);

    setHydrated(true);
  }, [applyStoredState]);

  useEffect(() => {
    if (!hydrated) return;
    const auth = getFirebaseAuth();
    if (!auth) return;
    const db = getFirestoreDb();
    return onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (!user) {
        setRemoteLoaded(false);
        return;
      }

      if (!db) {
        setRemoteLoaded(true);
        return;
      }

      void (async () => {
        try {
          const snap = await getDoc(doc(db, "userState", user.uid));
          if (snap.exists()) {
            applyingRemote.current = true;
            applyStoredState(snap.data() as StoredState);
            queueMicrotask(() => {
              applyingRemote.current = false;
            });
          }
        } finally {
          setRemoteLoaded(true);
        }
      })();
    });
  }, [applyStoredState, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    const stored = toStored(
      profile,
      scheduleByDay,
      followingIds,
      pulse,
      onboardingDone,
      locale,
      languageOnboardingComplete,
    );
    saveState(stored);

    const db = getFirestoreDb();
    if (!db || !firebaseUser || !remoteLoaded || applyingRemote.current) return;
    void setDoc(
      doc(db, "userState", firebaseUser.uid),
      {
        ...stored,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ).catch((e) => {
      console.error("[LockedIn] Firestore userState write failed:", e);
    });

    if (onboardingDone) {
      void setDoc(
        doc(db, USER_DIRECTORY_COLLECTION, firebaseUser.uid),
        {
          ...userDirectoryWriteFields(firebaseUser.uid, profile),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ).catch((e) => {
        console.error("[LockedIn] Firestore userDirectory write failed:", e);
      });
    }
  }, [
    hydrated,
    profile,
    scheduleByDay,
    followingIds,
    pulse,
    onboardingDone,
    locale,
    languageOnboardingComplete,
    firebaseUser,
    remoteLoaded,
  ]);

  const setLocale = useCallback((l: AppLocale) => {
    setLocaleState(l);
  }, []);

  const completeLanguageOnboarding = useCallback(() => {
    setLanguageOnboardingComplete(true);
  }, []);

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

  const addBlock = useCallback(
    (b: Omit<TimeBlock, "id">) => {
      const block: TimeBlock = { ...b, id: newId() };
      updateToday((prev) => [...prev, block]);
    },
    [updateToday],
  );

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

  const getFriend = useCallback(
    (id: string) => DEMO_FRIENDS.find((f) => f.id === id) ?? directoryById[id],
    [directoryById],
  );

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
    await signInWithPopup(auth, googleAuthProvider);
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error("Firebase Auth is not configured.");
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(cred.user);
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error("Firebase Auth is not configured.");
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error("Firebase Auth is not configured.");
    await sendPasswordResetEmail(auth, email);
  }, []);

  const sendVerificationEmail = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (!auth?.currentUser) throw new Error("Not signed in.");
    await sendEmailVerification(auth.currentUser);
  }, []);

  const reloadFirebaseUser = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (!auth?.currentUser) return;
    await reload(auth.currentUser);
    setFirebaseUser(auth.currentUser);
  }, []);

  const signOutAuth = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (auth) await signOut(auth);
  }, []);

  const seedDirectoryUser = useCallback((u: DirectoryUser) => {
    setDirectoryById((prev) => ({
      ...prev,
      [u.uid]: {
        id: u.uid,
        displayName: u.displayName,
        handle: u.handle,
        mark: u.avatarEmoji ?? "○",
        bio: "",
        blocks: [],
      },
    }));
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
      locale,
      setLocale,
      languageOnboardingComplete,
      completeLanguageOnboarding,
      t,
      firebaseUser,
      signInWithGoogle,
      signUpWithEmail,
      signInWithEmail,
      sendPasswordReset,
      sendVerificationEmail,
      reloadFirebaseUser,
      signOutAuth,
      seedDirectoryUser,
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
      locale,
      languageOnboardingComplete,
      completeLanguageOnboarding,
      t,
      firebaseUser,
      signInWithGoogle,
      signUpWithEmail,
      signInWithEmail,
      sendPasswordReset,
      sendVerificationEmail,
      reloadFirebaseUser,
      signOutAuth,
      seedDirectoryUser,
    ],
  );

  if (!hydrated) {
    return (
      <div className="boot">
        <div className="boot__mark" aria-hidden />
        <p className="boot__text">{translate(DEFAULT_LOCALE, "common_loading")}</p>
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
