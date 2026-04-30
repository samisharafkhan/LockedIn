import type { ActivityId } from "../types";

/** Softer but distinct fills for Build + Social event cards. */
export type ActivityBlockChrome = {
  bg: string;
  border: string;
  fg: string;
  fgMuted: string;
  iconFg: string;
};

const CHROME: Record<ActivityId, ActivityBlockChrome> = {
  work: { bg: "#5f7fd6", border: "#4c6dc6", fg: "#f8fbff", fgMuted: "#eaf1ff", iconFg: "#f8fbff" },
  focus: { bg: "#7a68cc", border: "#6957bb", fg: "#faf8ff", fgMuted: "#efe9ff", iconFg: "#faf8ff" },
  class: { bg: "#3da37d", border: "#2f906b", fg: "#f4fffb", fgMuted: "#dbf8ee", iconFg: "#f4fffb" },
  gym: { bg: "#d38956", border: "#be7545", fg: "#fffaf6", fgMuted: "#ffeedd", iconFg: "#fffaf6" },
  commute: { bg: "#d3b14f", border: "#bf9d3f", fg: "#1f2937", fgMuted: "rgba(31, 41, 55, 0.82)", iconFg: "#1f2937" },
  chill: { bg: "#4ea8a3", border: "#3f9591", fg: "#f4ffff", fgMuted: "#dff8f7", iconFg: "#f4ffff" },
  sleep: { bg: "#6672cc", border: "#5762bc", fg: "#f7f8ff", fgMuted: "#e8ecff", iconFg: "#f7f8ff" },
  travel: { bg: "#c776a8", border: "#b16798", fg: "#fff8fc", fgMuted: "#ffe6f4", iconFg: "#fff8fc" },
  social: { bg: "#43a374", border: "#359060", fg: "#f6fff9", fgMuted: "#dcf6e7", iconFg: "#f6fff9" },
};

export function activityBlockChrome(id: ActivityId): ActivityBlockChrome {
  return CHROME[id] ?? CHROME.work;
}
