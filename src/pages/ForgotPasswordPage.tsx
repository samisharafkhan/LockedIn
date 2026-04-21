import { useState } from "react";
import { Link } from "react-router-dom";
import { useSchedule } from "../context/ScheduleContext";
import { authErrorToKey } from "../lib/authErrors";

export function ForgotPasswordPage() {
  const { t, sendPasswordReset } = useSchedule();
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr(null);
    setBusy(true);
    try {
      await sendPasswordReset(email.trim());
      setDone(true);
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
        <h1 className="onboard__title">{t("forgot_title")}</h1>
        <p className="onboard__lede">{t("forgot_subtitle")}</p>

        {done ? (
          <p className="onboard__lede">{t("verify_sent")}</p>
        ) : (
          <>
            <label className="field">
              <span className="field__label">{t("forgot_email")}</span>
              <input
                className="field__input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            {err ? <p className="onboard__err">{err}</p> : null}
            <button
              type="button"
              className="btn btn--primary btn--wide"
              disabled={busy}
              onClick={() => void submit()}
            >
              {busy ? t("common_loading") : t("forgot_send")}
            </button>
          </>
        )}

        <Link to="/sign-in" className="auth-back">
          {t("forgot_back")}
        </Link>
      </div>
    </div>
  );
}
