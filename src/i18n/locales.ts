export type AppLocale = "en" | "es" | "fr" | "de" | "pt" | "ar";

export const LOCALE_OPTIONS: {
  id: AppLocale;
  label: string;
  nativeLabel: string;
  rtl?: boolean;
}[] = [
  { id: "en", label: "English", nativeLabel: "English" },
  { id: "es", label: "Spanish", nativeLabel: "Español" },
  { id: "fr", label: "French", nativeLabel: "Français" },
  { id: "de", label: "German", nativeLabel: "Deutsch" },
  { id: "pt", label: "Portuguese", nativeLabel: "Português" },
  { id: "ar", label: "Arabic", nativeLabel: "العربية", rtl: true },
];

export const DEFAULT_LOCALE: AppLocale = "en";

export function isAppLocale(x: string): x is AppLocale {
  return LOCALE_OPTIONS.some((o) => o.id === x);
}
