import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useSchedule } from "../context/ScheduleContext";
import { EventShareThread } from "../components/EventShareThread";

/**
 * Open a shared event by URL (/s/:shareId). Thread + permissions live in Firestore.
 */
export function SharedEventPage() {
  const { t } = useSchedule();
  const { shareId } = useParams<{ shareId: string }>();
  const navigate = useNavigate();
  if (!shareId) {
    return (
      <div className="auth-page">
        <p className="onboard__err">{t("event_share_unavailable")}</p>
        <button type="button" className="btn btn--outline" onClick={() => navigate("/")}>
          {t("common_back")}
        </button>
      </div>
    );
  }

  return (
    <div className="app shared-event-app">
      <header className="top shared-event-top">
        <button
          type="button"
          className="shared-event-back icon-btn"
          onClick={() => navigate(-1)}
          aria-label={t("common_back")}
        >
          <ArrowLeft size={22} strokeWidth={2} />
        </button>
        <div>
          <p className="top__brand">{t("event_shared_breadcrumb")}</p>
          <h1 className="shared-event-title">{t("event_shared_title")}</h1>
        </div>
        <div className="shared-event-top-spacer" aria-hidden />
      </header>
      <main className="main main--shared-event">
        <div className="shared-event-panel glass-panel">
          <EventShareThread shareId={shareId} onClose={() => navigate("/")} />
        </div>
      </main>
    </div>
  );
}
