import type { User } from "firebase/auth";
import type { Profile } from "../types";

export function profilePatchFromGoogleUser(user: User): Partial<Profile> {
  const name = user.displayName?.trim() || "You";
  const emailLocal =
    user.email?.split("@")[0]?.toLowerCase().replace(/[^a-z0-9_]/g, "") ?? "";
  const handle = (emailLocal || `user_${user.uid.slice(0, 8)}`).slice(0, 24);
  return {
    displayName: name,
    handle,
    avatarImageDataUrl: user.photoURL,
    avatarAnimalId: null,
  };
}
