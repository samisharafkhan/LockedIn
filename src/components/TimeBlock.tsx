import { ActivityIcon } from "./ActivityIcon";
import type { ActivityId } from "../types";

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
  tone?: "sage" | "blue" | "purple" | "butter" | "beige";
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
  tone = "beige",
}: TimeBlockProps) {
  return (
    <button
      type="button"
      className={`timeline-block timeline-block--${tone}`}
      style={{ top, height, ...(left ? { left } : {}), ...(width ? { width } : {}) }}
      onClick={onClick}
      aria-label={`${label} ${timeLabel}`}
    >
      <span className="timeline-block__left">
        <span className="timeline-block__icon" aria-hidden>
          <ActivityIcon id={activityId} size={16} />
        </span>
        <span>
          <span className="timeline-block__label">{label}</span>
          <span className="timeline-block__time">{timeLabel}</span>
        </span>
      </span>
      {rightTag ? <span className="timeline-block__tag">{rightTag}</span> : null}
    </button>
  );
}
