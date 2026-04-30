import { EmptyState } from "./EmptyState";
import { TimeBlock as TimelineTimeBlock } from "./TimeBlock";
import type { ActivityId } from "../types";

type TimelineBlock = {
  id: string;
  activityId: ActivityId;
  label: string;
  timeLabel: string;
  topPct: number;
  heightPct: number;
  leftPct?: number;
  widthPct?: number;
  rightTag?: string;
};

type ScheduleTimelineProps = {
  blocks: TimelineBlock[];
  onOpenBlock: (id: string) => void;
  emptyTitle: string;
  emptyDescription: string;
  startHour?: number;
  endHour?: number;
};

export function ScheduleTimeline({
  blocks,
  onOpenBlock,
  emptyTitle,
  emptyDescription,
  startHour = 8,
  endHour = 22,
}: ScheduleTimelineProps) {
  const hours: number[] = [];
  for (let hour = startHour; hour <= endHour; hour += 1) hours.push(hour);

  return (
    <div className="timeline-card" role="region" aria-label="Schedule timeline">
      <div className="timeline-grid" aria-hidden>
        {hours.map((hour) => (
          <div key={hour} className="timeline-grid__row">
            <span className="timeline-grid__label">
              {new Intl.DateTimeFormat(undefined, { hour: "numeric" }).format(new Date(2000, 0, 1, hour, 0))}
            </span>
            <span className="timeline-grid__line" />
          </div>
        ))}
      </div>

      <div className="timeline-blocks">
        {blocks.length === 0 ? (
          <EmptyState title={emptyTitle} description={emptyDescription} mascot />
        ) : (
          blocks.map((block) => (
            <TimelineTimeBlock
              key={block.id}
              activityId={block.activityId}
              label={block.label}
              timeLabel={block.timeLabel}
              top={`${block.topPct}%`}
              height={`${Math.max(block.heightPct, 2.8)}%`}
              left={typeof block.leftPct === "number" ? `${block.leftPct}%` : undefined}
              width={typeof block.widthPct === "number" ? `${Math.max(block.widthPct, 12)}%` : undefined}
              rightTag={block.rightTag}
              onClick={() => onOpenBlock(block.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
