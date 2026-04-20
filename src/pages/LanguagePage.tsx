import { useSearchParams, useNavigate } from "react-router-dom";
import { LOCALE_OPTIONS, type AppLocale } from "../i18n/locales";
import { useSchedule } from "../context/ScheduleContext";

export function LanguagePage() {
  const { t, locale, setLocale, completeLanguageOnboarding } = useSchedule();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const fromSettings = params.get("from") === "settings";

  const pick = (id: AppLocale) => {
    setLocale(id);
    if (fromSettings) {
      navigate(-1);
      return;
    }
    completeLanguageOnboarding();
    navigate("/welcome", { replace: true });
  };

  return (
    <div className="auth-page">
      <div className="onboard__card onboard__card--wide">
        <p className="eyebrow eyebrow--dark">{t("welcome_eyebrow")}</p>
        <h1 className="onboard__title">{t("language_title")}</h1>
        <p className="onboard__lede">{t("language_subtitle")}</p>

        <ul className="language-grid" role="list">
          {LOCALE_OPTIONS.map((opt) => (
            <li key={opt.id}>
              <button
                type="button"
                className={`language-card ${locale === opt.id ? "language-card--on" : ""}`}
                onClick={() => pick(opt.id)}
              >
                <span className="language-card__native">{opt.nativeLabel}</span>
                <span className="language-card__label">{opt.label}</span>
              </button>
            </li>
          ))}
        </ul>

        {fromSettings ? (
          <button type="button" className="btn btn--outline btn--wide" onClick={() => navigate(-1)}>
            {t("common_back")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
