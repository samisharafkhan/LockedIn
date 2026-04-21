import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSchedule } from "../context/ScheduleContext";
import { isFirebaseAuthConfigured } from "../lib/firebaseApp";
import { needsEmailVerification } from "../lib/authHelpers";

export function WelcomePage() {
  const { t, signInWithGoogle, firebaseUser } = useSchedule();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const authConfigured = isFirebaseAuthConfigured();

  useEffect(() => {
    if (!authConfigured) return;
    if (!firebaseUser) return;
    if (needsEmailVerification(firebaseUser)) {
      navigate("/verify-email", { replace: true });
      return;
    }
    navigate("/", { replace: true });
  }, [authConfigured, firebaseUser, navigate]);

  const google = async () => {
    if (!authConfigured) {
      setErr(t("onboard_hint_env"));
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("err_generic"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="onboard__card onboard__card--wide">
        <p className="eyebrow eyebrow--dark">{t("welcome_eyebrow")}</p>
        <h1 className="onboard__title">{t("welcome_title")}</h1>
        <p className="onboard__lede">{authConfigured ? t("welcome_subtitle") : t("onboard_hint_env")}</p>

        <div className="auth-option-stack">
          <button
            type="button"
            className="btn btn--outline btn--wide onboard__google"
            onClick={() => void google()}
            disabled={busy}
          >
            {busy ? t("onboard_google_loading") : t("welcome_google")}
          </button>
          {err ? <p className="onboard__err">{err}</p> : null}

          <p className="onboard__or">{t("auth_or")}</p>

          <Link to="/sign-up" className="btn btn--primary btn--wide">
            {t("welcome_sign_up")}
          </Link>
          <Link to="/sign-in" className="btn btn--outline btn--wide">
            {t("welcome_sign_in")}
          </Link>
          <Link to="/phone" className="btn btn--ghost btn--wide">
            {t("welcome_phone")}
          </Link>
        </div>
      </div>
    </div>
  );
}
