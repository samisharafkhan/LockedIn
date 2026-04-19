import { ACTIVITIES, activityById } from "../data/activities";
import { AvatarDisplay } from "./AvatarDisplay";
import { useSchedule } from "../context/ScheduleContext";
import { ActivityIcon } from "./ActivityIcon";

function formatTime(ts: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ts));
}

type Props = {
  /** Compact layout when nested inside Profile */
  embedded?: boolean;
};

export function PulsePanel({ embedded }: Props) {
  const { pulse, setPulse, clearPulse, profile } = useSchedule();

  return (
    <section
      className={`pulse ${embedded ? "pulse--embedded" : ""}`}
      aria-labelledby={embedded ? undefined : "pulse-heading"}
      aria-label={embedded ? "Pulse" : undefined}
    >
      {!embedded ? (
        <div className="pulse__head">
          <div>
            <p className="eyebrow eyebrow--dark">Right now</p>
            <h2 id="pulse-heading" className="pulse__title">
              What are you doing?
            </h2>
            <p className="pulse__sub">
              One tap. Friends see the label, not your whole calendar.
            </p>
          </div>
          <div className="avatar-ring" aria-hidden>
            <AvatarDisplay source={profile} size="md" />
          </div>
        </div>
      ) : (
        <p className="pulse__embed-lede">Set a quick pulse for friends to see alongside your week.</p>
      )}

      {pulse ? (
        <div className="pulse__active">
          <div className="pulse__active-row">
            <span className="pulse__active-icon" aria-hidden>
              <ActivityIcon id={pulse.activityId} size={28} />
            </span>
            <div>
              <p className="pulse__active-label">You’re in</p>
              <p className="pulse__active-value">{activityById(pulse.activityId).label}</p>
              <p className="pulse__active-meta">{formatTime(pulse.at)}</p>
            </div>
          </div>
          <button type="button" className="btn btn--ghost" onClick={clearPulse}>
            Clear
          </button>
        </div>
      ) : (
        <p className="pulse__hint">Pick what matches your moment — you can change it anytime.</p>
      )}

      <div className="pulse__strip" role="list">
        {ACTIVITIES.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`pulse-chip ${pulse?.activityId === a.id ? "pulse-chip--on" : ""}`}
            onClick={() => setPulse(a.id)}
          >
            <span className="pulse-chip__icon" aria-hidden>
              <ActivityIcon id={a.id} size={22} />
            </span>
            <span className="pulse-chip__text">
              <span className="pulse-chip__name">{a.label}</span>
              <span className="pulse-chip__hint">{a.hint}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
