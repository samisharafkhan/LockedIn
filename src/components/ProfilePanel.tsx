import { useEffect, useMemo, useState } from "react";
import { LogOut, X } from "lucide-react";
import { activityById } from "../data/activities";
import { useSchedule } from "../context/ScheduleContext";
import { PulsePanel } from "./PulsePanel";
import { hoursByActivityLastNDays, hoursForActivityOnDay } from "../lib/weekStats";
import { lastNDayKeys, weekdayShort } from "../lib/dates";
import type { ActivityId } from "../types";

const MARKS = ["◆", "◇", "◎", "✶", "⌁", "☽", "○"];

export function ProfilePanel() {
  const {
    profile,
    setProfile,
    scheduleByDay,
    followingIds,
    pulse,
  } = useSchedule();
  const [showReset, setShowReset] = useState(false);
  const [name, setName] = useState(profile.displayName);
  const [mark, setMark] = useState(profile.avatarEmoji);
  const [metric, setMetric] = useState<ActivityId | null>(null);

  useEffect(() => {
    setName(profile.displayName);
    setMark(profile.avatarEmoji);
  }, [profile.displayName, profile.avatarEmoji]);

  const totals = useMemo(() => hoursByActivityLastNDays(scheduleByDay, 7), [scheduleByDay]);

  const weekKeys = useMemo(() => lastNDayKeys(7).slice().reverse(), []);

  const feedItems = useMemo(() => {
    const items: { id: ActivityId; hours: number; label: string }[] = [];
    for (const [id, h] of totals.entries()) {
      if (h >= 0.25) {
        items.push({ id, hours: h, label: activityById(id).label });
      }
    }
    return items.sort((a, b) => b.hours - a.hours);
  }, [totals]);

  const maxDayHours = useMemo(() => {
    if (!metric) return 1;
    return Math.max(
      0.5,
      ...weekKeys.map((d) => hoursForActivityOnDay(scheduleByDay, d, metric)),
    );
  }, [metric, scheduleByDay, weekKeys]);

  const saveProfile = () => {
    const trimmed = name.trim() || profile.displayName;
    const handle = trimmed.toLowerCase().replace(/\s+/g, "") || profile.handle;
    setProfile({ displayName: trimmed, handle, avatarEmoji: mark });
  };

  const resetLocal = () => {
    localStorage.removeItem("lockedin:v1");
    window.location.reload();
  };

  return (
    <section className="profile" aria-labelledby="profile-heading">
      <div className="profile__hero">
        <div className="profile__avatar" aria-hidden>
          {profile.avatarEmoji}
        </div>
        <div className="profile__hero-text">
          <h2 id="profile-heading" className="profile__name">
            {profile.displayName}
          </h2>
          <p className="profile__handle">@{profile.handle}</p>
          <div className="profile__stats">
            <div>
              <p className="profile__stat-num">{followingIds.length}</p>
              <p className="profile__stat-label">Following</p>
            </div>
            <div>
              <p className="profile__stat-num">—</p>
              <p className="profile__stat-label">Followers</p>
            </div>
            <div>
              <p className="profile__stat-num">{pulse ? "1" : "0"}</p>
              <p className="profile__stat-label">Pulse</p>
            </div>
          </div>
          <p className="profile__bio">
            Weekly metrics are built from the blocks you save on each day in Build.
          </p>
        </div>
      </div>

      <div className="profile__section">
        <h3 className="profile__h3">This week</h3>
        <div className="metric-feed">
          {feedItems.length === 0 ? (
            <p className="friends__muted">
              Add a few days of blocks to see “studied X hours this week” style cards here.
            </p>
          ) : (
            feedItems.map((it) => (
              <button
                key={it.id}
                type="button"
                className="metric-card"
                onClick={() => setMetric(it.id)}
              >
                <p className="metric-card__eyebrow">Last 7 days</p>
                <p className="metric-card__title">
                  <strong>{profile.displayName}</strong> logged{" "}
                  <strong>{it.hours.toFixed(1)}h</strong> on {it.label.toLowerCase()}
                </p>
                <p className="metric-card__hint">Tap for day-by-day distribution</p>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="profile__section profile__section--tight">
        <h3 className="profile__h3">Now</h3>
        <PulsePanel embedded />
      </div>

      <div className="me__card">
        <h3 className="me__card-title">Edit profile</h3>
        <label className="me__field">
          <span>Display name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} />
        </label>
        <p className="me__field-label">Mark</p>
        <div className="me__marks" role="listbox" aria-label="Avatar mark">
          {MARKS.map((m) => (
            <button
              key={m}
              type="button"
              className={`me__mark ${m === mark ? "me__mark--on" : ""}`}
              onClick={() => setMark(m)}
              aria-pressed={m === mark}
            >
              {m}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn--primary me__save" onClick={saveProfile}>
          Save profile
        </button>
      </div>

      <div className="me__card">
        <h3 className="me__card-title">Data on this device</h3>
        <p className="me__card-body">
          Schedules, follows, and pulses stay in this browser until you reset.
        </p>
        {!showReset ? (
          <button type="button" className="btn btn--outline" onClick={() => setShowReset(true)}>
            Reset app data…
          </button>
        ) : (
          <div className="me__confirm">
            <p className="me__warn">This clears your schedule, follows, pulse, and profile.</p>
            <div className="me__confirm-row">
              <button type="button" className="btn btn--ghost" onClick={() => setShowReset(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn--danger" onClick={resetLocal}>
                <LogOut size={18} strokeWidth={2} aria-hidden />
                Reset
              </button>
            </div>
          </div>
        )}
      </div>

      {metric ? (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="metric-title">
          <button type="button" className="modal__backdrop" aria-label="Close" onClick={() => setMetric(null)} />
          <div className="modal__panel">
            <div className="modal__top">
              <h3 id="metric-title">{activityById(metric).label} · 7-day spread</h3>
              <button type="button" className="icon-btn" onClick={() => setMetric(null)} aria-label="Close">
                <X size={22} strokeWidth={2} />
              </button>
            </div>
            <p className="modal__lede">Hours from your saved blocks per day.</p>
            <div className="bar-chart">
              {weekKeys.map((day) => {
                const h = hoursForActivityOnDay(scheduleByDay, day, metric);
                const pct = Math.round((h / maxDayHours) * 100);
                return (
                  <div key={day} className="bar-chart__col">
                    <div className="bar-chart__track" title={`${h.toFixed(1)}h`}>
                      <div className="bar-chart__fill" style={{ height: `${pct}%` }} />
                    </div>
                    <p className="bar-chart__label">{weekdayShort(day)}</p>
                    <p className="bar-chart__sub">{h.toFixed(1)}h</p>
                  </div>
                );
              })}
            </div>
            <p className="modal__foot">Activity: {activityById(metric).hint}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
