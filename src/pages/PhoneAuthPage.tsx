import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from "firebase/auth";
import { useSchedule } from "../context/ScheduleContext";
import { authErrorToKey } from "../lib/authErrors";
import { getFirebaseAuth } from "../lib/firebaseApp";
import { needsEmailVerification } from "../lib/authHelpers";
import { normalizePhoneE164 } from "../lib/phoneE164";
import type { AppLocale } from "../i18n/locales";

const RECAPTCHA_ELEMENT_ID = "lockedin-recaptcha-invisible";

function authLanguageFromLocale(locale: AppLocale): string {
  if (locale === "pt") return "pt-BR";
  return locale;
}

function readFirebaseAuthCode(err: unknown): string | undefined {
  if (!err || typeof err !== "object") return undefined;
  const o = err as Record<string, unknown>;
  if (typeof o.code === "string") return o.code;
  return undefined;
}

/**
 * Invisible reCAPTCHA: `signInWithPhoneNumber` runs the check when the user sends the code
 * (no separate checkbox; avoids token timing issues with the "normal" widget in some browsers).
 */
export function PhoneAuthPage() {
  const { t, firebaseUser, locale } = useSchedule();
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recaptchaKey, setRecaptchaKey] = useState(0);
  const confirmRef = useRef<ConfirmationResult | null>(null);
  const verifierRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    if (firebaseUser && !needsEmailVerification(firebaseUser)) {
      navigate("/", { replace: true });
    }
  }, [firebaseUser, navigate]);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) return;
    auth.languageCode = authLanguageFromLocale(locale);
  }, [locale]);

  useLayoutEffect(() => {
    if (step !== "phone") {
      try {
        verifierRef.current?.clear();
      } catch {
        /* ignore */
      }
      verifierRef.current = null;
      return;
    }

    const auth = getFirebaseAuth();
    if (!auth) return;

    try {
      verifierRef.current?.clear();
    } catch {
      /* ignore */
    }
    verifierRef.current = null;

    const rafId = requestAnimationFrame(() => {
      const el = document.getElementById(RECAPTCHA_ELEMENT_ID);
      if (!el) {
        return;
      }
      try {
        const v = new RecaptchaVerifier(
          auth,
          RECAPTCHA_ELEMENT_ID,
          {
            size: "invisible",
            callback: () => {
              /* token obtained; signInWithPhoneNumber consumes it */
            },
          },
        );
        verifierRef.current = v;
      } catch (e) {
        console.error("[LockedIn] RecaptchaVerifier failed:", e);
        setErr(t("err_auth_recaptcha_failed"));
      }
    });

    return () => {
      cancelAnimationFrame(rafId);
      try {
        verifierRef.current?.clear();
      } catch {
        /* ignore */
      }
      verifierRef.current = null;
    };
  }, [step, recaptchaKey]);

  const sendCode = async () => {
    setErr(null);
    const auth = getFirebaseAuth();
    const v = verifierRef.current;
    if (!auth) {
      setErr(t("onboard_hint_env"));
      return;
    }
    if (!v) {
      setErr(t("err_auth_recaptcha_failed"));
      return;
    }
    setBusy(true);
    try {
      const { e164, ok } = normalizePhoneE164(phone);
      if (!ok || !e164) {
        setErr(t("err_auth_invalid_phone"));
        return;
      }
      confirmRef.current = await signInWithPhoneNumber(auth, e164, v);
      setStep("code");
    } catch (e: unknown) {
      console.error("[LockedIn] signInWithPhoneNumber failed:", e);
      const codeErr = readFirebaseAuthCode(e);
      setErr(t(authErrorToKey(codeErr)));
      setRecaptchaKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setErr(null);
    setBusy(true);
    try {
      await confirmRef.current?.confirm(code.trim());
      navigate("/", { replace: true });
    } catch (e: unknown) {
      console.error("[LockedIn] phone confirm failed:", e);
      const codeErr = readFirebaseAuthCode(e);
      setErr(t(authErrorToKey(codeErr)));
    } finally {
      setBusy(false);
    }
  };

  const goBackToPhone = () => {
    setCode("");
    setErr(null);
    setStep("phone");
    setRecaptchaKey((k) => k + 1);
  };

  return (
    <div className="auth-page">
      <div className="onboard__card">
        <p className="eyebrow eyebrow--dark">{t("welcome_eyebrow")}</p>
        <h1 className="onboard__title">{t("phone_title")}</h1>
        <p className="onboard__lede">{t("phone_subtitle")}</p>
        <p className="onboard__hint">{t("phone_console_hint")}</p>
        {step === "phone" ? <p className="onboard__hint onboard__hint--tight">{t("phone_invisible_recaptcha_hint")}</p> : null}

        <div
          key={recaptchaKey}
          id={RECAPTCHA_ELEMENT_ID}
          className="auth-recaptcha-invisible-host"
          aria-hidden="true"
        />

        {step === "phone" ? (
          <>
            <label className="field">
              <span className="field__label">{t("phone_number_label")}</span>
              <input
                className="field__input"
                type="tel"
                autoComplete="tel"
                placeholder="+1 555 123 4567"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setErr(null);
                }}
              />
            </label>
            <p className="onboard__hint">{t("phone_hint")}</p>
          </>
        ) : (
          <>
            <label className="field">
              <span className="field__label">{t("phone_code_label")}</span>
              <input
                className="field__input"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </label>
            <button type="button" className="btn btn--ghost btn--wide" onClick={goBackToPhone}>
              {t("phone_change_number")}
            </button>
          </>
        )}

        {err ? <p className="onboard__err">{err}</p> : null}

        {step === "phone" ? (
          <button type="button" className="btn btn--primary btn--wide" disabled={busy} onClick={() => void sendCode()}>
            {busy ? t("phone_loading") : t("phone_send_code")}
          </button>
        ) : (
          <button type="button" className="btn btn--primary btn--wide" disabled={busy} onClick={() => void verify()}>
            {busy ? t("common_loading") : t("phone_verify")}
          </button>
        )}

        <Link to="/welcome" className="auth-back">
          {t("common_back")}
        </Link>
      </div>
    </div>
  );
}
