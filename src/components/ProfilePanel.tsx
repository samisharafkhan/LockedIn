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
import { ActivityIcon } from "./ActivityIcon";
import { hoursByActivityLastNDays, hoursForActivityOnDay } from "../lib/weekStats";
import { lastNDayKeys, weekdayShort } from "../lib/dates";
import { applyThemeFromPrefs, loadMePrefs, ME_PREFS_KEY, saveMePrefs, type MePrefs } from "../lib/mePrefs";
import { APP_VERSION } from "../version";
import { formatHm } from "../lib/time";
import { getFirestoreDb } from "../lib/firebaseApp";
import { fetchDirectoryUser, type DirectoryUser } from "../lib/userDirectory";
import { subscribeUserSchedulePosts, deleteSchedulePost, type SchedulePostDoc } from "../lib/schedulePosts";
import { UserPublicProfileSheet } from "./UserPublicProfileSheet";
import { WeeklyStatsCard } from "./WeeklyStatsCard";
import { SchedulePostHCard } from "./SchedulePostHCard";
import { PostSocialBar } from "./PostSocialBar";
import { storedToTimeBlock } from "./ProfilePostUtils";
import {
  markNotificationRead,
  subscribeMyActivity,
  subscribeMyNotifications,
  type SocialNotificationDoc,
  type UserActivityDoc,
} from "../lib/socialNotifications";
import type { ActivityId, AvatarFields } from "../types";
import type { LucideIcon } from "lucide-react";

type StatSheet = "following" | "followers" | null;

