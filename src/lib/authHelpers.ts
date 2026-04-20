import type { User } from "firebase/auth";

/** Password provider accounts must verify email before full app access. */
export function needsEmailVerification(user: User | null): boolean {
  if (!user) return false;
  const hasPassword = user.providerData.some((p) => p.providerId === "password");
  return hasPassword && !user.emailVerified;
}
