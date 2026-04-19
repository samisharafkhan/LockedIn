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
import type { ActivityId, Profile, Pulse, TimeBlock } from "../types";
import { loadState, saveState, type StoredState } from "../lib/storage";
import { sortBlocks } from "../lib/scheduleBlocks";

type ScheduleContextValue = {
  profile: Profile;
  setProfile: (p: Partial<Profile>) => void;
  blocks: TimeBlock[];
  addBlock: (b: Omit<TimeBlock, "id">) => void;
  updateBlock: (id: string, patch: Partial<Omit<TimeBlock, "id">>) => void;
  removeBlock: (id: string) => void;
  pulse: Pulse | null;
  setPulse: (activityId: ActivityId) => void;
  clearPulse: () => void;
  onboardingDone: boolean;
  finishOnboarding: () => void;
};

const ScheduleContext = createContext<ScheduleContextValue | null>(null);

const defaultProfile: Profile = {
  handle: "you",
  displayName: "You",
  avatarEmoji: "◆",
};

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function toStored(
  profile: Profile,
  blocks: TimeBlock[],
  pulse: Pulse | null,
  onboarded: boolean,
): StoredState {
  return {
    profile: { ...profile },
    blocks: blocks.map((b) => ({
      id: b.id,
      startHour: b.startHour,
      startMinute: b.startMinute,
      endHour: b.endHour,
      endMinute: b.endMinute,
      activityId: b.activityId,
    })),
    ...(pulse ? { pulse: { activityId: pulse.activityId, at: pulse.at } } : {}),
    ...(onboarded ? { onboarded: true } : {}),
  };
}

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<Profile>(defaultProfile);
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [pulse, setPulseState] = useState<Pulse | null>(null);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const skipSave = useRef(true);

  useEffect(() => {
    const s = loadState();
    if (s?.profile) {
      setProfileState({
        handle: s.profile.handle,
        displayName: s.profile.displayName,
        avatarEmoji: s.profile.avatarEmoji,
      });
    }
    if (Array.isArray(s?.blocks)) {
      setBlocks(
        s.blocks.map((b) => ({
          ...b,
          activityId: b.activityId as ActivityId,
        })),
      );
    }
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
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    saveState(toStored(profile, blocks, pulse, onboardingDone));
  }, [hydrated, profile, blocks, pulse, onboardingDone]);

  const setProfile = useCallback((p: Partial<Profile>) => {
    setProfileState((prev) => ({ ...prev, ...p }));
  }, []);

  const addBlock = useCallback((b: Omit<TimeBlock, "id">) => {
    const block: TimeBlock = { ...b, id: newId() };
    setBlocks((prev) => sortBlocks([...prev, block]));
  }, []);

  const updateBlock = useCallback((id: string, patch: Partial<Omit<TimeBlock, "id">>) => {
    setBlocks((prev) => sortBlocks(prev.map((x) => (x.id === id ? { ...x, ...patch } : x))));
  }, []);

  const removeBlock = useCallback((id: string) => {
    setBlocks((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const setPulse = useCallback((activityId: ActivityId) => {
    setPulseState({ activityId, at: Date.now() });
  }, []);

  const clearPulse = useCallback(() => {
    setPulseState(null);
  }, []);

  const finishOnboarding = useCallback(() => {
    setOnboardingDone(true);
  }, []);

  const value = useMemo(
    () => ({
      profile,
      setProfile,
      blocks,
      addBlock,
      updateBlock,
      removeBlock,
      pulse,
      setPulse,
      clearPulse,
      onboardingDone,
      finishOnboarding,
    }),
    [
      profile,
      setProfile,
      blocks,
      addBlock,
      updateBlock,
      removeBlock,
      pulse,
      setPulse,
      clearPulse,
      onboardingDone,
      finishOnboarding,
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
