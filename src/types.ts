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

export type Profile = {
  handle: string;
  displayName: string;
  avatarEmoji: string;
};

export type PublicPerson = {
  id: string;
  name: string;
  tagline: string;
  /** Illustrative only — see panel disclaimer */
  note: string;
  blocks: TimeBlock[];
};
