import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSchedule } from "../context/ScheduleContext";
import { needsEmailVerification } from "../lib/authHelpers";
import { getFirebaseAuth } from "../lib/firebaseApp";

export function VerifyEmailPage() {
  const { t, firebaseUser, sendVerificationEmail, reloadFirebaseUser, signOutAuth } = useSchedule();
  const navigate = useNavigate();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!firebaseUser) {
      navigate("/welcome", { replace: true });
      return;
    }
    if (!needsEmailVerification(firebaseUser)) {
      navigate("/", { replace: true });
    }
  }, [firebaseUser, navigate]);

  const refresh = async () => {
    setErr(null);
    setBusy(true);
    try {
      await reloadFirebaseUser();
      const u = getFirebaseAuth()?.currentUser;
      if (u && !needsEmailVerification(u)) {
        navigate("/", { replace: true });
        return;
      }
      setErr(t("verify_still"));
    } catch {
      setErr(t("err_generic"));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      await sendVerificationEmail();
      setMsg(t("verify_sent"));
    } catch {
      setErr(t("err_generic"));
    } finally {
      setBusy(false);
    }
  };

  const out = async () => {
    await signOutAuth();
    navigate("/welcome", { replace: true });
  };

  return (
    <div className="auth-page">
      <div className="onboard__card">
        <h1 className="onboard__title">{t("verify_title")}</h1>
        <p className="onboard__lede">{t("verify_body")}</p>
        <p className="onboard__hint">{t("verify_check_spam")}</p>

        {msg ? <p className="onboard__lede">{msg}</p> : null}
        {err ? <p className="onboard__err">{err}</p> : null}

        <button type="button" className="btn btn--primary btn--wide" disabled={busy} onClick={() => void refresh()}>
          {busy ? t("common_loading") : t("verify_refresh")}
        </button>
        <button type="button" className="btn btn--outline btn--wide" disabled={busy} onClick={() => void resend()}>
          {t("verify_resend")}
        </button>
        <button type="button" className="btn btn--danger-ghost btn--wide" onClick={() => void out()}>
          {t("verify_sign_out")}
        </button>
      </div>
    </div>
  );
}
