import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AvatarPicker } from "./AvatarPicker";
import { useSchedule } from "../context/ScheduleContext";
import type { AvatarFields } from "../types";

function normalizeOnboardingHandle(name: string): string {
  const base = name.trim().toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9_]/g, "");
  return (base || "friend").slice(0, 24);
}

export function Onboarding() {
  const { setProfile, finishOnboarding, t } = useSchedule();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<AvatarFields>({
    avatarEmoji: "◆",
    avatarAnimalId: null,
    avatarImageDataUrl: null,
  });

  const go = () => {
    const trimmed = name.trim() || "Friend";
    const handle = normalizeOnboardingHandle(trimmed);
    setProfile({
      displayName: trimmed,
      handle,
      ...avatar,
    });
    finishOnboarding();
    navigate("/", { replace: true });
  };

  return (
    <div className="onboard">
      <div className="onboard__card">
        <p className="eyebrow eyebrow--dark">{t("welcome_eyebrow")}</p>
        <h1 className="onboard__title">{t("onboard_title")}</h1>
        <p className="onboard__lede">{t("onboard_lede")}</p>
        <p className="onboard__hint">{t("onboard_username_hint")}</p>
        <label className="field">
          <span className="field__label">{t("onboard_name_label")}</span>
          <input
            className="field__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("onboard_placeholder")}
            maxLength={24}
            autoFocus
          />
        </label>
        <AvatarPicker value={avatar} onChange={setAvatar} layout="comfortable" />
        <button type="button" className="btn btn--primary btn--wide" onClick={go}>
          {t("onboard_continue")}
        </button>
      </div>
    </div>
  );
}
