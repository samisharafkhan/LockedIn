import { useEffect, useState } from "react";
import { Share2, Trash2, X } from "lucide-react";
import { ACTIVITIES } from "../data/activities";
import type { ActivityId, TimeBlock } from "../types";
import { useSchedule } from "../context/ScheduleContext";
import { ActivityIcon } from "./ActivityIcon";
import { TimeDigitPick } from "./TimeDigitPick";
import { hasConflict, isValidRange } from "../lib/scheduleBlocks";
import {
  digitsPeriodToHour24,
  hour24ToDigitsAndPeriod,
  timeDigitsIssues,
  type AmPm,
} from "../lib/timeDigits";

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
  onShare?: () => void;
};

export function BlockSheet({ open, mode, allBlocks, onClose, onSave, onDelete, onShare }: Props) {
  const { t } = useSchedule();
  const [activityId, setActivityId] = useState<ActivityId>("work");
  const [startDigits, setStartDigits] = useState("");
  const [startPeriod, setStartPeriod] = useState<AmPm>("AM");
  const [endDigits, setEndDigits] = useState("");
  const [endPeriod, setEndPeriod] = useState<AmPm>("PM");
  const [endMidnight, setEndMidnight] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !mode) return;
    if (mode.kind === "edit") {
      const b = mode.block;
      setActivityId(b.activityId);
      const s = hour24ToDigitsAndPeriod(b.startHour, b.startMinute);
      setStartDigits(s.digits);
      setStartPeriod(s.period);
      if (b.endHour === 24 && b.endMinute === 0) {
        setEndMidnight(true);
        setEndDigits("");
        setEndPeriod("PM");
      } else {
        setEndMidnight(false);
        const e = hour24ToDigitsAndPeriod(b.endHour, b.endMinute);
        setEndDigits(e.digits);
        setEndPeriod(e.period);
      }
    } else {
      setActivityId(mode.defaults.activityId);
      const s = hour24ToDigitsAndPeriod(mode.defaults.startHour, mode.defaults.startMinute);
      setStartDigits(s.digits);
      setStartPeriod(s.period);
      if (mode.defaults.endHour === 24 && mode.defaults.endMinute === 0) {
        setEndMidnight(true);
        setEndDigits("");
        setEndPeriod("PM");
      } else {
        setEndMidnight(false);
        const e = hour24ToDigitsAndPeriod(mode.defaults.endHour, mode.defaults.endMinute);
        setEndDigits(e.digits);
        setEndPeriod(e.period);
      }
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
    if (startDigits.length !== 4) {
      setError(t("block_err_time_incomplete"));
      return;
    }
    const startIssues = timeDigitsIssues(startDigits);
    if (startIssues.hour || startIssues.minute) {
      setError(t("block_err_time_invalid"));
      return;
    }
    const s24 = digitsPeriodToHour24(startDigits, startPeriod);
    if (!s24) {
      setError(t("block_err_time_invalid"));
      return;
    }

    let endHour: number;
    let endMinute: number;
    if (endMidnight) {
      endHour = 24;
      endMinute = 0;
    } else {
      if (endDigits.length !== 4) {
        setError(t("block_err_time_incomplete"));
        return;
      }
      const endIssues = timeDigitsIssues(endDigits);
      if (endIssues.hour || endIssues.minute) {
        setError(t("block_err_time_invalid"));
        return;
      }
      const e24 = digitsPeriodToHour24(endDigits, endPeriod);
      if (!e24) {
        setError(t("block_err_time_invalid"));
        return;
      }
      endHour = e24.hour;
      endMinute = e24.minute;
    }

    if (!isValidRange(s24.hour, s24.minute, endHour, endMinute)) {
      setError(t("block_err_range"));
      return;
    }
    const candidate = {
      id: mode.kind === "edit" ? mode.block.id : undefined,
      startHour: s24.hour,
      startMinute: s24.minute,
      endHour,
      endMinute,
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
    <div className="sheet sheet--fullscreen" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
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
            <div className="sheet__top-actions">
              {mode.kind === "edit" && onShare ? (
                <button type="button" className="icon-btn" onClick={onShare} aria-label={t("block_share")}>
                  <Share2 size={22} strokeWidth={2} />
                </button>
              ) : null}
              <button type="button" className="icon-btn" onClick={onClose} aria-label={t("block_close")}>
                <X size={22} strokeWidth={2} />
              </button>
            </div>
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

          <p className="sheet__section-label">{t("block_times_label")}</p>
          <p className="sheet__micro">{t("block_time_digits_hint")}</p>
          <div className="time-digit-grid">
            <TimeDigitPick
              label={t("block_starts")}
              digits={startDigits}
              period={startPeriod}
              onDigitsChange={setStartDigits}
              onPeriodChange={setStartPeriod}
            />
            <TimeDigitPick
              label={t("block_ends")}
              digits={endDigits}
              period={endPeriod}
              onDigitsChange={setEndDigits}
              onPeriodChange={setEndPeriod}
              disabled={endMidnight}
            />
          </div>
          <label className="time-digit-midnight">
            <input
              type="checkbox"
              checked={endMidnight}
              onChange={(e) => {
                setEndMidnight(e.target.checked);
                setError(null);
              }}
            />
            <span>{t("block_ends_midnight")}</span>
          </label>
          <p className="sheet__micro">{t("block_tip_midnight_short")}</p>

          {error ? <p className="sheet__error">{error}</p> : null}
        </div>

        <div className="sheet__footer">
          {mode.kind === "edit" && onShare ? (
            <button type="button" className="btn btn--outline btn--wide sheet__share-first" onClick={onShare}>
              <Share2 size={18} strokeWidth={2} aria-hidden />
              {t("block_share")}
            </button>
          ) : null}
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
