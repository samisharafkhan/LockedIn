import type { ActivityId } from "../types";

type Stat = { id: ActivityId; hours: number; label: string };

type WeeklyStatsCardProps = {
  stats: Stat[];
  displayName: string;
  onSelectStat: (id: ActivityId) => void;
};

const COLORS: Record<string, string> = {
  work: "var(--tone-work, #C9B8A0)",
  commute: "var(--tone-commute, #C9D7E8)",
  focus: "var(--tone-focus, #AFC3A4)",
  class: "var(--tone-class, #D8CDEB)",
  gym: "var(--tone-gym, #EED4A3)",
  social: "var(--tone-social, #D8C5AE)",
  chill: "var(--tone-chill, #C9B8A0)",
  sleep: "var(--tone-sleep, #9a8f85)",
  travel: "var(--tone-travel, #C9D7E8)",
  default: "var(--line-strong)",
};

/**
 * One summary block: top 3 activities + a horizontal distribution bar.
 */
export function WeeklyStatsCard({ stats, displayName, onSelectStat }: WeeklyStatsCardProps) {
  const top = stats.slice(0, 3);
  const total = top.reduce((s, x) => s + x.hours, 0) || 1;
  if (top.length === 0) {
    return (
      <div className="weekly-stats soft-card">
        <h3 className="weekly-stats__h">This week</h3>
        <p className="weekly-stats__empty">Add blocks to your schedule to see a weekly picture.</p>
      </div>
    );
  }
  return (
    <div className="weekly-stats soft-card">
      <h3 className="weekly-stats__h">This week</h3>
      <ul className="weekly-stats__lines" role="list">
        {top.map((it) => (
          <li key={it.id} className="weekly-stats__line">
            <span className="weekly-stats__act">{it.label}</span>
            <span className="weekly-stats__hours">{it.hours.toFixed(1)}h</span>
          </li>
        ))}
      </ul>
      <div
        className="weekly-stats__bar"
        role="img"
        aria-label={`Time split for ${displayName} this week`}
      >
        {top.map((it) => {
          const w = (it.hours / total) * 100;
          const c = COLORS[it.id] ?? COLORS.default;
          return (
            <button
              key={it.id}
              type="button"
              className="weekly-stats__bar-seg"
              style={{ width: `${w}%`, background: c }}
              title={`${it.label} ${it.hours.toFixed(1)}h`}
              onClick={() => onSelectStat(it.id)}
            />
          );
        })}
      </div>
    </div>
  );
}
