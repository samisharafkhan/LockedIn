import { ActivityIcon } from "./ActivityIcon";
import type { ActivityId } from "../types";
import { activityBlockChrome } from "../lib/activityBlockColors";

type TimeBlockProps = {
  activityId: ActivityId;
  label: string;
  timeLabel: string;
  top: string;
  height: string;
  left?: string;
  width?: string;
  onClick: () => void;
  rightTag?: string;
};

export function TimeBlock({
  activityId,
  label,
  timeLabel,
  top,
  height,
  left,
  width,
  onClick,
  rightTag,
}: TimeBlockProps) {
  const c = activityBlockChrome(activityId);

  return (
    <button
      type="button"
      className="timeline-block schedule-event-chip"
      style={{
        top,
        height,
        ...(left ? { left } : {}),
        ...(width ? { width } : {}),
        background: c.bg,
        borderColor: c.border,
        borderStyle: "solid",
        borderWidth: 2,
        color: c.fg,
        ["--evt-icon-fg" as string]: c.iconFg,
      }}
      onClick={onClick}
      aria-label={`${label} ${timeLabel}`}
    >
      <span className="timeline-block__left">
        <span className="timeline-block__icon schedule-event-chip__ico" aria-hidden>
          <ActivityIcon id={activityId} size={18} />
        </span>
        <span className="timeline-block__titles">
          <span className="timeline-block__label schedule-event-chip__title">{label}</span>
          <span className="timeline-block__time schedule-event-chip__time" style={{ color: c.fgMuted }}>
            {timeLabel}
          </span>
        </span>
      </span>
      {rightTag ? (
        <span className="timeline-block__tag schedule-event-chip__tag">{rightTag}</span>
      ) : null}
    </button>
  );
}
