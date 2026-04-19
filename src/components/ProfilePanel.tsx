import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  Database,
  HelpCircle,
  Info,
  LogOut,
  Settings,
  Shield,
  UserRound,
  X,
} from "lucide-react";
import { activityById } from "../data/activities";
import { DEMO_FOLLOWERS } from "../data/demoFollowers";
import { useSchedule } from "../context/ScheduleContext";
import { AvatarDisplay } from "./AvatarDisplay";
import { AvatarPicker } from "./AvatarPicker";
import { PhotoLightbox } from "./PhotoLightbox";
import { PulsePanel } from "./PulsePanel";
import { ActivityIcon } from "./ActivityIcon";
import { hoursByActivityLastNDays, hoursForActivityOnDay } from "../lib/weekStats";
import { lastNDayKeys, weekdayShort } from "../lib/dates";
import { loadMePrefs, ME_PREFS_KEY, saveMePrefs, type MePrefs } from "../lib/mePrefs";
import { APP_VERSION } from "../version";
import type { ActivityId, AvatarFields } from "../types";
import type { LucideIcon } from "lucide-react";

type StatSheet = "following" | "followers" | "pulse" | null;

type MeScreen =
  | "profile"
  | "settings"
  | "edit-profile"
  | "notifications"
  | "privacy"
  | "data"
  | "help"
  | "about";

function MeScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="me-screen-head">
      <button type="button" className="icon-btn me-screen-head__back" onClick={onBack} aria-label="Back">
        <ArrowLeft size={22} strokeWidth={2} />
      </button>
      <h2 className="me-screen-head__title">{title}</h2>
      <span className="me-screen-head__spacer" aria-hidden />
    </header>
  );
}

