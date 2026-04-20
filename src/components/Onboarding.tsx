import { useState } from "react";
import { AvatarPicker } from "./AvatarPicker";
import { useSchedule } from "../context/ScheduleContext";
import { isFirebaseAuthConfigured } from "../lib/firebaseApp";
import type { AvatarFields } from "../types";

export function Onboarding() {
  const { setProfile, finishOnboarding, signInWithGoogle } = useSchedule();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<AvatarFields>({
    avatarEmoji: "◆",
    avatarAnimalId: null,
    avatarImageDataUrl: null,
  });
  const [googleErr, setGoogleErr] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);

  const go = () => {
    const trimmed = name.trim() || "Friend";
    const handle = trimmed.toLowerCase().replace(/\s+/g, "") || "friend";
    setProfile({
      displayName: trimmed,
      handle,
      ...avatar,
    });
    finishOnboarding();
  };

  const google = async () => {
    setGoogleErr(null);
    setGoogleBusy(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not sign in with Google.";
      setGoogleErr(msg);
    } finally {
      setGoogleBusy(false);
    }
  };

  return (
    <div className="onboard">
      <div className="onboard__card">
        <p className="eyebrow eyebrow--dark">LockedIn</p>
        <h1 className="onboard__title">Let’s set you up</h1>
        <p className="onboard__lede">
          Add a photo, pick a minimal animal, or keep a symbol — same vibe as the rest of the app.
        </p>
        {isFirebaseAuthConfigured() ? (
          <>
            <button
              type="button"
              className="btn btn--outline btn--wide onboard__google"
              onClick={() => void google()}
              disabled={googleBusy}
            >
              {googleBusy ? "Opening Google…" : "Continue with Google"}
            </button>
            {googleErr ? <p className="onboard__err">{googleErr}</p> : null}
            <p className="onboard__or">or set up locally</p>
          </>
        ) : (
          <p className="onboard__hint">
            Optional: add <code className="onboard__code">VITE_FIREBASE_*</code> keys to enable Google sign-in on
            this host.
          </p>
        )}
        <label className="field">
          <span className="field__label">Display name</span>
          <input
            className="field__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Alex"
            maxLength={24}
            autoFocus
          />
        </label>
        <AvatarPicker value={avatar} onChange={setAvatar} layout="comfortable" />
        <button type="button" className="btn btn--primary btn--wide" onClick={go}>
          Continue
        </button>
      </div>
    </div>
  );
}
