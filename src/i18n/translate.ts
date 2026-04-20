import type { AppLocale } from "./locales";
import { DEFAULT_LOCALE } from "./locales";
import { en } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import { de } from "./de";
import { pt } from "./pt";
import { ar } from "./ar";

const catalogs: Record<AppLocale, Record<string, string>> = {
  en,
  es: { ...en, ...es },
  fr: { ...en, ...fr },
  de: { ...en, ...de },
  pt: { ...en, ...pt },
  ar: { ...en, ...ar },
};

export function translate(
  locale: AppLocale,
  key: string,
  vars?: Record<string, string>,
): string {
  let s = catalogs[locale]?.[key] ?? catalogs[DEFAULT_LOCALE][key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replaceAll(`{{${k}}}`, v);
    }
  }
  return s;
}
