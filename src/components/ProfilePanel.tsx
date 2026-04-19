import { useEffect, useMemo, useState } from "react";
import { LogOut, X } from "lucide-react";
import { activityById } from "../data/activities";
import { DEMO_FOLLOWERS } from "../data/demoFollowers";
import { useSchedule } from "../context/ScheduleContext";
import { AvatarDisplay } from "./AvatarDisplay";
import { AvatarPicker } from "./AvatarPicker";
import { PulsePanel } from "./PulsePanel";
import { ActivityIcon } from "./ActivityIcon";
import { hoursByActivityLastNDays, hoursForActivityOnDay } from "../lib/weekStats";
import { lastNDayKeys, weekdayShort } from "../lib/dates";
import type { ActivityId, AvatarFields } from "../types";

type StatSheet = "following" | "followers" | "pulse" | null;

export function ProfilePanel() {
  const {
    profile,
    setProfile,
    scheduleByDay,
    followingIds,
    pulse,
    clearPulse,
    getFriend,
  } = useSchedule();
  const [showReset, setShowReset] = useState(false);
  const [name, setName] = useState(profile.displayName);
  const [avatar, setAvatar] = useState<AvatarFields>({
    avatarEmoji: profile.avatarEmoji,
    avatarAnimalId: profile.avatarAnimalId ?? null,
    avatarImageDataUrl: profile.avatarImageDataUrl ?? null,
  });
  const [metric, setMetric] = useState<ActivityId | null>(null);
  const [statSheet, setStatSheet] = useState<StatSheet>(null);

  useEffect(() => {
    setName(profile.displayName);
    setAvatar({
      avatarEmoji: profile.avatarEmoji,
      avatarAnimalId: profile.avatarAnimalId ?? null,
      avatarImageDataUrl: profile.avatarImageDataUrl ?? null,
    });
  }, [profile.displayName, profile.avatarEmoji, profile.avatarAnimalId, profile.avatarImageDataUrl]);

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

  const maxTotalHours = useMemo(() => {
    let m = 0;
    for (const h of totals.values()) m = Math.max(m, h);
    return m || 1;
  }, [totals]);

  const pulseDist = useMemo(() => {
    const rows: { id: ActivityId; h: number }[] = [];
    for (const [id, h] of totals.entries()) {
      if (h >= 0.05) rows.push({ id, h });
    }
    return rows.sort((a, b) => b.h - a.h);
  }, [totals]);

  const maxDayHours = useMemo(() => {
    if (!metric) return 1;
    return Math.max(
      0.5,
      ...weekKeys.map((d) => hoursForActivityOnDay(scheduleByDay, d, metric)),
    );
  }, [metric, scheduleByDay, weekKeys]);

  const openMetric = (id: ActivityId) => {
    setStatSheet(null);
    setMetric(id);
  };

  const openStat = (kind: Exclude<StatSheet, null>) => {
    setMetric(null);
    setStatSheet(kind);
  };

  const closeSheets = () => {
    setMetric(null);
    setStatSheet(null);
  };

  const saveProfile = () => {
    const trimmed = name.trim() || profile.displayName;
    const handle = trimmed.toLowerCase().replace(/\s+/g, "") || profile.handle;
    setProfile({ displayName: trimmed, handle, ...avatar });
  };

  const resetLocal = () => {
    localStorage.removeItem("lockedin:v1");
    window.location.reload();
  };

  return (
    <section className="profile" aria-labelledby="profile-heading">
      <div className="profile__hero">
        <div className="profile__avatar" aria-hidden>
          <AvatarDisplay source={avatar} size="lg" />
        </div>
        <div className="profile__hero-text">
          <h2 id="profile-heading" className="profile__name">
            {profile.displayName}
          </h2>
          <p className="profile__handle">@{profile.handle}</p>
          <div className="profile__stats">
            <button type="button" className="profile__stat-btn" onClick={() => openStat("following")}>
              <p className="profile__stat-num">{followingIds.length}</p>
              <p className="profile__stat-label">Following</p>
            </button>
            <button type="button" className="profile__stat-btn" onClick={() => openStat("followers")}>
              <p className="profile__stat-num">{DEMO_FOLLOWERS.length}</p>
              <p className="profile__stat-label">Followers</p>
            </button>
            <button type="button" className="profile__stat-btn" onClick={() => openStat("pulse")}>
              <p className="profile__stat-num">{pulse ? "1" : "0"}</p>
              <p className="profile__stat-label">Pulse</p>
            </button>
          </div>
          <p className="profile__bio">
            Tap a stat for the full list or a weekly time mix. Weekly cards use saved blocks from Build.
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
                onClick={() => openMetric(it.id)}
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
        <AvatarPicker value={avatar} onChange={setAvatar} layout="comfortable" />
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

      {statSheet === "following" ? (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="following-title">
          <button type="button" className="modal__backdrop" aria-label="Close" onClick={closeSheets} />
          <div className="modal__panel">
            <div className="modal__top">
              <h3 id="following-title">Following</h3>
              <button type="button" className="icon-btn" onClick={closeSheets} aria-label="Close">
                <X size={22} strokeWidth={2} />
              </button>
            </div>
            <p className="modal__lede">People you follow in this demo.</p>
            {followingIds.length === 0 ? (
              <p className="friends__muted">You are not following anyone yet. Add friends from the Friends tab.</p>
            ) : (
              <ul className="modal-list">
                {followingIds.map((id) => {
                  const f = getFriend(id);
                  if (!f) return null;
                  return (
                    <li key={id} className="modal-list__row">
                      <span className="modal-list__mark" aria-hidden>
                        {f.mark}
                      </span>
                      <div>
                        <p className="modal-list__name">{f.displayName}</p>
                        <p className="modal-list__handle">@{f.handle}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {statSheet === "followers" ? (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="followers-title">
          <button type="button" className="modal__backdrop" aria-label="Close" onClick={closeSheets} />
          <div className="modal__panel">
            <div className="modal__top">
              <h3 id="followers-title">Followers</h3>
              <button type="button" className="icon-btn" onClick={closeSheets} aria-label="Close">
                <X size={22} strokeWidth={2} />
              </button>
            </div>
            <p className="modal__lede">Sample followers for the offline demo (not real accounts).</p>
            <ul className="modal-list">
              {DEMO_FOLLOWERS.map((f) => (
                <li key={f.id} className="modal-list__row">
                  <span className="modal-list__mark" aria-hidden>
                    {f.mark}
                  </span>
                  <div>
                    <p className="modal-list__name">{f.name}</p>
                    <p className="modal-list__handle">@{f.handle}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {statSheet === "pulse" ? (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="pulse-sheet-title">
          <button type="button" className="modal__backdrop" aria-label="Close" onClick={closeSheets} />
          <div className="modal__panel">
            <div className="modal__top">
              <h3 id="pulse-sheet-title">Pulse & time mix</h3>
              <button type="button" className="icon-btn" onClick={closeSheets} aria-label="Close">
                <X size={22} strokeWidth={2} />
              </button>
            </div>
            {pulse ? (
              <div className="pulse-sheet-active">
                <p className="modal__lede">Your active pulse</p>
                <div className="modal-list__row">
                  <span className="modal-list__mark" aria-hidden>
                    <ActivityIcon id={pulse.activityId} size={20} />
                  </span>
                  <div>
                    <p className="modal-list__name">{activityById(pulse.activityId).label}</p>
                    <p className="modal-list__handle">
                      {new Intl.DateTimeFormat(undefined, {
                        weekday: "short",
                        hour: "numeric",
                        minute: "2-digit",
                      }).format(new Date(pulse.at))}
                    </p>
                  </div>
                </div>
                <button type="button" className="btn btn--outline" style={{ marginTop: 10 }} onClick={clearPulse}>
                  Clear pulse
                </button>
              </div>
            ) : (
              <p className="modal__lede">No active pulse. Set one from the Now section below.</p>
            )}
            <p className="modal__foot" style={{ marginTop: 16 }}>
              <strong>Weekly time mix</strong> (from saved blocks, last 7 days)
            </p>
            {pulseDist.length === 0 ? (
              <p className="friends__muted">Add blocks in Build to see a distribution.</p>
            ) : (
              <div className="dist-bars">
                {pulseDist.map(({ id, h }) => (
                  <div key={id} className="dist-bar">
                    <div className="dist-bar__label">
                      <ActivityIcon id={id} size={16} />
                      {activityById(id).label}
                    </div>
                    <div>
                      <div className="dist-bar__track">
                        <div
                          className="dist-bar__fill"
                          style={{ width: `${Math.round((h / maxTotalHours) * 100)}%` }}
                        />
                      </div>
                      <p className="dist-bar__pct">
                        {h.toFixed(1)}h · {Math.round((h / maxTotalHours) * 100)}% of tracked week
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {metric ? (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="metric-title">
          <button type="button" className="modal__backdrop" aria-label="Close" onClick={closeSheets} />
          <div className="modal__panel">
            <div className="modal__top">
              <h3 id="metric-title">{activityById(metric).label} · 7-day spread</h3>
              <button type="button" className="icon-btn" onClick={closeSheets} aria-label="Close">
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
