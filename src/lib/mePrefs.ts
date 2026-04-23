export const ME_PREFS_KEY = "lockedin:me-prefs:v1";

export type MePrefs = {
  /** In-app tips and coach marks (stored locally; demo only). */
  tipsInApp: boolean;
  /** Gentle reminders about saved blocks (demo only). */
  blockReminders: boolean;
  /** Show “active now” style presence in Friends (demo only). */
  activityStatus: boolean;
  /** Dark theme (stored locally). */
  darkMode: boolean;
};

const defaults: MePrefs = {
  tipsInApp: true,
  blockReminders: true,
  activityStatus: true,
  darkMode: false,
};

function parse(raw: string | null): MePrefs {
  if (!raw) return { ...defaults };
  try {
    const v = JSON.parse(raw) as Partial<MePrefs>;
    return {
      tipsInApp: typeof v.tipsInApp === "boolean" ? v.tipsInApp : defaults.tipsInApp,
      blockReminders: typeof v.blockReminders === "boolean" ? v.blockReminders : defaults.blockReminders,
      activityStatus: typeof v.activityStatus === "boolean" ? v.activityStatus : defaults.activityStatus,
      darkMode: typeof v.darkMode === "boolean" ? v.darkMode : defaults.darkMode,
    };
  } catch {
    return { ...defaults };
  }
}

export function loadMePrefs(): MePrefs {
  return parse(localStorage.getItem(ME_PREFS_KEY));
}

export function saveMePrefs(next: MePrefs): void {
  localStorage.setItem(ME_PREFS_KEY, JSON.stringify(next));
}

/** Apply `data-theme` from saved preferences (call on app load and after toggling dark mode). */
export function applyThemeFromPrefs(): void {
  const p = loadMePrefs();
  document.documentElement.setAttribute("data-theme", p.darkMode ? "dark" : "light");
}
