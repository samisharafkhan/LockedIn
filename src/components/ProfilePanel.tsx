import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  Database,
  HelpCircle,
  Info,
  Globe,
  Layers,
  LogOut,
  Settings,
  Shield,
  UserPlus,
  UserRound,
  X,
} from "lucide-react";
import { activityById } from "../data/activities";
import { useSchedule } from "../context/ScheduleContext";
import { AvatarDisplay } from "./AvatarDisplay";
import { AvatarPicker } from "./AvatarPicker";
import { PhotoLightbox } from "./PhotoLightbox";
import { PulsePanel } from "./PulsePanel";
import { ActivityIcon } from "./ActivityIcon";
import { hoursByActivityLastNDays, hoursForActivityOnDay } from "../lib/weekStats";
import { lastNDayKeys, weekdayShort } from "../lib/dates";
import { applyThemeFromPrefs, loadMePrefs, ME_PREFS_KEY, saveMePrefs, type MePrefs } from "../lib/mePrefs";
import { APP_VERSION } from "../version";
import { getFirestoreDb } from "../lib/firebaseApp";
import { fetchDirectoryUser, type DirectoryUser } from "../lib/userDirectory";
import type { ActivityId, AvatarFields } from "../types";
import type { LucideIcon } from "lucide-react";

type StatSheet = "following" | "followers" | "pulse" | null;

