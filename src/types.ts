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
