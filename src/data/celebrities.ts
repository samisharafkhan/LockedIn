import type { ActivityId, PublicPerson, TimeBlock } from "../types";

const c = (
  i: number,
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number,
  activityId: ActivityId,
): TimeBlock => ({
  id: `celeb-${i}`,
  startHour,
  startMinute,
  endHour,
  endMinute,
  activityId,
});

/**
 * Illustrative “public day” arcs inspired by widely repeated interviews & articles.
 * Not scraped, not verified, not real-time — for comparison and motivation only.
 */
export const CELEBRITY_ARCHETYPES: PublicPerson[] = [
  {
    id: "wahlberg",
    name: "Mark Wahlberg (archetype)",
    tagline: "Early gym, stacked blocks",
    note: "Inspired by recurring press descriptions of a very early start, training, and long work blocks.",
    blocks: [
      c(0, 4, 0, 5, 0, "chill"),
      c(1, 5, 0, 6, 0, "gym"),
      c(2, 6, 0, 9, 0, "focus"),
      c(3, 9, 0, 12, 0, "work"),
      c(4, 12, 0, 13, 0, "chill"),
      c(5, 13, 0, 17, 0, "work"),
      c(6, 17, 0, 18, 0, "commute"),
      c(7, 18, 0, 20, 0, "social"),
      c(8, 20, 0, 22, 0, "chill"),
      c(9, 22, 0, 24, 0, "sleep"),
    ],
  },
  {
    id: "goggins",
    name: "David Goggins (archetype)",
    tagline: "Run early, grind deep",
    note: "Inspired by podcast / book themes of early cardio and long focus stretches — stylized.",
    blocks: [
      c(10, 4, 0, 6, 0, "gym"),
      c(11, 6, 0, 7, 0, "chill"),
      c(12, 7, 0, 12, 0, "focus"),
      c(13, 12, 0, 13, 0, "chill"),
      c(14, 13, 0, 17, 0, "work"),
      c(15, 17, 0, 18, 30, "gym"),
      c(16, 18, 30, 21, 0, "focus"),
      c(17, 21, 0, 24, 0, "sleep"),
    ],
  },
  {
    id: "cook",
    name: "Tim Cook (archetype)",
    tagline: "Dawn focus, long office arc",
    note: "Inspired by anecdotes of very early mornings and long workdays — not Apple’s real calendar.",
    blocks: [
      c(20, 5, 0, 7, 0, "focus"),
      c(21, 7, 0, 8, 0, "commute"),
      c(22, 8, 0, 11, 30, "work"),
      c(23, 11, 30, 12, 30, "chill"),
      c(24, 12, 30, 18, 0, "work"),
      c(25, 18, 0, 19, 0, "commute"),
      c(26, 19, 0, 21, 0, "social"),
      c(27, 21, 0, 24, 0, "sleep"),
    ],
  },
  {
    id: "johnson",
    name: "Dwayne Johnson (archetype)",
    tagline: "Iron first, long shoot days",
    note: "Inspired by public training clips and long shoot schedules — rounded for comparison.",
    blocks: [
      c(30, 4, 0, 5, 30, "gym"),
      c(31, 5, 30, 7, 0, "chill"),
      c(32, 7, 0, 12, 0, "work"),
      c(33, 12, 0, 13, 0, "chill"),
      c(34, 13, 0, 17, 0, "work"),
      c(35, 17, 0, 18, 30, "gym"),
      c(36, 18, 30, 21, 0, "social"),
      c(37, 21, 0, 24, 0, "sleep"),
    ],
  },
];
