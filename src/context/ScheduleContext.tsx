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
import { deleteDoc, doc, getDoc, getDocFromServer, serverTimestamp, setDoc } from "firebase/firestore";
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
import { subscribeOwnerBlockShares } from "../lib/blockShares";
import {
  acceptFollowRequest as acceptFollowRequestDoc,
  buildFollowDocId,
  FOLLOWS_COLLECTION,
  getFollowEdgeFromServer,
  rejectFollowRequest as rejectFollowRequestDoc,
  requestOrAcceptFollow,
  subscribeMyFollowLists,
  unfollowOrCancel,
} from "../lib/follows";
import { sortBlocks } from "../lib/scheduleBlocks";
import { createIncomingNotification } from "../lib/socialNotifications";

type ScheduleContextValue = {
  tick: number;
  todayKey: string;
  profile: Profile;
  setProfile: (p: Partial<Profile>) => void;
  blocks: TimeBlock[];
  scheduleByDay: Record<string, TimeBlock[]>;
  addBlock: (b: Omit<TimeBlock, "id">) => void;
  /** Replace all blocks for today in one update (e.g. AI day builder). */
  replaceTodayWithBlocks: (list: Omit<TimeBlock, "id">[]) => void;
  updateBlock: (id: string, patch: Partial<Omit<TimeBlock, "id">>) => void;
  removeBlock: (id: string) => void;
  setBlockOutcome: (id: string, outcome: BlockOutcome) => void;
  /** Merge or replace a block on a specific day (e.g. accepting a shared event). */
  mergeBlockIntoDay: (dayKey: string, block: TimeBlock) => void;
  followingIds: string[];
  followerIds: string[];
  /** Outgoing follow requests waiting on a private account. */
  pendingOutgoingFollowIds: string[];
  /** Incoming follow requests you can accept or decline. */
  pendingIncomingFollows: { followerUid: string }[];
  toggleFollow: (friendId: string, opts?: { targetIsPrivate?: boolean }) => Promise<void>;
  isFollowing: (friendId: string) => boolean;
  hasPendingFollowRequest: (friendId: string) => boolean;
  acceptFollowRequest: (followerUid: string) => Promise<void>;
  rejectFollowRequest: (followerUid: string) => Promise<void>;
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
  isPrivate: false,
  accountPublic: true,
  publishTodayToDiscover: false,
  bio: "",
};

