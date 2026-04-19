import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { activityById } from "../data/activities";
import { useSchedule } from "../context/ScheduleContext";
import { ActivityIcon } from "./ActivityIcon";
import { BlockSheet } from "./BlockSheet";
import type { TimeBlock } from "../types";
import { blockEndMinutesExclusive, blockStartMinutes, defaultNewBlockRange } from "../lib/scheduleBlocks";
import { formatHm } from "../lib/time";

const VIEW_START_MIN = 0;
const VIEW_END_MIN = 24 * 60;

function blockLayout(b: TimeBlock) {
  const s = blockStartMinutes(b);
  const e = blockEndMinutesExclusive(b);
  const viewLen = VIEW_END_MIN - VIEW_START_MIN;
  const clipS = Math.max(s, VIEW_START_MIN);
  const clipE = Math.min(e, VIEW_END_MIN);
  if (clipE <= clipS) return null;
  const top = ((clipS - VIEW_START_MIN) / viewLen) * 100;
  const height = ((clipE - clipS) / viewLen) * 100;
  return { top, height };
}

function todayLabel() {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date());
}

export function SchedulePanel() {
  const { blocks, profile, addBlock, updateBlock, removeBlock } = useSchedule();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<
    | { kind: "add"; defaults: Omit<TimeBlock, "id"> }
    | { kind: "edit"; block: TimeBlock }
    | null
  >(null);

  const hours = useMemo(() => {
    const list: number[] = [];
    for (let h = 0; h <= 23; h += 1) list.push(h);
    return list;
  }, []);

  const openAdd = () => {
    const d = defaultNewBlockRange();
    setSheetMode({
      kind: "add",
      defaults: {
        ...d,
        activityId: "work",
      },
    });
    setSheetOpen(true);
  };

  const openEdit = (b: TimeBlock) => {
    setSheetMode({ kind: "edit", block: b });
    setSheetOpen(true);
  };

  const onSave = (payload: Omit<TimeBlock, "id"> & { id?: string }) => {
    if (payload.id) {
      updateBlock(payload.id, {
        startHour: payload.startHour,
        startMinute: payload.startMinute,
        endHour: payload.endHour,
        endMinute: payload.endMinute,
        activityId: payload.activityId,
      });
    } else {
      addBlock({
        startHour: payload.startHour,
        startMinute: payload.startMinute,
        endHour: payload.endHour,
        endMinute: payload.endMinute,
        activityId: payload.activityId,
      });
    }
  };

  return (
    <section className="schedule" aria-labelledby="sched-heading">
      <div className="schedule__intro">
        <div>
          <p className="eyebrow eyebrow--dark">Today</p>
          <h2 id="sched-heading" className="schedule__title">
            {todayLabel()}
          </h2>
          <p className="schedule__sub">Build your day — tap a block to edit, or add a new one.</p>
        </div>
        <button type="button" className="avatar-ring" aria-label="You">
          <span className="avatar-ring__glyph">{profile.avatarEmoji}</span>
        </button>
      </div>

      <div className="cal">
        <div className="cal__grid" aria-hidden>
          {hours.map((h) => (
            <div key={h} className="cal__hour-row">
              <span className="cal__hour-label">
                {new Intl.DateTimeFormat(undefined, { hour: "numeric" }).format(
                  new Date(2000, 0, 1, h, 0),
                )}
              </span>
              <span className="cal__hour-line" />
            </div>
          ))}
        </div>

        <div className="cal__blocks">
          {blocks.length === 0 ? (
            <div className="cal__empty">
              <p className="cal__empty-title">Nothing here yet</p>
              <p className="cal__empty-text">Add your first block — it takes a few seconds.</p>
            </div>
          ) : null}
          {blocks.map((b) => {
            const layout = blockLayout(b);
            if (!layout) return null;
            const a = activityById(b.activityId);
            return (
              <button
                key={b.id}
                type="button"
                className="cal__block"
                style={{ top: `${layout.top}%`, height: `${Math.max(layout.height, 3)}%` }}
                onClick={() => openEdit(b)}
              >
                <span className="cal__block-icon" aria-hidden>
                  <ActivityIcon id={b.activityId} size={18} />
                </span>
                <span className="cal__block-text">
                  <span className="cal__block-name">{a.label}</span>
                  <span className="cal__block-time">
                    {formatHm(b.startHour, b.startMinute)} –{" "}
                    {b.endHour === 24 && b.endMinute === 0
                      ? "midnight"
                      : formatHm(b.endHour, b.endMinute)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <button type="button" className="fab" onClick={openAdd} aria-label="Add calendar block">
        <Plus size={26} strokeWidth={2.25} />
      </button>

      <BlockSheet
        open={sheetOpen}
        mode={sheetMode}
        allBlocks={blocks}
        onClose={() => {
          setSheetOpen(false);
          setSheetMode(null);
        }}
        onSave={onSave}
        onDelete={removeBlock}
      />
    </section>
  );
}
