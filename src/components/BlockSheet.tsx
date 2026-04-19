import { useEffect, useState } from "react";
import { Trash2, X } from "lucide-react";
import { ACTIVITIES } from "../data/activities";
import type { ActivityId, TimeBlock } from "../types";
import { ActivityIcon } from "./ActivityIcon";
import {
  formatTimeValue,
  hasConflict,
  isValidRange,
  parseTimeValue,
} from "../lib/scheduleBlocks";

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
      setError("Use times like 09:00 or end 24:00 for midnight.");
      return;
    }
    if (!isValidRange(s.hour, s.minute, eParsed.hour, eParsed.minute)) {
      setError("End needs to be after start (same day).");
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
      setError("That time overlaps another block.");
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
      <button type="button" className="sheet__backdrop" aria-label="Close" onClick={onClose} />
      <div className="sheet__panel">
        <div className="sheet__grab" aria-hidden />
        <div className="sheet__top">
          <h2 id="sheet-title" className="sheet__title">
            {mode.kind === "edit" ? "Edit block" : "New block"}
          </h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={22} strokeWidth={2} />
          </button>
        </div>
        <p className="sheet__lede">Pick what it is, then set start and end.</p>

        <p className="sheet__section-label">Type</p>
        <div className="activity-pick" role="listbox" aria-label="Activity type">
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
                <span className="activity-pick__name">{a.label}</span>
                <span className="activity-pick__hint">{a.hint}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="time-grid">
          <label className="time-field">
            <span className="time-field__label">Starts</span>
            <input
              className="time-field__input"
              type="time"
              value={startStr.length === 5 ? startStr : "09:00"}
              onChange={(ev) => setStartStr(ev.target.value)}
              step={300}
            />
          </label>
          <label className="time-field">
            <span className="time-field__label">Ends</span>
            <input
              className="time-field__input"
              type="text"
              inputMode="numeric"
              placeholder="18:00 or 24:00"
              value={endStr}
              onChange={(ev) => setEndStr(ev.target.value)}
              autoComplete="off"
            />
          </label>
        </div>
        <p className="sheet__micro">Tip: use 24:00 for “through midnight”.</p>

        {error ? <p className="sheet__error">{error}</p> : null}

        <div className="sheet__actions">
          {mode.kind === "edit" && onDelete ? (
            <button type="button" className="btn btn--danger-ghost" onClick={del}>
              <Trash2 size={18} strokeWidth={2} aria-hidden />
              Delete
            </button>
          ) : (
            <span />
          )}
          <button type="button" className="btn btn--primary" onClick={submit}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