type MeScreen =
  | "profile"
  | "settings"
  | "edit-profile"
  | "notifications"
  | "privacy"
  | "layouts"
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
  disabled,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <label className={`me-toggle ${disabled ? "me-toggle--disabled" : ""}`} htmlFor={id}>
      <span className="me-toggle__copy">
        <span className="me-toggle__title">{title}</span>
        <span className="me-toggle__desc">{description}</span>
      </span>
      <input
        id={id}
        type="checkbox"
        className="me-toggle__input"
        checked={checked}
        disabled={disabled}
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
    followerIds,
    pulse,
    clearPulse,
    getFriend,
    firebaseUser,
    signOutAuth,
    pendingIncomingFollows,
    acceptFollowRequest,
    rejectFollowRequest,
    t,
  } = useSchedule();
  const navigate = useNavigate();
  const [meScreen, setMeScreen] = useState<MeScreen>("profile");
  const [showReset, setShowReset] = useState(false);
  const [name, setName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [avatar, setAvatar] = useState<AvatarFields>({
    avatarEmoji: profile.avatarEmoji,
    avatarAnimalId: profile.avatarAnimalId ?? null,
    avatarImageDataUrl: profile.avatarImageDataUrl ?? null,
  });
  const [metric, setMetric] = useState<ActivityId | null>(null);
  const [statSheet, setStatSheet] = useState<StatSheet>(null);
  const [heroPhotoOpen, setHeroPhotoOpen] = useState(false);
  const [mePrefs, setMePrefs] = useState<MePrefs>(() => loadMePrefs());
  const [requesterMap, setRequesterMap] = useState<Record<string, DirectoryUser>>({});
  const [followerMap, setFollowerMap] = useState<Record<string, DirectoryUser>>({});

  useEffect(() => {
    setName(profile.displayName);
    setBio(profile.bio ?? "");
    setAvatar({
      avatarEmoji: profile.avatarEmoji,
      avatarAnimalId: profile.avatarAnimalId ?? null,
      avatarImageDataUrl: profile.avatarImageDataUrl ?? null,
    });
  }, [
    profile.displayName,
    profile.bio,
    profile.avatarEmoji,
    profile.avatarAnimalId,
    profile.avatarImageDataUrl,
  ]);

  useEffect(() => {
    if (!avatar.avatarImageDataUrl) setHeroPhotoOpen(false);
  }, [avatar.avatarImageDataUrl]);

  useEffect(() => {
    const db = getFirestoreDb();
    if (!db || !firebaseUser || pendingIncomingFollows.length === 0) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const next: Record<string, DirectoryUser> = {};
      for (const { followerUid } of pendingIncomingFollows) {
        if (getFriend(followerUid)) continue;
        const u = await fetchDirectoryUser(db, followerUid);
        if (u) next[followerUid] = u;
      }
      if (!cancelled) {
        setRequesterMap((prev) => ({ ...prev, ...next }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pendingIncomingFollows, firebaseUser, getFriend]);

  useEffect(() => {
    const db = getFirestoreDb();
    if (!db || !firebaseUser || followerIds.length === 0) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const next: Record<string, DirectoryUser> = {};
      for (const followerUid of followerIds) {
        if (getFriend(followerUid)) continue;
        const u = await fetchDirectoryUser(db, followerUid);
        if (u) next[followerUid] = u;
      }
      if (!cancelled) {
        setFollowerMap((prev) => ({ ...prev, ...next }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [followerIds, firebaseUser, getFriend]);

  const patchPrefs = (patch: Partial<MePrefs>) => {
    setMePrefs((prev) => {
      const next = { ...prev, ...patch };
      saveMePrefs(next);
      queueMicrotask(() => applyThemeFromPrefs());
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
    setProfile({ displayName: trimmed, handle, bio: bio.trim().slice(0, 160), ...avatar });
  };

  const resetLocal = () => {
    void signOutAuth().catch(() => {});
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

      {firebaseUser && pendingIncomingFollows.length > 0 ? (
        <div className="profile__requests" role="region" aria-label={t("friends_requests_title")}>
          <div className="profile__requests-head">
            <UserPlus size={20} strokeWidth={2} aria-hidden />
            <div>
              <p className="profile__requests-title">{t("friends_requests_title")}</p>
              <p className="profile__requests-sub">{t("friends_requests_sub")}</p>
            </div>
          </div>
          <ul className="friends__request-list" role="list">
            {pendingIncomingFollows.map(({ followerUid }) => {
              const person = getFriend(followerUid) ?? requesterMap[followerUid];
              return (
                <li key={followerUid} className="friends__request-row">
                  <div>
                    <p className="friends__request-name">
                      {person?.displayName ?? t("friends_request_unknown")}
                    </p>
                    <p className="friends__request-handle">
                      {person?.handle ? `@${person.handle}` : followerUid.slice(0, 10)}
                    </p>
                  </div>
                  <div className="friends__request-actions">
                    <button
                      type="button"
                      className="btn btn--sm btn--primary"
                      onClick={() => void acceptFollowRequest(followerUid)}
                    >
                      {t("friends_accept")}
                    </button>
                    <button
                      type="button"
                      className="btn btn--sm btn--outline"
                      onClick={() => void rejectFollowRequest(followerUid)}
                    >
                      {t("friends_decline")}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

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
              <p className="profile__stat-num">{followerIds.length}</p>
              <p className="profile__stat-label">Followers</p>
            </button>
            <button type="button" className="profile__stat-btn" onClick={() => openStat("pulse")}>
              <p className="profile__stat-num">{pulse ? "1" : "0"}</p>
              <p className="profile__stat-label">Pulse</p>
            </button>
          </div>
          {(profile.bio ?? "").trim() ? (
            <p className="profile__bio profile__bio--filled">{(profile.bio ?? "").trim()}</p>
          ) : (
            <p className="profile__bio profile__bio--empty friends__muted">{t("profile_bio_empty")}</p>
          )}
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
            subtitle={t("profile_edit_sub")}
            onClick={() => setMeScreen("edit-profile")}
          />
          <SettingsNavRow
            Icon={Globe}
            title={t("settings_language")}
            subtitle={t("settings_language_sub")}
            onClick={() => navigate("/language?from=settings")}
          />
          {firebaseUser ? (
            <button
              type="button"
              className="me-settings-row"
              onClick={() => void signOutAuth()}
            >
              <span className="me-settings-row__left">
                <span className="me-settings-row__icon" aria-hidden>
                  <LogOut size={20} strokeWidth={2} />
                </span>
                <span className="me-settings-row__textblock">
                  <span className="me-settings-row__title">{t("settings_sign_out_google")}</span>
                  <span className="me-settings-row__sub">
                    {firebaseUser.email ?? firebaseUser.displayName ?? t("settings_google_session")}
                  </span>
                </span>
              </span>
            </button>
          ) : null}
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
            title={t("privacy_title")}
            subtitle={t("privacy_row_sub")}
            onClick={() => setMeScreen("privacy")}
          />
        </div>
      </div>

      <div className="me-settings-group">
        <p className="me-settings-group__label">{t("settings_appearance_group")}</p>
        <div className="me-settings-card">
          <SettingsNavRow
            Icon={Layers}
            title={t("settings_layouts_row_title")}
            subtitle={t("settings_layouts_row_sub")}
            onClick={() => setMeScreen("layouts")}
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
        <label className="me__field">
          <span>{t("profile_bio_label")}</span>
          <textarea
            className="me__textarea"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={160}
            rows={3}
            placeholder={t("profile_bio_placeholder")}
          />
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
          description={t("settings_tips_sub")}
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

  const layoutsScreen = (
    <>
      <MeScreenHeader title={t("settings_layouts_title")} onBack={() => setMeScreen("settings")} />
      <p className="me-settings-lede">{t("settings_layouts_sub")}</p>
      <div className="me-settings-card me-settings-card--toggles">
        <ToggleRow
          title={t("settings_dark_mode")}
          description={t("settings_dark_mode_sub")}
          checked={mePrefs.darkMode}
          onChange={(v) => patchPrefs({ darkMode: v })}
        />
      </div>
    </>
  );

  const privacyScreen = (
    <>
      <MeScreenHeader title={t("privacy_title")} onBack={() => setMeScreen("settings")} />
      <p className="me-settings-lede">{t("privacy_lede")}</p>
      <div className="me-settings-card me-settings-card--toggles">
        <ToggleRow
          title={t("privacy_private_account")}
          description={t("privacy_private_account_sub")}
          checked={profile.isPrivate === true}
          onChange={(v) =>
            setProfile({
              isPrivate: v,
              accountPublic: !v,
              publishTodayToDiscover: v ? false : profile.publishTodayToDiscover,
            })
          }
        />
        <ToggleRow
          title={t("privacy_publish_discover")}
          description={t("privacy_publish_discover_sub")}
          checked={profile.publishTodayToDiscover === true}
          disabled={profile.isPrivate === true}
          onChange={(v) => setProfile({ publishTodayToDiscover: v })}
        />
      </div>
      <div className="me__card me__card--flush" style={{ marginTop: 12 }}>
        <p className="me-settings-prose me-settings-prose--muted">{t("privacy_footer")}</p>
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
            <strong>Discover</strong> — Browse schedules others have chosen to publish for today.
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
  else if (meScreen === "layouts") body = layoutsScreen;
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
            <p className="modal__lede">People who currently follow you.</p>
            {followerIds.length === 0 ? (
              <p className="friends__muted">No followers yet.</p>
            ) : (
              <ul className="modal-list">
                {followerIds.map((id) => {
                  const f = getFriend(id);
                  const remote = followerMap[id];
                  const mark = f?.mark ?? remote?.avatarEmoji ?? "○";
                  const name = f?.displayName ?? remote?.displayName ?? t("friends_request_unknown");
                  const handle = f?.handle ?? remote?.handle ?? id.slice(0, 10);
                  return (
                    <li key={id} className="modal-list__row">
                      <span className="modal-list__mark" aria-hidden>
                        {mark}
                      </span>
                      <div>
                        <p className="modal-list__name">{name}</p>
                        <p className="modal-list__handle">@{handle}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
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