type MeScreen =
  | "profile"
  | "settings"
  | "edit-profile"
  | "notifications"
  | "activity"
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
  const [followingMap, setFollowingMap] = useState<Record<string, DirectoryUser>>({});
  const [publicProfileUid, setPublicProfileUid] = useState<string | null>(null);
  const [myPostRows, setMyPostRows] = useState<{ id: string; data: SchedulePostDoc }[]>([]);
  const [openMyPostId, setOpenMyPostId] = useState<string | null>(null);
  const [myNotifications, setMyNotifications] = useState<{ id: string; data: SocialNotificationDoc }[]>([]);
  const [notificationActors, setNotificationActors] = useState<Record<string, DirectoryUser>>({});
  const [myActivityRows, setMyActivityRows] = useState<{ id: string; data: UserActivityDoc }[]>([]);
  const openMyPostEntry = useMemo(
    () => (openMyPostId ? myPostRows.find((r) => r.id === openMyPostId) : undefined),
    [myPostRows, openMyPostId],
  );

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

  useEffect(() => {
    const db = getFirestoreDb();
    if (!db || !firebaseUser || followingIds.length === 0) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const next: Record<string, DirectoryUser> = {};
      for (const uid of followingIds) {
        if (getFriend(uid) || next[uid]) continue;
        const u = await fetchDirectoryUser(db, uid);
        if (u) next[uid] = u;
      }
      if (!cancelled) {
        setFollowingMap((prev) => ({ ...prev, ...next }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [followingIds, firebaseUser, getFriend]);

  useEffect(() => {
    if (!firebaseUser) {
      setMyPostRows([]);
      return;
    }
    return subscribeUserSchedulePosts(firebaseUser.uid, setMyPostRows);
  }, [firebaseUser]);

  useEffect(() => {
    const db = getFirestoreDb();
    if (!db || !firebaseUser || myNotifications.length === 0) return;
    let cancelled = false;
    void (async () => {
      const actorUids = [...new Set(myNotifications.map((n) => n.data.actorUid).filter(Boolean))];
      const next: Record<string, DirectoryUser> = {};
      for (const uid of actorUids) {
        if (notificationActors[uid]) continue;
        const row = await fetchDirectoryUser(db, uid);
        if (row) next[uid] = row;
      }
      if (!cancelled && Object.keys(next).length > 0) {
        setNotificationActors((prev) => ({ ...prev, ...next }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [myNotifications, firebaseUser, notificationActors]);

  useEffect(() => {
    const db = getFirestoreDb();
    if (!db || !firebaseUser) {
      setMyNotifications([]);
      return;
    }
    return subscribeMyNotifications(db, firebaseUser.uid, setMyNotifications);
  }, [firebaseUser]);

  useEffect(() => {
    const db = getFirestoreDb();
    if (!db || !firebaseUser) {
      setMyActivityRows([]);
      return;
    }
    return subscribeMyActivity(db, firebaseUser.uid, setMyActivityRows);
  }, [firebaseUser]);

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

  const openUserProfile = (uid: string) => {
    closeSheets();
    setPublicProfileUid(uid);
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
      <div className="profile__topbar profile__topbar--end">
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
            <div className="profile__stat-btn profile__stat-btn--plain" aria-hidden>
              <p className="profile__stat-num">{myPostRows.length}</p>
              <p className="profile__stat-label">Posts</p>
            </div>
          </div>
          {(profile.bio ?? "").trim() ? (
            <p className="profile__bio profile__bio--filled">{(profile.bio ?? "").trim()}</p>
          ) : (
            <p className="profile__bio profile__bio--empty friends__muted">{t("profile_bio_empty")}</p>
          )}
        </div>
      </div>

      <WeeklyStatsCard
        stats={feedItems}
        displayName={profile.displayName}
        onSelectStat={openMetric}
      />

      {firebaseUser && myActivityRows.length > 0 ? (
        <div className="profile__section">
          <h3 className="profile-recent__h">Recent activity</h3>
          <ul className="profile-recent__list" role="list">
            {myActivityRows.slice(0, 3).map(({ id, data }) => (
              <li key={id} className="profile-recent__row">
                <span className="profile-recent__mark" aria-hidden>
                  {data.type === "liked" ? "♥" : data.type === "saved" ? "★" : "✎"}
                </span>
                <p className="profile-recent__text">
                  {data.type === "liked" ? "Liked" : data.type === "saved" ? "Saved" : "Commented"}{" "}
                  {data.message ? <span>“{data.message}”</span> : "a post"}
                </p>
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn--sm btn--outline" onClick={() => setMeScreen("activity")}>
            See all activity
          </button>
        </div>
      ) : null}

      {firebaseUser && myPostRows.length > 0 ? (
        <div className="profile__section profile__section--posts">
          <h3 className="profile__h3">{t("profile_section_posts")}</h3>
          <ul className="post-hcard-list" role="list">
            {myPostRows.map(({ id, data }) => (
              <li key={id} className="post-hcard-list__item" role="listitem">
                <SchedulePostHCard data={data} onOpen={() => setOpenMyPostId(id)} variant="profile" />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
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
            subtitle="Follows, likes, comments, reminders"
            onClick={() => setMeScreen("notifications")}
          />
          <SettingsNavRow
            Icon={Database}
            title="Your activity"
            subtitle="Likes, saves, comments you've made"
            onClick={() => setMeScreen("activity")}
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
      <p className="me-settings-lede">Recent activity on your account. Tap any item to mark it as seen.</p>
      <ul className="modal-list">
        {myNotifications.length === 0 ? (
          <li className="friends__muted">No notifications yet.</li>
        ) : (
          myNotifications
            .map(({ id, data }) => (
            <li key={id}>
              <button
                type="button"
                className="modal-list__row modal-list__row--button"
                onClick={() => {
                  const db = getFirestoreDb();
                  if (!db || !firebaseUser) return;
                  void markNotificationRead(db, firebaseUser.uid, id);
                }}
              >
                <span className="modal-list__mark">{data.read ? "○" : "●"}</span>
                <div>
                  <p className="modal-list__name">
                    {(() => {
                      const actor = notificationActors[data.actorUid]?.displayName ?? `@${data.actorUid.slice(0, 8)}`;
                      if (data.type === "follow_request") return `${actor} requested to follow you`;
                      if (data.type === "follow_accept") return `${actor} accepted your follow request`;
                      if (data.type === "post_like") return `${actor} liked your post`;
                      if (data.type === "post_save") return `${actor} saved your post`;
                      if (data.type === "post_comment") return `${actor} commented on your post`;
                      if (data.type === "share_sent") return "Share sent";
                      return "Upcoming event reminder";
                    })()}
                  </p>
                  <p className="modal-list__handle">{data.message ?? "Open to mark as read."}</p>
                </div>
              </button>
            </li>
            ))
        )}
      </ul>
      <div className="me-settings-card me-settings-card--toggles" style={{ marginTop: 12 }}>
        <p className="me-settings-prose me-settings-prose--muted" style={{ margin: 0 }}>
          Preference toggles below are saved on this device.
        </p>
      </div>
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

  const activityScreen = (
    <>
      <MeScreenHeader title="Your activity" onBack={() => setMeScreen("settings")} />
      <p className="me-settings-lede">Likes, saves, and comments you've made on others' posts.</p>
      <ul className="modal-list">
        {myActivityRows.length === 0 ? (
          <li className="friends__muted">No activity yet.</li>
        ) : (
          myActivityRows.map(({ id, data }) => (
            <li key={id} className="modal-list__row">
              <span className="modal-list__mark" aria-hidden>
                {data.type === "liked" ? "♥" : data.type === "saved" ? "★" : "✎"}
              </span>
              <div>
                <p className="modal-list__name">
                  {data.type === "liked" ? "Liked a post" : data.type === "saved" ? "Saved a post" : "Commented"}
                </p>
                <p className="modal-list__handle">
                  {data.message ? `“${data.message}”` : `on @${(data.targetOwnerUid ?? "").slice(0, 8)}…`}
                </p>
              </div>
            </li>
          ))
        )}
      </ul>
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
            <p className="me__warn">This clears your schedule, follows, profile, notifications, and settings preferences.</p>
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
            <strong>You</strong> — Profile, weekly recap, posts, and settings (gear icon).
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
  else if (meScreen === "activity") body = activityScreen;
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
                  const remote = followingMap[id];
                  const mark = f?.mark ?? remote?.avatarEmoji ?? "○";
                  const name = f?.displayName ?? remote?.displayName ?? t("friends_compare_loading");
                  const handle = f?.handle ?? remote?.handle ?? id.slice(0, 10);
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        className="modal-list__row modal-list__row--button glass-hit"
                        onClick={() => openUserProfile(id)}
                      >
                        <span className="modal-list__mark" aria-hidden>
                          {mark}
                        </span>
                        <div>
                          <p className="modal-list__name">{name}</p>
                          <p className="modal-list__handle">@{handle}</p>
                        </div>
                      </button>
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
                    <li key={id}>
                      <button
                        type="button"
                        className="modal-list__row modal-list__row--button glass-hit"
                        onClick={() => openUserProfile(id)}
                      >
                        <span className="modal-list__mark" aria-hidden>
                          {mark}
                        </span>
                        <div>
                          <p className="modal-list__name">{name}</p>
                          <p className="modal-list__handle">@{handle}</p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      <UserPublicProfileSheet
        open={publicProfileUid != null}
        targetUid={publicProfileUid}
        onClose={() => setPublicProfileUid(null)}
      />

      {openMyPostEntry && firebaseUser ? (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="my-post-title">
          <button type="button" className="modal__backdrop" aria-label="Close" onClick={() => setOpenMyPostId(null)} />
          <div className="modal__panel glass-panel">
            <div className="modal__top">
              <h3 id="my-post-title">{t("profile_post_day", { day: openMyPostEntry.data.dayKey })}</h3>
              <button
                type="button"
                className="icon-btn glass-hit"
                onClick={() => setOpenMyPostId(null)}
                aria-label="Close"
              >
                <X size={22} strokeWidth={2} />
              </button>
            </div>
            {firebaseUser ? (
              <PostSocialBar
                variant="schedulePost"
                postId={openMyPostEntry.id}
                ownerUid={openMyPostEntry.data.ownerUid}
                showPinControl
                postPinned={openMyPostEntry.data.pinned === true}
              />
            ) : null}
            <ol className="discover__blocks">
              {openMyPostEntry.data.blocks.map((sb) => {
                const b = storedToTimeBlock(sb);
                return (
                  <li key={b.id} className="discover__block-row">
                    <span className="discover__block-ico" aria-hidden>
                      <ActivityIcon id={b.activityId} size={18} />
                    </span>
                    <div>
                      <p className="discover__block-label">{t(`act_${b.activityId}_label`)}</p>
                      <p className="discover__block-time">
                        {formatHm(b.startHour, b.startMinute)} –{" "}
                        {b.endHour === 24 && b.endMinute === 0
                          ? t("schedule_midnight")
                          : formatHm(b.endHour, b.endMinute)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
            <p className="profile-post-delete-note friends__muted" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="btn btn--outline btn--sm"
                onClick={() => {
                  void deleteSchedulePost(openMyPostEntry.id).then(() => setOpenMyPostId(null));
                }}
              >
                Delete this post
              </button>
            </p>
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
