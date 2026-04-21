import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSchedule } from "../context/ScheduleContext";
import { authErrorToKey } from "../lib/authErrors";
import { isFirebaseAuthConfigured } from "../lib/firebaseApp";
import { needsEmailVerification } from "../lib/authHelpers";

export function SignInPage() {
  const { t, signInWithEmail, firebaseUser } = useSchedule();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    setBusy(true);
    try {
      await signInWithEmail(email.trim(), password);
      navigate("/", { replace: true });
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
        <h1 className="onboard__title">{t("signIn_title")}</h1>
        <p className="onboard__lede">{t("signIn_subtitle")}</p>

        <label className="field">
          <span className="field__label">{t("signIn_email")}</span>
          <input
            className="field__input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field__label">{t("signIn_password")}</span>
          <input
            className="field__input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {err ? <p className="onboard__err">{err}</p> : null}

        <button type="button" className="btn btn--primary btn--wide" disabled={busy} onClick={() => void submit()}>
          {busy ? t("common_loading") : t("signIn_submit")}
        </button>

        <p className="auth-switch">
          <Link to="/forgot-password">{t("signIn_forgot")}</Link>
        </p>
        <p className="auth-switch">
          {t("signIn_no_account")} <Link to="/sign-up">{t("signUp_link")}</Link>
        </p>
        <Link to="/welcome" className="auth-back">
          {t("common_back")}
        </Link>
      </div>
    </div>
  );
}
