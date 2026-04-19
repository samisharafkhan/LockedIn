import { useState } from "react";
import { AvatarPicker } from "./AvatarPicker";
import { useSchedule } from "../context/ScheduleContext";
import type { AvatarFields } from "../types";

export function Onboarding() {
  const { setProfile, finishOnboarding } = useSchedule();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<AvatarFields>({
    avatarEmoji: "◆",
    avatarAnimalId: null,
    avatarImageDataUrl: null,
  });

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

  return (
    <div className="onboard">
      <div className="onboard__card">
        <p className="eyebrow eyebrow--dark">LockedIn</p>
        <h1 className="onboard__title">Let’s set you up</h1>
        <p className="onboard__lede">
          Add a photo, pick a minimal animal, or keep a symbol — same vibe as the rest of the app.
        </p>
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
