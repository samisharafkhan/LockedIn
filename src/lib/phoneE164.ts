/**
 * Normalize a phone string toward E.164 for Firebase phone auth.
 * Strips spaces, hyphens, parentheses; keeps leading + and digits.
 */
export function normalizePhoneE164(input: string): { e164: string; ok: boolean } {
  const t = input.trim();
  if (!t) return { e164: "", ok: false };
  if (t.startsWith("+")) {
    const rest = t
      .slice(1)
      .replace(/[\s\-.()]/g, "");
    if (!/^\d{8,15}$/.test(rest)) {
      return { e164: "", ok: false };
    }
    return { e164: `+${rest}`, ok: true };
  }
  const digits = t.replace(/[\s\-.()]/g, "").replace(/\D/g, "");
  if (digits.length === 0) {
    return { e164: "", ok: false };
  }
  if (digits.length === 10) {
    return { e164: `+1${digits}`, ok: true };
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return { e164: `+${digits}`, ok: true };
  }
  if (digits.length >= 8 && digits.length <= 15) {
    return { e164: `+${digits}`, ok: true };
  }
  return { e164: "", ok: false };
}
