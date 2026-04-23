export type ActivityId =
  | "focus"
  | "class"
  | "work"
  | "gym"
  | "commute"
  | "chill"
  | "sleep"
  | "travel"
  | "social";

export type BlockOutcome = "done" | "not_done";

export type Activity = {
  id: ActivityId;
  label: string;
  /** Short helper shown under the title in pickers */
  hint: string;
};

export type TimeBlock = {
  id: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  activityId: ActivityId;
  /** Set after a block ends — user marks whether they followed through */
  outcome?: BlockOutcome;
};

export type Pulse = {
  activityId: ActivityId;
  at: number;
};

/** Avatar-only fields (photo, animal icon, or symbol) */
export type AvatarFields = {
  avatarEmoji: string;
  avatarImageDataUrl?: string | null;
  avatarAnimalId?: string | null;
};

export type Profile = AvatarFields & {
  handle: string;
  displayName: string;
  /**
   * Instagram-style private account: follow requests must be accepted before others see your schedule.
   * Default false (public).
   */
  isPrivate?: boolean;
  /**
   * @deprecated Synced as `!isPrivate`. Prefer `isPrivate`.
   */
  accountPublic?: boolean;
  /** When true and account is not private, today’s blocks may appear on Discover. */
  publishTodayToDiscover?: boolean;
  /** Short bio (e.g. Instagram-style), shown on your profile and in directory. */
  bio?: string;
};

/** Permission for a shared calendar block collaboration. */
export type BlockSharePermission = "view" | "comment" | "edit";

export type PublicPerson = {
  id: string;
  name: string;
  tagline: string;
  /** Illustrative only — see panel disclaimer */
  note: string;
  blocks: TimeBlock[];
};
