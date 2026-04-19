import type { Activity } from "../types";

export const ACTIVITIES: Activity[] = [
  { id: "focus", label: "Deep focus", hint: "Heads-down work" },
  { id: "class", label: "Class / lecture", hint: "On campus or online" },
  { id: "work", label: "Work", hint: "Job, meetings, email" },
  { id: "gym", label: "Workout", hint: "Gym, run, sport" },
  { id: "commute", label: "Commute", hint: "Bus, train, drive" },
  { id: "chill", label: "Free time", hint: "Rest, hobbies, nothing" },
  { id: "sleep", label: "Sleep", hint: "Wind down & rest" },
  { id: "travel", label: "Travel", hint: "Trip, airport, away" },
  { id: "social", label: "Social", hint: "Friends, family, dates" },
];

export function activityById(id: string) {
  return ACTIVITIES.find((a) => a.id === id) ?? ACTIVITIES[0];
}
