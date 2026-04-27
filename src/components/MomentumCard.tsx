type MomentumCardProps = {
  streakDays: number;
  points: number;
};

const MAX_DEMO = 7;

/**
 * Gamification strip: streak + points + a thin progress bar.
 */
export function MomentumCard({ streakDays, points }: MomentumCardProps) {
  const p = Math.min(1, streakDays / Math.max(1, MAX_DEMO));
  return (
    <section className="momentum-card soft-card soft-card--compact" aria-label="Your momentum">
      <div className="momentum-card__row">
        <div>
          <p className="momentum-card__value">
            <strong>{streakDays}</strong> <span className="momentum-card__unit">day streak</span>
            <span className="momentum-card__dot" aria-hidden>
              {" "}
              ·{" "}
            </span>
            <strong>{points}</strong> <span className="momentum-card__unit">pts</span>
          </p>
        </div>
        <div className="momentum-card__bar" role="img" aria-label={`Streak fill about ${Math.round(p * 100)} percent`}>
          <span className="momentum-card__bar-fill" style={{ width: `${p * 100}%` }} />
        </div>
      </div>
    </section>
  );
}
