import { useMemo } from "react";
import { useSchedule } from "../context/ScheduleContext";
import { ActivityIcon } from "./ActivityIcon";
import { layoutDayBlocks } from "../lib/calendarLayout";
import { formatHm } from "../lib/time";
import type { TimeBlock } from "../types";

type Props = {
  blocks: TimeBlock[];
};

/**
 * Day column matching Build — read-only, no “now” line (snapshot of a posted day).
 */
export function ReadOnlyDayCalendar({ blocks }: Props) {
  const { t } = useSchedule();
  const hours = useMemo(() => {
    const list: number[] = [];
    for (let h = 0; h <= 23; h += 1) list.push(h);
    return list;
  }, []);
  const dayLayouts = useMemo(() => layoutDayBlocks(blocks), [blocks]);

  return (
    <div className="cal cal--readonly cal--glass">
      <div className="cal__grid" aria-hidden>
        {hours.map((h) => (
          <div key={h} className="cal__hour-row">
            <span className="cal__hour-label">
              {new Intl.DateTimeFormat(undefined, { hour: "numeric" }).format(new Date(2000, 0, 1, h, 0))}
            </span>
            <span className="cal__hour-line" />
          </div>
        ))}
      </div>

      <div className="cal__blocks">
        {blocks.length === 0 ? (
          <div className="cal__empty">
            <p className="cal__empty-title">{t("feed_calendar_empty_title")}</p>
            <p className="cal__empty-text">{t("feed_calendar_empty_sub")}</p>
          </div>
        ) : null}
        {blocks.map((b) => {
          const L = dayLayouts.get(b.id);
          if (!L) return null;
          return (
            <div
              key={b.id}
              className="cal__block cal__block--readonly"
              style={{
                top: `${L.topPct}%`,
                height: `${Math.max(L.heightPct, 0.3)}%`,
                left: `calc(${L.leftPct}% + 1px)`,
                width: `calc(${L.widthPct}% - 2px)`,
                right: "auto",
              }}
            >
              <span className="cal__block-icon" aria-hidden>
                <ActivityIcon id={b.activityId} size={18} />
              </span>
              <span className="cal__block-text">
                <span className="cal__block-name">{t(`act_${b.activityId}_label`)}</span>
                <span className="cal__block-time">
                  {formatHm(b.startHour, b.startMinute)} –{" "}
                  {b.endHour === 24 && b.endMinute === 0
                    ? t("schedule_midnight")
                    : formatHm(b.endHour, b.endMinute)}
                </span>
                {b.outcome === "done" ? (
                  <span className="cal__badge cal__badge--done">{t("schedule_badge_done")}</span>
                ) : null}
                {b.outcome === "not_done" ? (
                  <span className="cal__badge cal__badge--miss">{t("schedule_badge_missed")}</span>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