const demoFriendIdSet = new Set(DEMO_FRIENDS.map((f) => f.id));

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
  const [followerIds, setFollowerIds] = useState<string[]>([]);
  const [pendingOutgoingFollowIds, setPendingOutgoingFollowIds] = useState<string[]>([]);
  const [pendingIncomingFollows, setPendingIncomingFollows] = useState<{ followerUid: string }[]>([]);
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
  /** UIDs we optimistically treat as accepted / pending until Firestore snapshots catch up. */
  const followAcceptedInFlight = useRef(new Set<string>());
  const followPendingInFlight = useRef(new Set<string>());

  const todayKey = useMemo(() => isoDate(new Date()), [tick]);

  const t = useCallback(
    (key: string, vars?: Record<string, string>) => translate(locale, key, vars),
    [locale],
  );

  const applyStoredState = useCallback((s: StoredState) => {
    if (s.onboarded === true && s.profile) {
      const isPrivate =
        s.profile.isPrivate === true || s.profile.accountPublic === false;
      setProfileState({
        handle: s.profile.handle,
        displayName: s.profile.displayName,
        avatarEmoji: s.profile.avatarEmoji,
        avatarImageDataUrl: s.profile.avatarImageDataUrl ?? null,
        avatarAnimalId: s.profile.avatarAnimalId ?? null,
        isPrivate,
        accountPublic: !isPrivate,
        publishTodayToDiscover: isPrivate ? false : s.profile.publishTodayToDiscover === true,
        bio: typeof s.profile.bio === "string" ? s.profile.bio.slice(0, 160) : "",
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

    if (Array.isArray(s.followingIds)) {
      setFollowingIds(s.followingIds.filter((id) => !demoFriendIdSet.has(id)));
    }
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
    const db = getFirestoreDb();
    if (!db || !firebaseUser || !hydrated) return;
    const demoIds = new Set(DEMO_FRIENDS.map((f) => f.id));
    const need = followingIds.filter((id) => !demoIds.has(id));
    if (need.length === 0) return;

    let cancelled = false;
    void (async () => {
      const snaps = await Promise.all(need.map((uid) => getDoc(doc(db, USER_DIRECTORY_COLLECTION, uid))));
      if (cancelled) return;
      setDirectoryById((prev) => {
        const next = { ...prev };
        for (const snap of snaps) {
          if (!snap.exists()) continue;
          const x = snap.data();
          const isPrivate = x.isPrivate === true || x.accountPublic === false;
          const bio = typeof x.bio === "string" ? x.bio : "";
          next[snap.id] = {
            id: snap.id,
            displayName: String(x.displayName ?? "User"),
            handle: String(x.handle ?? ""),
            mark: String(x.avatarEmoji ?? "○"),
            bio,
            blocks: [],
            isPrivate,
            accountPublic: !isPrivate,
          };
        }
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [followingIds, firebaseUser, hydrated]);

  /** Live follow lists + one-time backfill of legacy local follows into `follows`. */
  useEffect(() => {
    const db = getFirestoreDb();
    if (!db || !firebaseUser) {
      followAcceptedInFlight.current.clear();
      followPendingInFlight.current.clear();
      setFollowerIds([]);
      setPendingOutgoingFollowIds([]);
      setPendingIncomingFollows([]);
      return;
    }
    let unsub: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      const key = `lockedin:follow-backfill-v1:${firebaseUser.uid}`;
      if (localStorage.getItem(key) !== "1") {
        const stored = loadState();
        const legacy = (stored?.followingIds ?? []).filter((id) => !demoFriendIdSet.has(id));
        for (const id of legacy) {
          if (cancelled) return;
          try {
            await setDoc(
              doc(db, FOLLOWS_COLLECTION, buildFollowDocId(firebaseUser.uid, id)),
              {
                followerUid: firebaseUser.uid,
                followingUid: id,
                status: "accepted",
                createdAt: serverTimestamp(),
              },
              { merge: true },
            );
          } catch {
            /* ignore */
          }
        }
        localStorage.setItem(key, "1");
      }
      if (cancelled) return;
      unsub = subscribeMyFollowLists(firebaseUser.uid, (lists) => {
        const acceptedRemote = lists.acceptedFollowingIds;
        const followersRemote = lists.acceptedFollowerIds;
        const pendingRemote = lists.pendingOutgoingIds;
        for (const id of [...followAcceptedInFlight.current]) {
          if (acceptedRemote.includes(id)) followAcceptedInFlight.current.delete(id);
        }
        for (const id of [...followPendingInFlight.current]) {
          if (pendingRemote.includes(id)) followPendingInFlight.current.delete(id);
        }
        setFollowingIds(() => {
          const next = new Set<string>(acceptedRemote);
          for (const id of followAcceptedInFlight.current) next.add(id);
          return [...next];
        });
        setPendingOutgoingFollowIds(() => {
          const next = new Set<string>(pendingRemote);
          for (const id of followPendingInFlight.current) next.add(id);
          return [...next];
        });
        setFollowerIds(followersRemote);
        setPendingIncomingFollows(lists.pendingIncoming);
      });
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [firebaseUser]);

  /** Merge collaborator edits from `blockShares` into today’s local blocks (owner side). */
  useEffect(() => {
    const db = getFirestoreDb();
    if (!db || !firebaseUser) return;
    const day = todayKey;
    return subscribeOwnerBlockShares(firebaseUser.uid, (docs) => {
      setScheduleByDay((prev) => {
        const list = prev[day];
        if (!list?.length) return prev;
        let changed = false;
        const nextList = list.map((block) => {
          const candidates = docs.filter((d) => d.dayKey === day && d.blockId === block.id);
          if (candidates.length === 0) return block;
          const share = candidates.reduce((a, b) => {
            const ta = (a.updatedAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0;
            const tb = (b.updatedAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0;
            return tb >= ta ? b : a;
          });
          if (!share?.collabBlock) return block;
          const c = fromStoredBlock(share.collabBlock);
          if (
            block.startHour === c.startHour &&
            block.startMinute === c.startMinute &&
            block.endHour === c.endHour &&
            block.endMinute === c.endMinute &&
            block.activityId === c.activityId
          ) {
            return block;
          }
          changed = true;
          return { ...c, id: block.id, outcome: block.outcome };
        });
        if (!changed) return prev;
        return { ...prev, [day]: sortBlocks(nextList) };
      });
    });
  }, [firebaseUser, todayKey]);

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

      const day = isoDate(new Date());
      const canPublish =
        profile.isPrivate !== true &&
        profile.publishTodayToDiscover === true &&
        (scheduleByDay[day]?.length ?? 0) > 0;
      if (canPublish) {
        void setDoc(
          doc(db, "publishedSchedules", firebaseUser.uid),
          {
            ownerUid: firebaseUser.uid,
            dayKey: day,
            blocks: (scheduleByDay[day] ?? []).map(toStoredBlock),
            handle: profile.handle.trim(),
            displayName: profile.displayName.trim(),
            avatarEmoji: profile.avatarEmoji ?? "○",
            bio: (profile.bio ?? "").trim().slice(0, 160),
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        ).catch((e) => {
          console.error("[LockedIn] Firestore publishedSchedules write failed:", e);
        });
      } else {
        void deleteDoc(doc(db, "publishedSchedules", firebaseUser.uid)).catch(() => {});
      }
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
    setProfileState((prev) => {
      const next = { ...prev, ...p };
      if ("isPrivate" in p && p.isPrivate != null) {
        next.isPrivate = p.isPrivate;
        next.accountPublic = !p.isPrivate;
        if (p.isPrivate) next.publishTodayToDiscover = false;
      }
      return next;
    });
  }, []);

  const addBlock = useCallback(
    (b: Omit<TimeBlock, "id">) => {
      const block: TimeBlock = { ...b, id: newId() };
      updateToday((prev) => [...prev, block]);
    },
    [updateToday],
  );

  const replaceTodayWithBlocks = useCallback(
    (list: Omit<TimeBlock, "id">[]) => {
      updateToday(() => list.map((b) => ({ ...b, id: newId() })));
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

  const mergeBlockIntoDay = useCallback((dayKey: string, block: TimeBlock) => {
    setScheduleByDay((prev) => {
      const list = prev[dayKey] ?? [];
      const idx = list.findIndex((x) => x.id === block.id);
      const nextList = idx >= 0 ? list.map((x) => (x.id === block.id ? block : x)) : [...list, block];
      return { ...prev, [dayKey]: sortBlocks(nextList) };
    });
  }, []);

  const toggleFollow = useCallback(
    async (friendId: string, opts?: { targetIsPrivate?: boolean }) => {
      if (!friendId.trim()) throw new Error("Missing target user.");
      if (demoFriendIdSet.has(friendId)) {
        setFollowingIds((prev) =>
          prev.includes(friendId) ? prev.filter((x) => x !== friendId) : [...prev, friendId],
        );
        return;
      }
      const db = getFirestoreDb();
      if (!db || !firebaseUser) {
        throw new Error("Sign in is required to follow people.");
      }
      if (firebaseUser.uid === friendId) {
        throw new Error("You cannot follow your own account.");
      }

      const applyLocalFollowUi = (targetPrivate: boolean) => {
        if (targetPrivate) {
          followAcceptedInFlight.current.delete(friendId);
          followPendingInFlight.current.add(friendId);
          setFollowingIds((p) => p.filter((x) => x !== friendId));
          setPendingOutgoingFollowIds((p) => (p.includes(friendId) ? p : [...p, friendId]));
        } else {
          followPendingInFlight.current.delete(friendId);
          followAcceptedInFlight.current.add(friendId);
          setPendingOutgoingFollowIds((p) => p.filter((x) => x !== friendId));
          setFollowingIds((p) => (p.includes(friendId) ? p : [...p, friendId]));
        }
      };

      const hint = opts?.targetIsPrivate;
      if (hint === true || hint === false) {
        applyLocalFollowUi(hint);
      }

      try {
        const edge = await getFollowEdgeFromServer(db, firebaseUser.uid, friendId);
        if (edge) {
          const wasAccepted = edge.status === "accepted";
          followAcceptedInFlight.current.delete(friendId);
          followPendingInFlight.current.delete(friendId);
          if (wasAccepted) {
            setFollowingIds((prev) => prev.filter((x) => x !== friendId));
          } else {
            setPendingOutgoingFollowIds((prev) => prev.filter((x) => x !== friendId));
          }
          try {
            await unfollowOrCancel(db, firebaseUser.uid, friendId);
          } catch (unfollowErr) {
            console.error("[LockedIn] unfollow failed:", unfollowErr);
            if (wasAccepted) {
              setFollowingIds((prev) => (prev.includes(friendId) ? prev : [...prev, friendId]));
            } else {
              setPendingOutgoingFollowIds((prev) =>
                prev.includes(friendId) ? prev : [...prev, friendId],
              );
            }
          }
          return;
        }
        const dir = await getDocFromServer(doc(db, USER_DIRECTORY_COLLECTION, friendId));
        const serverPrivate =
          dir.exists() &&
          (dir.data().isPrivate === true || dir.data().accountPublic === false);
        applyLocalFollowUi(serverPrivate);
        await requestOrAcceptFollow(db, firebaseUser.uid, friendId, serverPrivate);
        await createIncomingNotification(db, {
          toUid: friendId,
          actorUid: firebaseUser.uid,
          type: serverPrivate ? "follow_request" : "follow_accept",
        });
      } catch (e) {
        console.error("[LockedIn] toggleFollow failed:", e);
        followAcceptedInFlight.current.delete(friendId);
        followPendingInFlight.current.delete(friendId);
        setFollowingIds((prev) => prev.filter((x) => x !== friendId));
        setPendingOutgoingFollowIds((prev) => prev.filter((x) => x !== friendId));
        if (typeof e === "object" && e && "code" in e) {
          const code = String((e as { code: string }).code);
          if (code === "permission-denied") {
            throw new Error("Couldn't follow right now. Check Firestore rules or try again shortly.");
          }
        }
        throw e instanceof Error ? e : new Error("Follow request failed.");
      }
    },
    [firebaseUser],
  );

  const isFollowing = useCallback(
    (friendId: string) => followingIds.includes(friendId),
    [followingIds],
  );

  const hasPendingFollowRequest = useCallback(
    (friendId: string) => pendingOutgoingFollowIds.includes(friendId),
    [pendingOutgoingFollowIds],
  );

  const acceptFollowRequest = useCallback(
    async (followerUid: string) => {
      const db = getFirestoreDb();
      if (!db || !firebaseUser) return;
      await acceptFollowRequestDoc(db, firebaseUser.uid, followerUid);
      await createIncomingNotification(db, {
        toUid: followerUid,
        actorUid: firebaseUser.uid,
        type: "follow_accept",
      });
    },
    [firebaseUser],
  );

  const rejectFollowRequest = useCallback(
    async (followerUid: string) => {
      const db = getFirestoreDb();
      if (!db || !firebaseUser) return;
      await rejectFollowRequestDoc(db, firebaseUser.uid, followerUid);
    },
    [firebaseUser],
  );

  const getFriend = useCallback((id: string) => directoryById[id], [directoryById]);

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
    const isPrivate = u.isPrivate === true || u.accountPublic === false;
    setDirectoryById((prev) => ({
      ...prev,
      [u.uid]: {
        id: u.uid,
        displayName: u.displayName,
        handle: u.handle,
        mark: u.avatarEmoji ?? "○",
        bio: u.bio ?? "",
        blocks: [],
        isPrivate,
        accountPublic: !isPrivate,
      },
    }));
  }, []);

  const value = useMemo(
    () => ({
      tick,
      todayKey,
      profile,
      setProfile,
      blocks,
      scheduleByDay,
      addBlock,
      replaceTodayWithBlocks,
      updateBlock,
      removeBlock,
      setBlockOutcome,
      mergeBlockIntoDay,
      followingIds,
      followerIds,
      pendingOutgoingFollowIds,
      pendingIncomingFollows,
      toggleFollow,
      isFollowing,
      hasPendingFollowRequest,
      acceptFollowRequest,
      rejectFollowRequest,
      friends: [],
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
      todayKey,
      profile,
      setProfile,
      blocks,
      scheduleByDay,
      addBlock,
      replaceTodayWithBlocks,
      updateBlock,
      removeBlock,
      setBlockOutcome,
      mergeBlockIntoDay,
      followingIds,
      followerIds,
      pendingOutgoingFollowIds,
      pendingIncomingFollows,
      toggleFollow,
      isFollowing,
      hasPendingFollowRequest,
      acceptFollowRequest,
      rejectFollowRequest,
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
