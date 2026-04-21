import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSchedule } from "../context/ScheduleContext";
import { authErrorToKey } from "../lib/authErrors";
import { isFirebaseAuthConfigured } from "../lib/firebaseApp";
import { needsEmailVerification } from "../lib/authHelpers";

export function SignUpPage() {
  const { t, signUpWithEmail, firebaseUser } = useSchedule();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isFirebaseAuthConfigured()) return;
    if (!firebaseUser) return;
    if (needsEmailVerification(firebaseUser)) {
      navigate("/verify-email", { replace: true });
      return;
    }
    navigate("/", { replace: true });
  }, [firebaseUser, navigate]);

  const submit = async () => {
    setErr(null);
    if (password !== confirm) {
      setErr(t("err_auth_mismatch_password"));
      return;
    }
    if (password.length < 6) {
      setErr(t("err_auth_weak_password"));
      return;
    }
    setBusy(true);
    try {
      await signUpWithEmail(email.trim(), password);
      navigate("/verify-email", { replace: true });
    } catch (e: unknown) {
      const code = e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : undefined;
      setErr(t(authErrorToKey(code)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="onboard__card">
        <p className="eyebrow eyebrow--dark">{t("welcome_eyebrow")}</p>
        <h1 className="onboard__title">{t("signUp_title")}</h1>
        <p className="onboard__lede">{t("signUp_subtitle")}</p>

        <label className="field">
          <span className="field__label">{t("signUp_email")}</span>
          <input
            className="field__input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field__label">{t("signUp_password")}</span>
          <input
            className="field__input"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field__label">{t("signUp_confirm")}</span>
          <input
            className="field__input"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>

        {err ? <p className="onboard__err">{err}</p> : null}

        <button type="button" className="btn btn--primary btn--wide" disabled={busy} onClick={() => void submit()}>
          {busy ? t("common_loading") : t("signUp_submit")}
        </button>

        <p className="auth-switch">
          {t("signUp_has_account")}{" "}
          <Link to="/sign-in">{t("signIn_link")}</Link>
        </p>
        <Link to="/welcome" className="auth-back">
          {t("common_back")}
        </Link>
      </div>
    </div>
  );
}
