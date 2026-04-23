import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from "firebase/auth";
import { useSchedule } from "../context/ScheduleContext";
import { authErrorToKey } from "../lib/authErrors";
import { getFirebaseAuth } from "../lib/firebaseApp";
import { needsEmailVerification } from "../lib/authHelpers";
import type { AppLocale } from "../i18n/locales";

const RECAPTCHA_CONTAINER_ID = "lockedin-phone-recaptcha";

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

export function PhoneAuthPage() {
  const { t, firebaseUser, locale } = useSchedule();
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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

  useEffect(() => {
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

    let cancelled = false;
    const raf = requestAnimationFrame(() => {
      if (cancelled) return;
      try {
        verifierRef.current?.clear();
      } catch {
        /* ignore */
      }
      verifierRef.current = null;
      const el = document.getElementById(RECAPTCHA_CONTAINER_ID);
      if (!el) return;
      try {
        verifierRef.current = new RecaptchaVerifier(auth, el, {
          size: "invisible",
          callback: () => {},
        });
      } catch (e) {
        console.error("[LockedIn] RecaptchaVerifier setup failed:", e);
        setErr(t("err_auth_recaptcha_failed"));
      }
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      try {
        verifierRef.current?.clear();
      } catch {
        /* ignore */
      }
      verifierRef.current = null;
    };
  }, [step, t]);

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
      const raw = phone.trim().replace(/\s+/g, "");
      const normalized = raw.startsWith("+") ? raw : `+${raw.replace(/^\+/, "")}`;
      confirmRef.current = await signInWithPhoneNumber(auth, normalized, v);
      setStep("code");
    } catch (e: unknown) {
      console.error("[LockedIn] signInWithPhoneNumber failed:", e);
      const codeErr = readFirebaseAuthCode(e);
      setErr(t(authErrorToKey(codeErr)));
      try {
        verifierRef.current?.clear();
      } catch {
        /* ignore */
      }
      verifierRef.current = null;
      const el = document.getElementById(RECAPTCHA_CONTAINER_ID);
      if (el && step === "phone" && getFirebaseAuth()) {
        try {
          verifierRef.current = new RecaptchaVerifier(getFirebaseAuth()!, el, {
            size: "invisible",
            callback: () => {},
          });
        } catch {
          /* ignore */
        }
      }
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

  return (
    <div className="auth-page">
      <div className="onboard__card">
        <p className="eyebrow eyebrow--dark">{t("welcome_eyebrow")}</p>
        <h1 className="onboard__title">{t("phone_title")}</h1>
        <p className="onboard__lede">{t("phone_subtitle")}</p>
        <p className="onboard__hint">{t("phone_console_hint")}</p>

        <div id={RECAPTCHA_CONTAINER_ID} className="auth-recaptcha-host" aria-hidden="true" />

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
                onChange={(e) => setPhone(e.target.value)}
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
            <button type="button" className="btn btn--ghost btn--wide" onClick={() => setStep("phone")}>
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
