import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AvatarPicker } from "./AvatarPicker";
import { useSchedule } from "../context/ScheduleContext";
import { isFirebaseAuthConfigured } from "../lib/firebaseApp";
import type { AvatarFields } from "../types";

export function Onboarding() {
  const { setProfile, finishOnboarding, signInWithGoogle, t } = useSchedule();
  const navigate = useNavigate();
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
    navigate("/", { replace: true });
  };

  const google = async () => {
    setGoogleErr(null);
    setGoogleBusy(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("err_generic");
      setGoogleErr(msg);
    } finally {
      setGoogleBusy(false);
    }
  };

  return (
    <div className="onboard">
      <div className="onboard__card">
        <p className="eyebrow eyebrow--dark">{t("welcome_eyebrow")}</p>
        <h1 className="onboard__title">{t("onboard_title")}</h1>
        <p className="onboard__lede">{t("onboard_lede")}</p>
        {isFirebaseAuthConfigured() ? (
          <>
            <button
              type="button"
              className="btn btn--outline btn--wide onboard__google"
              onClick={() => void google()}
              disabled={googleBusy}
            >
              {googleBusy ? t("onboard_google_loading") : t("onboard_google")}
            </button>
            {googleErr ? <p className="onboard__err">{googleErr}</p> : null}
            <p className="onboard__or">{t("onboard_or")}</p>
          </>
        ) : (
          <p className="onboard__hint">{t("onboard_hint_env")}</p>
        )}
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
