/** 12-hour clock helpers for digit-style time entry (HHMM + AM/PM → 24h). */

export type AmPm = "AM" | "PM";

export function hour24ToDigitsAndPeriod(
  hour24: number,
  minute: number,
): { digits: string; period: AmPm } {
  const period: AmPm = hour24 >= 12 ? "PM" : "AM";
  let h12 = hour24 % 12;
  if (h12 === 0) h12 = 12;
  return {
    digits: `${h12.toString().padStart(2, "0")}${minute.toString().padStart(2, "0")}`,
    period,
  };
}

/** Requires exactly 4 digits (HHMM in 12h form, hour 01–12, minute 00–59). */
export function digitsPeriodToHour24(digits: string, period: AmPm): { hour: number; minute: number } | null {
  if (digits.length !== 4) return null;
  const h12 = parseInt(digits.slice(0, 2), 10);
  const mm = parseInt(digits.slice(2, 4), 10);
  if (!Number.isFinite(h12) || !Number.isFinite(mm)) return null;
  if (h12 < 1 || h12 > 12 || mm > 59) return null;
  let hour24: number;
  if (period === "AM") {
    hour24 = h12 === 12 ? 0 : h12;
  } else {
    hour24 = h12 === 12 ? 12 : h12 + 12;
  }
  return { hour: hour24, minute: mm };
}

export type DigitTimeIssues = { hour?: boolean; minute?: boolean };

/** Validate partial or complete digit string as the user types (12h clock). */
export function timeDigitsIssues(digits: string): DigitTimeIssues {
  const issues: DigitTimeIssues = {};
  if (digits.length >= 2) {
    const h12 = parseInt(digits.slice(0, 2), 10);
    if (!Number.isFinite(h12) || h12 < 1 || h12 > 12) issues.hour = true;
  }
  if (digits.length >= 4) {
    const mm = parseInt(digits.slice(2, 4), 10);
    if (!Number.isFinite(mm) || mm > 59) issues.minute = true;
  }
  return issues;
}

export function formatDigitTimeDisplay(digits: string, placeholder = "–"): string {
  const a = digits[0] ?? placeholder;
  const b = digits[1] ?? placeholder;
  const c = digits[2] ?? placeholder;
  const d = digits[3] ?? placeholder;
  return `${a}${b} : ${c}${d}`;
}
