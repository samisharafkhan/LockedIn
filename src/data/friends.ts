import type { ActivityId, TimeBlock } from "../types";

export type FriendProfile = {
  id: string;
  displayName: string;
  handle: string;
  mark: string;
  bio: string;
  /** Demo “today” arc — not synced to a real account */
  blocks: TimeBlock[];
  accountPublic?: boolean;
  isPrivate?: boolean;
};

const b = (
  i: number,
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number,
  activityId: ActivityId,
): TimeBlock => ({
  id: `demo-f-${i}`,
  startHour,
  startMinute,
  endHour,
  endMinute,
  activityId,
});

/** Local demo people so follow / overlap works offline */
export const DEMO_FRIENDS: FriendProfile[] = [
  {
    id: "jules",
    displayName: "Jules Park",
    handle: "julespark",
    mark: "◇",
    bio: "Design student · night studio",
    blocks: [
      b(0, 9, 0, 11, 30, "class"),
      b(1, 11, 30, 13, 0, "chill"),
      b(2, 13, 0, 17, 0, "focus"),
      b(3, 17, 0, 18, 0, "gym"),
      b(4, 18, 0, 22, 0, "social"),
      b(5, 22, 0, 24, 0, "sleep"),
    ],
  },
  {
    id: "marco",
    displayName: "Marco Silva",
    handle: "marcoruns",
    mark: "⌁",
    bio: "Early miles, early meetings",
    blocks: [
      b(10, 5, 30, 7, 0, "gym"),
      b(11, 7, 0, 8, 0, "commute"),
      b(12, 8, 0, 12, 0, "work"),
      b(13, 12, 0, 13, 0, "chill"),
      b(14, 13, 0, 17, 30, "focus"),
      b(15, 17, 30, 19, 0, "commute"),
      b(16, 19, 0, 21, 0, "social"),
      b(17, 21, 0, 24, 0, "sleep"),
    ],
  },
  {
    id: "ken",
    displayName: "Ken Ali",
    handle: "kenbuilds",
    mark: "◎",
    bio: "Founder · maker hours",
    blocks: [
      b(20, 6, 0, 7, 0, "chill"),
      b(21, 7, 0, 12, 0, "focus"),
      b(22, 12, 0, 13, 0, "chill"),
      b(23, 13, 0, 18, 0, "work"),
      b(24, 18, 0, 19, 30, "commute"),
      b(25, 19, 30, 22, 0, "social"),
      b(26, 22, 0, 24, 0, "sleep"),
    ],
  },
];
