import { useEffect, useState } from "react";
import { Trash2, X } from "lucide-react";
import { ACTIVITIES } from "../data/activities";
import type { ActivityId, TimeBlock } from "../types";
import { useSchedule } from "../context/ScheduleContext";
import { ActivityIcon } from "./ActivityIcon";
import {
  formatTimeValue,
  hasConflict,
  isValidRange,
  parseTimeValue,
} from "../lib/scheduleBlocks";

/** `<input type="time">` may emit `HH:MM:SS`; normalize so parsing and display stay in sync. */
function normalizeTimeFieldInput(value: string) {
  const raw = value.trim();
  const m = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (!m) return raw;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return raw;
  const hh = Math.min(23, Math.max(0, h));
  const mm = Math.min(59, Math.max(0, min));
  return `${hh.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`;
}

type Mode = { kind: "add"; defaults: Omit<TimeBlock, "id" | "activityId"> & { activityId: ActivityId } } | {
  kind: "edit";
  block: TimeBlock;
};

type Props = {
  open: boolean;
  mode: Mode | null;
  allBlocks: TimeBlock[];
  onClose: () => void;
  onSave: (block: Omit<TimeBlock, "id"> & { id?: string }) => void;
  onDelete?: (id: string) => void;
};

export function BlockSheet({ open, mode, allBlocks, onClose, onSave, onDelete }: Props) {
  const { t } = useSchedule();
  const [activityId, setActivityId] = useState<ActivityId>("work");
  const [startStr, setStartStr] = useState("09:00");
  const [endStr, setEndStr] = useState("10:00");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !mode) return;
    if (mode.kind === "edit") {
      const b = mode.block;
      setActivityId(b.activityId);
      setStartStr(formatTimeValue(b.startHour, b.startMinute));
      setEndStr(
        b.endHour === 24 && b.endMinute === 0 ? "24:00" : formatTimeValue(b.endHour, b.endMinute),
      );
    } else {
      setActivityId(mode.defaults.activityId);
      setStartStr(formatTimeValue(mode.defaults.startHour, mode.defaults.startMinute));
      setEndStr(
        mode.defaults.endHour === 24 && mode.defaults.endMinute === 0
          ? "24:00"
          : formatTimeValue(mode.defaults.endHour, mode.defaults.endMinute),
      );
    }
    setError(null);
  }, [open, mode]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !mode) return null;

  const submit = () => {
    const s = parseTimeValue(startStr);
    const eParsed = parseTimeValue(endStr);
    if (!s || !eParsed) {
      setError(t("block_err_time_format"));
      return;
    }
    if (!isValidRange(s.hour, s.minute, eParsed.hour, eParsed.minute)) {
      setError(t("block_err_range"));
      return;
    }
    const candidate = {
      id: mode.kind === "edit" ? mode.block.id : undefined,
      startHour: s.hour,
      startMinute: s.minute,
      endHour: eParsed.hour,
      endMinute: eParsed.minute,
      activityId,
    };
    if (hasConflict(allBlocks, candidate)) {
      setError(t("block_err_overlap"));
      return;
    }
    setError(null);
    onSave({ ...candidate, activityId });
    onClose();
  };

  const del = () => {
    if (mode.kind === "edit" && onDelete) {
      onDelete(mode.block.id);
      onClose();
    }
  };

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <button
        type="button"
        className="sheet__backdrop"
        aria-label={t("block_close")}
        onClick={onClose}
      />
      <div className="sheet__panel">
        <div className="sheet__head">
          <div className="sheet__grab" aria-hidden />
          <div className="sheet__top">
            <h2 id="sheet-title" className="sheet__title">
              {mode.kind === "edit" ? t("block_edit_title") : t("block_new_title")}
            </h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label={t("block_close")}>
              <X size={22} strokeWidth={2} />
            </button>
          </div>
        </div>
        <div className="sheet__body">
          <p className="sheet__lede">
            {mode.kind === "add" ? t("block_lede_add") : t("block_lede_edit")}
          </p>

          <p className="sheet__section-label">{t("block_type_label")}</p>
          <div className="activity-pick" role="listbox" aria-label={t("block_type_label")}>
            {ACTIVITIES.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`activity-pick__btn ${a.id === activityId ? "activity-pick__btn--on" : ""}`}
                onClick={() => setActivityId(a.id)}
                aria-pressed={a.id === activityId}
              >
                <ActivityIcon id={a.id} size={24} />
                <span className="activity-pick__text">
                  <span className="activity-pick__name">{t(`act_${a.id}_label`)}</span>
                  <span className="activity-pick__hint">{t(`act_${a.id}_hint`)}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="time-grid">
            <label className="time-field">
              <span className="time-field__label">{t("block_starts")}</span>
              <input
                className="time-field__input"
                type="time"
                value={startStr.length >= 5 ? startStr.slice(0, 5) : "09:00"}
                onChange={(ev) => setStartStr(normalizeTimeFieldInput(ev.target.value))}
                step={300}
              />
            </label>
            <label className="time-field">
              <span className="time-field__label">{t("block_ends")}</span>
              <input
                className="time-field__input"
                type="text"
                inputMode="text"
                placeholder={t("block_ends_ph")}
                value={endStr}
                onChange={(ev) => setEndStr(ev.target.value)}
                autoComplete="off"
              />
            </label>
          </div>
          <p className="sheet__micro">{t("block_tip_midnight")}</p>

          {error ? <p className="sheet__error">{error}</p> : null}
        </div>

        <div className="sheet__footer">
          <div className="sheet__actions sheet__actions--footer">
            {mode.kind === "edit" && onDelete ? (
              <button type="button" className="btn btn--danger-ghost" onClick={del}>
                <Trash2 size={18} strokeWidth={2} aria-hidden />
                {t("block_delete")}
              </button>
            ) : null}
            <button type="button" className="btn btn--primary btn--wide" onClick={submit}>
              {mode.kind === "add" ? t("block_add_calendar") : t("block_save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