function SettingsNavRow({
  Icon,
  title,
  subtitle,
  onClick,
}: {
  Icon: LucideIcon;
  title: string;
  subtitle?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="me-settings-row" onClick={onClick}>
      <span className="me-settings-row__left">
        <span className="me-settings-row__icon" aria-hidden>
          <Icon size={20} strokeWidth={2} />
        </span>
        <span className="me-settings-row__textblock">
          <span className="me-settings-row__title">{title}</span>
          {subtitle ? <span className="me-settings-row__sub">{subtitle}</span> : null}
        </span>
      </span>
      <ChevronRight size={20} strokeWidth={2} className="me-settings-row__chev" aria-hidden />
    </button>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  const id = useId();
  return (
    <label className="me-toggle" htmlFor={id}>
      <span className="me-toggle__copy">
        <span className="me-toggle__title">{title}</span>
        <span className="me-toggle__desc">{description}</span>
      </span>
      <input
        id={id}
        type="checkbox"
        className="me-toggle__input"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="me-toggle__ui" aria-hidden />
    </label>
  );
}

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
  const [meScreen, setMeScreen] = useState<MeScreen>("profile");
  const [showReset, setShowReset] = useState(false);
  const [name, setName] = useState(profile.displayName);
  const [avatar, setAvatar] = useState<AvatarFields>({
    avatarEmoji: profile.avatarEmoji,
    avatarAnimalId: profile.avatarAnimalId ?? null,
    avatarImageDataUrl: profile.avatarImageDataUrl ?? null,
  });
  const [metric, setMetric] = useState<ActivityId | null>(null);
  const [statSheet, setStatSheet] = useState<StatSheet>(null);
  const [heroPhotoOpen, setHeroPhotoOpen] = useState(false);
  const [mePrefs, setMePrefs] = useState<MePrefs>(() => loadMePrefs());

  useEffect(() => {
    setName(profile.displayName);
    setAvatar({
      avatarEmoji: profile.avatarEmoji,
      avatarAnimalId: profile.avatarAnimalId ?? null,
      avatarImageDataUrl: profile.avatarImageDataUrl ?? null,
    });
  }, [profile.displayName, profile.avatarEmoji, profile.avatarAnimalId, profile.avatarImageDataUrl]);

  useEffect(() => {
    if (!avatar.avatarImageDataUrl) setHeroPhotoOpen(false);
  }, [avatar.avatarImageDataUrl]);

  const patchPrefs = (patch: Partial<MePrefs>) => {
    setMePrefs((prev) => {
      const next = { ...prev, ...patch };
      saveMePrefs(next);
      return next;
    });
  };

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
    localStorage.removeItem(ME_PREFS_KEY);
    window.location.reload();
  };

  const profileMain = (
    <>
      <div className="profile__topbar">
        <p className="profile__topbar-label">You</p>
        <button
          type="button"
          className="icon-btn profile__settings-gear"
          onClick={() => setMeScreen("settings")}
          aria-label="Open settings"
        >
          <Settings size={22} strokeWidth={2} />
        </button>
      </div>

      <div className="profile__hero">
        {avatar.avatarImageDataUrl ? (
          <button
            type="button"
            className="profile__avatar"
            onClick={() => setHeroPhotoOpen(true)}
            aria-label="View profile photo full size"
          >
            <AvatarDisplay source={avatar} size="lg" />
          </button>
        ) : (
          <div className="profile__avatar" aria-hidden>
            <AvatarDisplay source={avatar} size="lg" />
          </div>
        )}
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
    </>
  );

  const settingsHome = (
    <>
      <MeScreenHeader title="Settings" onBack={() => setMeScreen("profile")} />

      <p className="me-settings-lede">Account, preferences, and device data for this offline demo.</p>

      <div className="me-settings-group">
        <p className="me-settings-group__label">Account</p>
        <div className="me-settings-card">
          <SettingsNavRow
            Icon={UserRound}
            title="Edit profile"
            subtitle="Name, photo, avatar"
            onClick={() => setMeScreen("edit-profile")}
          />
        </div>
      </div>

      <div className="me-settings-group">
        <p className="me-settings-group__label">How you use LockedIn</p>
        <div className="me-settings-card">
          <SettingsNavRow
            Icon={Bell}
            title="Notifications"
            subtitle="Tips and reminders (on this device)"
            onClick={() => setMeScreen("notifications")}
          />
          <SettingsNavRow
            Icon={Shield}
            title="Privacy"
            subtitle="Local data · demo mode"
            onClick={() => setMeScreen("privacy")}
          />
        </div>
      </div>

      <div className="me-settings-group">
        <p className="me-settings-group__label">Support</p>
        <div className="me-settings-card">
          <SettingsNavRow Icon={HelpCircle} title="Help" subtitle="How tabs work" onClick={() => setMeScreen("help")} />
          <SettingsNavRow Icon={Info} title="About" subtitle={`Version ${APP_VERSION}`} onClick={() => setMeScreen("about")} />
        </div>
      </div>

      <div className="me-settings-group">
        <p className="me-settings-group__label">More</p>
        <div className="me-settings-card">
          <SettingsNavRow
            Icon={Database}
            title="Data on this device"
            subtitle="Reset schedules and profile"
            onClick={() => setMeScreen("data")}
          />
        </div>
      </div>
    </>
  );

  const editProfileScreen = (
    <>
      <MeScreenHeader title="Edit profile" onBack={() => setMeScreen("settings")} />
      <div className="me__card me__card--flush">
        <label className="me__field">
          <span>Display name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} />
        </label>
        <AvatarPicker value={avatar} onChange={setAvatar} layout="comfortable" />
        <button type="button" className="btn btn--primary me__save" onClick={saveProfile}>
          Save profile
        </button>
      </div>
    </>
  );

  const notificationsScreen = (
    <>
      <MeScreenHeader title="Notifications" onBack={() => setMeScreen("settings")} />
      <p className="me-settings-lede">These options are saved in your browser only. They do not connect to a server.</p>
      <div className="me-settings-card me-settings-card--toggles">
        <ToggleRow
          title="In-app tips"
          description="Short hints when exploring Build, Friends, and Stars."
          checked={mePrefs.tipsInApp}
          onChange={(v) => patchPrefs({ tipsInApp: v })}
        />
        <ToggleRow
          title="Block reminders"
          description="Gentle nudges about sticking to saved day blocks."
          checked={mePrefs.blockReminders}
          onChange={(v) => patchPrefs({ blockReminders: v })}
        />
        <ToggleRow
          title="Activity status"
          description="Show an “active now” style cue in the Friends demo list."
          checked={mePrefs.activityStatus}
          onChange={(v) => patchPrefs({ activityStatus: v })}
        />
      </div>
    </>
  );

  const privacyScreen = (
    <>
      <MeScreenHeader title="Privacy" onBack={() => setMeScreen("settings")} />
      <div className="me__card me__card--flush">
        <p className="me-settings-prose">
          LockedIn keeps your schedule, follows, pulse, and profile in this browser. Nothing is uploaded to a LockedIn
          server in this demo.
        </p>
        <p className="me-settings-prose">
          Friends and “Stars” are sample data for layout and flows. Do not enter sensitive personal information you would
          not store in normal site storage.
        </p>
        <p className="me-settings-prose me-settings-prose--muted">
          You can clear everything anytime from Settings → Data on this device.
        </p>
      </div>
    </>
  );

  const dataScreen = (
    <>
      <MeScreenHeader title="Data on this device" onBack={() => setMeScreen("settings")} />
      <div className="me__card me__card--flush">
        <p className="me__card-body" style={{ marginTop: 0 }}>
          Schedules, follows, pulses, profile, and notification preferences stay in this browser until you reset.
        </p>
        {!showReset ? (
          <button type="button" className="btn btn--outline" onClick={() => setShowReset(true)}>
            Reset app data…
          </button>
        ) : (
          <div className="me__confirm">
            <p className="me__warn">This clears your schedule, follows, pulse, profile, and settings preferences.</p>
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
    </>
  );

  const helpScreen = (
    <>
      <MeScreenHeader title="Help" onBack={() => setMeScreen("settings")} />
      <div className="me__card me__card--flush">
        <ul className="me-help-list">
          <li>
            <strong>Build</strong> — Plan hours on the calendar; totals feed your You tab.
          </li>
          <li>
            <strong>Friends</strong> — Follow demo people and compare rhythms (offline sample).
          </li>
          <li>
            <strong>Stars</strong> — Borrow energy from public arcs (illustrative templates, not endorsements).
          </li>
          <li>
            <strong>You</strong> — Profile, weekly recap, pulse, and settings (gear icon).
          </li>
        </ul>
      </div>
    </>
  );

  const aboutScreen = (
    <>
      <MeScreenHeader title="About" onBack={() => setMeScreen("settings")} />
      <div className="me__card me__card--flush">
        <p className="me-about-name">LockedIn</p>
        <p className="me-about-version">Version {APP_VERSION}</p>
        <p className="me-settings-prose">
          A local-first day planner demo built with React and Vite. Profile photos and schedules never leave your device
          unless you export or reset.
        </p>
      </div>
    </>
  );

  let body: ReactNode = null;
  if (meScreen === "profile") body = profileMain;
  else if (meScreen === "settings") body = settingsHome;
  else if (meScreen === "edit-profile") body = editProfileScreen;
  else if (meScreen === "notifications") body = notificationsScreen;
  else if (meScreen === "privacy") body = privacyScreen;
  else if (meScreen === "data") body = dataScreen;
  else if (meScreen === "help") body = helpScreen;
  else if (meScreen === "about") body = aboutScreen;

  return (
    <section className="profile" aria-labelledby={meScreen === "profile" ? "profile-heading" : undefined}>
      {body}

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

      {avatar.avatarImageDataUrl ? (
        <PhotoLightbox
          src={avatar.avatarImageDataUrl}
          open={heroPhotoOpen}
          onClose={() => setHeroPhotoOpen(false)}
        />
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
